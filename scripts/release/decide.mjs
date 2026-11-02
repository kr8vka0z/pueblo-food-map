#!/usr/bin/env node
/**
 * decide.mjs — first step of release.yml: decide what this cut does, from the
 * state of dev, main and the open PRs. Writes `run`, `action`, `version`,
 * `pr_number` and `maintenance` to GITHUB_OUTPUT.
 *
 * Exit codes: 0 ok (including "nothing to do"), 1 blocked, with the reason.
 * Run from a dev checkout with every branch and tag fetched.
 *
 * WHY files, not commits: releases reach main as squashes, so dev and main
 * never share commits and a commit count reads non-zero on identical files.
 *
 * WHY the recorded cut is a merge base: the release branch is one commit on
 * top of the dev commit it was cut from, so the merge base with dev IS that
 * commit, with nothing extra to store or keep in step.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Only dependency and CI files differ, so visitors should notice nothing. */
export const isMaintenanceOnly = (files) =>
  files.length > 0 && files.every((f) => /^(package\.json|package-lock\.json|\.github\/.+)$/.test(f));

const branchVersion = (pr) => /^release\/v(\d+\.\d+\.\d+)$/.exec(pr.headRefName)?.[1];

/**
 * Pure decision. Returns { action, message, version?, prNumber? } where action
 * is nothing | new | same | update | blocked.
 * `prs` = open same-repo release/* PRs; `recordedCut` = the commit the open PR
 * was cut from; `cutSha` = the commit this run would cut.
 */
export function decideCut({ devTree, mainTree, prs, syncUrls, cutSha, recordedCut, forcedVersion, versionIsLive }) {
  const blocked = (reason) => ({ action: "blocked", message: `Release NOT cut: ${reason}` });
  if (prs.length > 1) {
    return blocked(`only one release PR may be open, found ${prs.map((p) => p.url).join(" ")}. Close the extra ones.`);
  }
  const [pr] = prs;
  if (devTree === mainTree) {
    const left = pr ? ` Left the open release PR alone: ${pr.url}` : "";
    return { action: "nothing", message: `No changes: dev and main hold identical files, so no release PR.${left}` };
  }
  // An open sync PR means main holds something dev doesn't yet. It should have
  // auto-merged within minutes, so it is stuck, and a green skip would hide
  // that the release didn't happen.
  if (syncUrls.length) {
    return blocked(
      `the main -> dev sync PR is still open (${syncUrls.join(" ")}) and must merge first. Resolve any conflicts on the sync/* branch, keeping the merge commit (AGENTS.md "Back-sync"), then cut again.`,
    );
  }
  if (!pr) return { action: "new", version: forcedVersion, message: "Cutting a new release." };

  const version = branchVersion(pr);
  if (!version) return blocked(`open release PR ${pr.url} has no version in its branch name.`);
  // GitHub cannot change a PR's head branch, so the version is fixed while the PR is open.
  if (forcedVersion && forcedVersion !== version) {
    return blocked(`${pr.url} is open at v${version}, not v${forcedVersion}. Close it to use another version.`);
  }
  // A hotfix can take the same number while the PR is open. Reusing it would
  // collide with the live tag and changelog section.
  if (versionIsLive) return blocked(`v${version} is already live (a hotfix took it). Close ${pr.url} and cut again.`);
  if (recordedCut === cutSha) {
    return { action: "same", version, prNumber: pr.number, message: `Nothing new since the last cut: ${pr.url}` };
  }
  return { action: "update", version, prNumber: pr.number, message: `Updating ${pr.url} in place at v${version}.` };
}

const sh = (cmd, ...args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
const tree = (ref) => sh("git", "rev-parse", `${ref}^{tree}`);
const openPrs = (base) => JSON.parse(sh("gh", "pr", "list", "--base", base, "--state", "open", "--limit", "100", "--json", "number,url,headRefName,isCrossRepository"));

function main() {
  // Same-repo only: a fork's branch can be named release/anything.
  const prs = openPrs("main").filter((p) => p.headRefName.startsWith("release/") && !p.isCrossRepository);
  const syncUrls = openPrs("dev")
    .filter((p) => p.headRefName.startsWith("sync/main-"))
    .map((p) => p.url);
  const version = prs.length === 1 ? branchVersion(prs[0]) : undefined;
  const d = decideCut({
    devTree: tree("HEAD"),
    mainTree: tree("origin/main"),
    prs,
    syncUrls,
    cutSha: sh("git", "rev-parse", "HEAD"),
    recordedCut: prs.length === 1 ? sh("git", "merge-base", "HEAD", `origin/${prs[0].headRefName}`) : "",
    forcedVersion: process.env.FORCE_VERSION ?? "",
    versionIsLive: Boolean(version && sh("git", "tag", "--list", `v${version}`)),
  });

  console.log(d.message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${d.message}\n`);
  if (d.action === "blocked") {
    console.log(`::error::${d.message}`);
    process.exit(1);
  }
  const run = d.action === "new" || d.action === "update";
  const maintenance = run && isMaintenanceOnly(sh("git", "diff", "--name-only", "origin/main", "HEAD").split("\n").filter(Boolean));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `run=${run}\naction=${d.action}\nversion=${d.version ?? ""}\npr_number=${d.prNumber ?? ""}\nmaintenance=${maintenance}\n`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
