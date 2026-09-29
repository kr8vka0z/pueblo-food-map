#!/usr/bin/env node
/**
 * prepare.mjs — weekly release prep: pick the next version, bump it, and write
 * the merged-PR list the changelog writer (Claude in release.yml, or a human)
 * turns into the CHANGELOG.md section.
 *
 * Usage: node scripts/release/prepare.mjs [--allow-major] [--version X.Y.Z]
 *                                         [--ref dev] [--range A..B] [--out file] [--dry-run]
 * Exit codes: 0 ok, 3 nothing to release (no new PRs since the last release).
 *
 * WHY "last release" is not just `git tag`: releases reach `main` as SQUASH
 * merges (merge commits are disabled repo-wide), so `v*` tags sit on main
 * commits that are NOT ancestors of `dev` and `git log v1.0.0..dev` would list
 * the whole history. The release workflow therefore also tags the dev commit it
 * cut from as `cut/vX.Y.Z`; that tag is an ancestor of dev and marks exactly
 * what shipped. Fallback when no cut tag exists (the first release, or a hand
 * cut where it was forgotten): everything on dev newer than the v* tag's date.
 *
 * Semver: major only via --allow-major (a `!`/BREAKING PR alone never bumps it
 * — major means something users relied on changed, a human call), minor if any
 * `feat`, else patch. --version overrides all of it.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CONVENTIONAL = /^(\w+)(\([^)]*\))?(!)?:\s/;
const BREAKING_BODY = /BREAKING[ -]CHANGE/;

/** "feat(x)!: y (#12)" -> { type, breaking, pr, title }; pr is null without a trailing (#N). */
export function parseSubject(subject) {
  const m = CONVENTIONAL.exec(subject);
  const pr = /\(#(\d+)\)\s*$/.exec(subject);
  return { title: subject, type: m ? m[1] : "other", breaking: Boolean(m?.[3]), pr: pr ? Number(pr[1]) : null };
}

export const isBreaking = (i) => Boolean(i.breaking) || BREAKING_BODY.test(i.body ?? "");

/** Pure bump logic. `items` = [{type, breaking, body?}]. Returns the new version. */
export function nextVersion(current, items, { allowMajor = false, override } = {}) {
  if (override) {
    if (!/^\d+\.\d+\.\d+$/.test(override)) throw new Error(`bad --version: ${override}`);
    return override;
  }
  const [maj, min, pat] = current.split(".").map(Number);
  if (allowMajor && items.some(isBreaking)) return `${maj + 1}.0.0`;
  if (items.some((i) => i.type === "feat")) return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const tryGit = (...args) => {
  try {
    return sh("git", args);
  } catch {
    return "";
  }
};

function main() {
  const argv = process.argv.slice(2);
  const opt = (n) => {
    const i = argv.indexOf(n);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const ref = opt("--ref") ?? "HEAD";
  const out = opt("--out") ?? join(tmpdir(), "release-prs.md");
  const dry = argv.includes("--dry-run");
  const allowMajor = argv.includes("--allow-major");
  const override = opt("--version");

  const lastTag = tryGit("tag", "--list", "v*", "--sort=-v:refname").split("\n")[0];
  const base = lastTag ? lastTag.slice(1) : JSON.parse(readFileSync("package.json", "utf8")).version;
  const cut = lastTag && tryGit("rev-parse", "-q", "--verify", `refs/tags/cut/${lastTag}^{commit}`);
  // --range: explicit git range, for a hotfix branch (its history is main's, not dev's).
  const range = opt("--range")
    ? [opt("--range")]
    : cut
    ? [`${cut}..${ref}`]
    : lastTag
      ? [ref, `--since=${tryGit("log", "-1", "--format=%cI", lastTag)}`]
      : [ref];
  const rows = tryGit("log", "--first-parent", "--format=%H%x1f%s", ...range)
    .split("\n")
    .filter(Boolean)
    .map((r) => r.split("\x1f"))
    // chore(release) = the post-release sync PR back into dev; counting it
    // would make every week look like it has something to release.
    .filter(([, s]) => !s.startsWith("chore(release)"));

  const items = rows.map(([sha, subject]) => {
    const p = parseSubject(subject);
    let body = "";
    if (p.pr) {
      try {
        body = sh("gh", ["pr", "view", String(p.pr), "--json", "body", "--jq", ".body"]).slice(0, 1500);
      } catch {
        /* gh missing/offline: the title alone still drives the bump */
      }
    }
    return { ...p, sha, body };
  });
  if (!items.length) {
    console.error(`No new PRs on ${ref} since ${lastTag || "the start"}.`);
    process.exit(3);
  }

  const version = nextVersion(base, items, { allowMajor, override });
  if (!allowMajor && !override && items.some(isBreaking)) {
    console.error("WARNING: some PRs look breaking, but major bumps are manual. Re-run with --allow-major if users' existing behaviour really changed.");
  }

  const md = [`# PRs merged since ${lastTag || "the start"} (release v${version})`, ""];
  for (const i of items) {
    md.push(`## ${i.pr ? `#${i.pr}` : i.sha.slice(0, 7)} — ${i.title}`, "", i.body.trim() || "(no description)", "");
  }
  writeFileSync(out, md.join("\n"));

  // `npm version` rewrites package.json AND package-lock.json's version fields together.
  if (!dry) execFileSync("npm", ["version", version, "--no-git-tag-version", "--allow-same-version"], { stdio: "inherit" });
  console.error(`v${version}: ${items.length} PR(s) -> ${out}${dry ? " (dry run, nothing bumped)" : ""}`);
  console.log(version);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nprs_file=${out}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
