#!/usr/bin/env node
/**
 * prepare.mjs — weekly release prep: pick the next version, bump it, and write
 * the merged-PR list the changelog writer (Claude in release.yml, or a human)
 * turns into the CHANGELOG.md section.
 *
 * Usage: node scripts/release/prepare.mjs [--version X.Y.Z] [--ref dev]
 *                                         [--out file] [--dry-run]
 * Exit codes: 0 ok, 3 nothing to release (no new PRs since the last release).
 *
 * Which PRs count as "since the last release": releases reach `main` as SQUASH
 * commits, so the `v*` tag does not bring dev's old commits with it. The
 * release workflow therefore tags the dev commit it cut from as `cut/vX.Y.Z`;
 * the PR list starts at the newest `cut/*` tag reachable from --ref. With none
 * (the very first run, or a hotfix branch, which comes from main and never
 * has cut tags) it falls back to the newest `v*` tag, which is an ancestor of
 * dev/hotfix once main has been synced into dev. The newest `v*` tag also
 * supplies the base version to bump.
 *
 * Semver: minor if any `feat`, else patch. Major is never inferred — it means
 * something users relied on changed, a human call — so pass --version.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CONVENTIONAL = /^(\w+)(\([^)]*\))?(!)?:\s/;

/** "feat(x): y (#12)" -> { type, pr, title }; pr is null without a trailing (#N). */
export function parseSubject(subject) {
  const m = CONVENTIONAL.exec(subject);
  const pr = /\(#(\d+)\)\s*$/.exec(subject);
  return { title: subject, type: m ? m[1] : "other", pr: pr ? Number(pr[1]) : null };
}

/**
 * Commits that are release plumbing, not shipped work: the merge commits of
 * main -> dev sync PRs (feature PRs are squashed, so any "Merge ..." on dev's
 * first-parent line is a sync) and the exact release commit title. Counting
 * them would make every week look like it has something to release.
 */
export const isNoise = (subject) => /^Merge /.test(subject) || /^chore\(release\): v\d+\.\d+\.\d+$/.test(subject);

/** Pure bump logic. `items` = [{type}]. Returns the new version. */
export function nextVersion(current, items, { override } = {}) {
  if (override) {
    if (!/^\d+\.\d+\.\d+$/.test(override)) throw new Error(`bad --version: ${override}`);
    return override;
  }
  const [maj, min, pat] = current.split(".").map(Number);
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
  const override = opt("--version");

  const lastTag = tryGit("tag", "--list", "v*", "--sort=-v:refname").split("\n")[0];
  const base = lastTag ? lastTag.slice(1) : JSON.parse(readFileSync("package.json", "utf8")).version;
  // --tags: the cut tags are lightweight, which describe ignores by default.
  const since = tryGit("describe", "--tags", "--match", "cut/*", "--abbrev=0", ref) || lastTag;
  const rows = tryGit("log", "--first-parent", "--format=%H%x1f%s", since ? `${since}..${ref}` : ref)
    .split("\n")
    .filter(Boolean)
    .map((r) => r.split("\x1f"))
    .filter(([, s]) => !isNoise(s));

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
    console.error(`No new PRs on ${ref} since ${since || "the start"}.`);
    process.exit(3);
  }

  const version = nextVersion(base, items, { override });

  const md = [`# PRs merged since ${since || "the start"} (release v${version})`, ""];
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
