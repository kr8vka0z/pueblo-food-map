/**
 * websiteIo.ts — the real I/O behind scripts/refresh/website.ts's injected
 * deps: fetching a page (plain HTTP, falling back to a headless browser) and
 * asking Gemini through the Antigravity CLI (`agy`). Kept apart from
 * website.ts so that file stays testable without a network or a CLI.
 *
 * Runs only on the server (ops/systemd/), never in GitHub Actions: GitHub's
 * hosted runners can't reach Kyle's Antigravity login, and this repo is
 * public.
 */

import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GeminiStop, htmlToText, isPublicHttpUrl, type PageResult } from "./website";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
/** Less visible text than this = a script-built page (or a block page): try the browser. */
const MIN_TEXT_CHARS = 300;
const BROWSER_TIMEOUT_MS = 90_000;
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 (pueblofoodmap.com weekly check)";

/**
 * The environment agy and agent-browser get: ours minus every Cloudflare and
 * 1Password variable. Both run code steered by untrusted page text, so they
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

/**
 * The browser fallback, in its OWN agent-browser session (the default one is
 * shared by every job on the machine) and always closed after.
 */
async function browserText(url: string, session: string): Promise<PageResult> {
  const env = { ...untrustedChildEnv(), AGENT_BROWSER_SESSION: session };
  try {
    const opened = await run("agent-browser", ["open", url], { timeoutMs: BROWSER_TIMEOUT_MS, env });
    if (opened.code !== 0) return { ok: false, reason: `browser could not open the page (${opened.stderr.trim().slice(0, 120)})` };
    const got = await run("agent-browser", ["get", "text", "body"], { timeoutMs: BROWSER_TIMEOUT_MS, env });
    const text = got.stdout.replace(/\s+/g, " ").trim();
    if (got.code !== 0 || text.length < MIN_TEXT_CHARS) return { ok: false, reason: "browser read almost no text" };
    return { ok: true, text, finalUrl: url, via: "browser" };
  } finally {
    await run("agent-browser", ["close"], { timeoutMs: 30_000, env });
  }
}

/**
 * One GET. 404/410 is a definite "not there" (no second try); a refusal
 * (401/403), a timeout, a 5xx or a near-empty page gets ONE browser try.
 * 429 is left alone: the site asked us to slow down. Never throws.
 */
const MAX_REDIRECTS = 5;

/**
 * GET that follows redirects by hand, refusing any hop to a non-public host
 * (a page could otherwise bounce us to this server's own services or the
 * tailnet). ponytail: checks names, not resolved addresses, so a public
 * name that resolves to a private address still passes; the upgrade is a
 * DNS lookup per hop before connecting.
 */
async function publicFetch(url: string): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicHttpUrl(current)) throw new Error(`refused non-public address ${current}`);
    const res = await fetch(current, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!next) return res;
    current = new URL(next, current).toString();
  }
  throw new Error("too many redirects");
}

export function makeFetchPage(session: string): (url: string) => Promise<PageResult> {
  return async (url) => {
    // Never hand a non-public address to the browser either.
    if (!isPublicHttpUrl(url)) return { ok: false, reason: "not a public web address" };
    let res: Response;
    try {
      res = await publicFetch(url);
    } catch (err) {
      if (err instanceof Error && /^refused non-public/.test(err.message)) return { ok: false, reason: err.message };
      const fallback = await browserText(url, session);
      return fallback.ok ? fallback : { ok: false, reason: `fetch failed (${err instanceof Error ? err.message : String(err)}); ${fallback.reason}` };
    }
    if (res.status === 404 || res.status === 410) return { ok: false, reason: `HTTP ${res.status}` };
    if (res.status === 429) return { ok: false, reason: "HTTP 429 (asked to slow down)" };
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && !/html|text\/plain/i.test(type)) return { ok: false, reason: `not a web page (${type || "no content type"})` };
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const text = htmlToText(buf.subarray(0, MAX_HTML_BYTES).toString("utf-8"));
      if (text.length >= MIN_TEXT_CHARS) return { ok: true, text, finalUrl: res.url || url, via: "fetch" };
    }
    const fallback = await browserText(url, session);
    return fallback.ok ? fallback : { ok: false, reason: `HTTP ${res.status}; ${fallback.reason}` };
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
