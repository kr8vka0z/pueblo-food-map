/**
 * websiteIo.ts — the real I/O behind scripts/refresh/website.ts's injected
 * deps: fetching a page (plain HTTP, public addresses only) and
 * asking Gemini through the Antigravity CLI (`agy`). Kept apart from
 * website.ts so that file stays testable without a network or a CLI.
 *
 * Runs only on the server (ops/systemd/), never in GitHub Actions: GitHub's
 * hosted runners can't reach Kyle's Antigravity login, and this repo is
 * public.
 */

import { execFile } from "node:child_process";
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GeminiStop, htmlToText, isPublicHttpUrl, isPublicIp, type PageResult } from "./website";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
/** Less visible text than this = a script-built page (or a block page): unreadable. */
const MIN_TEXT_CHARS = 300;
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 (pueblofoodmap.com weekly check)";

/**
 * The environment agy gets: ours minus every Cloudflare and 1Password
 * variable. It runs steered by untrusted page text, so it
 * must never hold the D1 write token (or a way to fetch more secrets), even
 * when a person runs the job by hand with the token exported in the shell.
 */
export function untrustedChildEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !/^(CLOUDFLARE_|OP_)/.test(k))) as NodeJS.ProcessEnv;
}

/**
 * Reads the unit's secrets file (claude-bot-secrets format, NAME='value' per
 * line) and deletes it at once, so nothing started later (agy above all) can
 * read it from disk. The values live only in this process's memory and are
 * handed to wrangler's child processes alone (refresh-ingest.ts); they are
 * never put in this process's own environment, because a same-user process
 * can read another's /proc/<pid>/environ (it holds the environment the
 * process STARTED with, which is why run.sh never sources the file either).
 */
export function readAndRemoveSecretsFile(path: string): Record<string, string> {
  const text = readFileSync(path, "utf-8");
  rmSync(path, { force: true });
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)='(.*)'$/);
    if (m) out[m[1]] = m[2].replace(/'\\''/g, "'");
  }
  return out;
}

function run(cmd: string, args: string[], opts: { cwd?: string; timeoutMs: number; env?: NodeJS.ProcessEnv }): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile(
      cmd,
      args,
      { cwd: opts.cwd, timeout: opts.timeoutMs, maxBuffer: 16 * 1024 * 1024, env: opts.env ?? untrustedChildEnv(), encoding: "utf-8" },
      (err, stdout, stderr) => {
        const code = err ? (typeof (err as { code?: unknown }).code === "number" ? ((err as { code: number }).code) : 1) : 0;
        resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
      },
    );
    // stdin from /dev/null: agy otherwise waits on an open pipe.
    child.stdin?.end();
  });
}

const MAX_REDIRECTS = 5;

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
/** dns.lookup's shape, so tests can stand in a resolver. */
export type Resolver = (hostname: string, options: { all: true }, cb: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void) => void;

/**
 * The `lookup` every page request connects through: resolves the name and
 * refuses the connection if ANY answer is non-public (isPublicIp), so a
 * public-looking name pointed at 127.0.0.1 (this server runs 1Password
 * Connect on 127.0.0.1:8090), the LAN or the tailnet never gets a request.
 * The socket connects to the address checked here, not to a second lookup,
 * so a DNS answer can't change between the check and the connection.
 */
export function makePinnedLookup(resolve: Resolver = dnsLookup as unknown as Resolver) {
  return (hostname: string, options: LookupOptions | number | undefined, cb: LookupCallback): void => {
    const wantAll = typeof options === "object" && options !== null && options.all === true;
    resolve(hostname, { all: true }, (err, addresses) => {
      if (err) return cb(err, wantAll ? [] : "", 4);
      const bad = addresses.find((a) => !isPublicIp(a.address));
      if (addresses.length === 0 || bad) {
        const e = new Error(`refused non-public address for ${hostname}${bad ? ` (${bad.address})` : ""}`) as NodeJS.ErrnoException;
        e.code = "ENONPUBLIC";
        return cb(e, wantAll ? [] : "", 4);
      }
      if (wantAll) return cb(null, addresses);
      cb(null, addresses[0].address, addresses[0].family);
    });
  };
}

interface RawResponse {
  status: number;
  location: string | null;
  contentType: string;
  body: Buffer;
}

/** One GET through the pinned lookup; reads at most MAX_HTML_BYTES of body. */
function getOnce(url: string, lookup: ReturnType<typeof makePinnedLookup>): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = (u.protocol === "https:" ? httpsRequest : httpRequest)(
      u,
      { method: "GET", headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" }, lookup, timeout: FETCH_TIMEOUT_MS },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          if (size < MAX_HTML_BYTES) chunks.push(c);
          size += c.length;
          if (size >= MAX_HTML_BYTES) res.destroy();
        });
        const done = () =>
          resolve({
            status: res.statusCode ?? 0,
            location: typeof res.headers.location === "string" ? res.headers.location : null,
            contentType: String(res.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks).subarray(0, MAX_HTML_BYTES),
          });
        res.on("end", done);
        res.on("close", done);
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    req.end();
  });
}

/**
 * Fetches a page for the reader. Every hop (redirects followed by hand, at
 * most MAX_REDIRECTS) must pass the name check (isPublicHttpUrl — literal
 * addresses skip DNS, so they are checked here) and connect through the
 * pinned lookup. No browser fallback (removed in review of PR #845: a
 * browser follows redirects and script navigation we can't check), so a
 * page that needs JavaScript, refuses us, or is near-empty is simply
 * unreadable: nothing is written for that venue. 404/410 = not there; 429
 * = asked to slow down. Never throws.
 */
export function makeFetchPage(resolve?: Resolver): (url: string) => Promise<PageResult> {
  const lookup = makePinnedLookup(resolve);
  return async (url) => {
    let current = url;
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        if (!isPublicHttpUrl(current)) return { ok: false, reason: `refused non-public address ${current}` };
        const res = await getOnce(current, lookup);
        if (res.status >= 300 && res.status < 400 && res.location) {
          current = new URL(res.location, current).toString();
          continue;
        }
        if (res.status === 404 || res.status === 410) return { ok: false, reason: `HTTP ${res.status}` };
        if (res.status === 429) return { ok: false, reason: "HTTP 429 (asked to slow down)" };
        if (res.status < 200 || res.status >= 300) return { ok: false, reason: `HTTP ${res.status}` };
        if (!/html|text\/plain/i.test(res.contentType)) return { ok: false, reason: `not a web page (${res.contentType || "no content type"})` };
        const text = htmlToText(res.body.toString("utf-8"));
        if (text.length < MIN_TEXT_CHARS) return { ok: false, reason: "almost no text (a page built by JavaScript, or a block page)" };
        return { ok: true, text, finalUrl: current, via: "fetch" };
      }
      return { ok: false, reason: "too many redirects" };
    } catch (err) {
      return { ok: false, reason: `fetch failed (${err instanceof Error ? err.message : String(err)})` };
    }
  };
}

const AGY_TIMEOUT = "540s";
const AGY_PROCESS_TIMEOUT_MS = 600_000;

/**
 * Gemini through `agy` in print mode. The prompt is the LAST argument (agy
 * requires it), the schema goes inline (no file path is ever handed to the
 * model), and the working directory is a fresh empty temp dir, removed
 * after: headless agy auto-denies shell tools, and an empty cwd leaves its
 * file tools nothing to read even if a page talks it into trying. Any
 * hard failure throws GeminiStop, which stops the source for the run; a
 * run that answered nothing returns null.
 */
export function makeGemini(model: string, agyBin = "agy"): (prompt: string, schema: object, opts: { search: boolean }) => Promise<unknown> {
  return async (prompt, schema) => {
    const cwd = mkdtempSync(join(tmpdir(), "pfm-agy-"));
    try {
      const { code, stdout, stderr } = await run(
        agyBin,
        // --sandbox: terminal restrictions on top of headless mode's denials (probed 2026-10-25: headless reads still work).
        ["--sandbox", "--model", model, "--disable-slash-commands", "--print-timeout", AGY_TIMEOUT, "--output-format", "json", "--json-schema", JSON.stringify(schema), "-p", prompt],
        { cwd, timeoutMs: AGY_PROCESS_TIMEOUT_MS },
      );
      const start = stdout.indexOf('{"conversation_id"');
      let body: { status?: string; error?: string; structured_output?: unknown } | null = null;
      try {
        body = start >= 0 ? JSON.parse(stdout.slice(start).trim().split("\n")[0]) : null;
      } catch {
        body = null;
      }
      if (code !== 0 || !body || body.status !== "SUCCESS") {
        throw new GeminiStop(`agy exit ${code}: ${(body?.error ?? stderr.trim().split("\n").pop() ?? "no output").slice(0, 200)}`);
      }
      // Ran but answered nothing (e.g. it reached for a tool headless mode denies): "no answer", counted by the caller.
      if (!body.structured_output || typeof body.structured_output !== "object") return null;
      return body.structured_output;
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  };
}
