/** update-release-pr.test.mjs — guards a repeat cut: after any push outcome, the PR body and the branch must describe the same commit, or the run must say it can't tell. */
import { describe, test, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve(import.meta.dirname, "update-release-pr.sh");
const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
const BRANCH = "release/v1.4.0";

const fakeGh = `#!/usr/bin/env bash
case "$*" in
  *"--jq .body") cat "$T/live-body" ;;
  "api -X PATCH"*)
    n=$(($(cat "$T/patches") + 1)); echo "$n" > "$T/patches"
    [ "$n" != 2 ] || [ "$RESTORE" != fail ] || exit 1
    for a; do case "$a" in body=@*) cp "\${a#body=@}" "$T/live-body" ;; esac; done ;;
esac
`;
// push: ok runs it; rejected refuses it; lost lands it, then reports failure.
const fakeGit = `#!/usr/bin/env bash
if [ "$1" = push ]; then
  [ "$PUSH" = rejected ] && exit 1
  ${realGit} "$@" || exit 1
  [ "$PUSH" != lost ]; exit $?
fi
[ "$1" = ls-remote ] && [ "$VERIFY" = fail ] && exit 128
exec ${realGit} "$@"
`;

/** Repeat cut in a throwaway repo: origin's branch holds the old commit, local holds the new one. */
function run({ push = "ok", restore = "ok", verify = "ok" }) {
  const T = mkdtempSync(join(tmpdir(), "release-pr-"));
  const git = (cwd, ...a) => execFileSync(realGit, [...a], { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  git(T, "init", "-q", "--bare", "origin.git");
  git(T, "clone", "-q", "origin.git", "co");
  const cwd = join(T, "co");
  git(cwd, "switch", "-q", "-c", BRANCH);
  const commit = (m) => git(cwd, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", m);
  commit("old");
  git(cwd, "push", "-q", "origin", BRANCH);
  commit("new");
  const local = git(cwd, "rev-parse", "HEAD");

  writeFileSync(join(T, "live-body"), "OLD\n");
  writeFileSync(join(T, "new-body"), "NEW\n");
  writeFileSync(join(T, "patches"), "0");
  for (const [name, text] of [["gh", fakeGh], ["git", fakeGit]]) {
    writeFileSync(join(T, name), text);
    chmodSync(join(T, name), 0o755);
  }
  const r = spawnSync("bash", [script, "o/r", "900", "1.4.0", join(T, "new-body")], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: `${T}:${process.env.PATH}`, T, PUSH: push, RESTORE: restore, VERIFY: verify },
  });
  return {
    status: r.status,
    out: r.stdout + r.stderr,
    body: readFileSync(join(T, "live-body"), "utf8").trim(),
    landed: git(cwd, "ls-remote", "origin", `refs/heads/${BRANCH}`).split(/\s/)[0] === local,
  };
}

describe("update-release-pr", () => {
  test("a good push leaves the new body on the new commit", () => {
    expect(run({})).toMatchObject({ status: 0, body: "NEW", landed: true });
  });

  test("a rejected push puts the old body back and goes red", () => {
    const r = run({ push: "rejected" });
    expect(r).toMatchObject({ status: 1, body: "OLD", landed: false });
    expect(r.out).toContain("keeps its old commit and description");
  });

  test("a push that landed but reported failure keeps the new body", () => {
    expect(run({ push: "lost" })).toMatchObject({ status: 0, body: "NEW", landed: true });
  });

  test("a failed restore goes red and says the next cut repairs it", () => {
    const r = run({ push: "rejected", restore: "fail" });
    expect(r).toMatchObject({ status: 1, body: "NEW", landed: false });
    expect(r.out).toContain("Cut again");
  });

  test("when the branch can't be read back, it restores nothing and says so", () => {
    const r = run({ push: "rejected", verify: "fail" });
    expect(r).toMatchObject({ status: 1, body: "NEW", landed: false });
    expect(r.out).toContain("could not tell");
  });
});
