/**
 * audit-fix.test.mjs — drives the real scripts/security/audit-fix.sh in a throwaway git repo (with a local bare repo as `origin`, so the push is real)
 * and stub `npx` / `npm` / `gh` first on PATH. Guards the risky parts: nothing ships unless a package version really changed, the lockfile-only and
 * no-false-"dev" guards stop a bad push, the PR and issue calls use the right tokens, and the "failing" issue is created once, edited, then closed.
 */
import { describe, test, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve(import.meta.dirname, "audit-fix.sh");
const BRANCH = "fix/security-advisories";
const PR_TITLE = "fix(deps): patch security advisories (automated)";
const ISSUE_TITLE = "Security check is failing and cannot be fixed automatically";

// Mirror CI: no ambient git identity, signing config or system config. The script must set its own commit identity.
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
const SETUP_ID = ["-c", "user.name=setup", "-c", "user.email=setup@example.invalid"];

const lock = (pkgs) =>
  JSON.stringify({ name: "app", lockfileVersion: 3, packages: { "": { name: "app", version: "1.0.0" }, ...pkgs } }, null, 2) + "\n";
const BASE = {
  "node_modules/lodash": { version: "4.17.20" },
  "node_modules/some-test-tool": { version: "2.0.0", dev: true },
};
const BUMPED = { ...BASE, "node_modules/lodash": { version: "4.17.21" } };

const AUDIT_JSON = JSON.stringify({
  vulnerabilities: {
    lodash: {
      name: "lodash",
      severity: "high",
      via: [{ source: 1, name: "lodash", title: "Prototype Pollution", url: "https://github.com/advisories/GHSA-test-1234", severity: "high" }],
    },
    semver: { name: "semver", severity: "moderate", via: [{ url: "https://github.com/advisories/GHSA-moderate", severity: "moderate" }] },
  },
});

// Each stub appends one line to $STUB_LOG, which lives outside the repo so it never shows up in `git status`.
const STUBS = {
  // The real `npm audit fix` exits 1 while any advisory stays unfixed; the script must ignore that.
  npx: `echo "npx $*" >> "$STUB_LOG"
[ -z "\${STUB_LOCK_AFTER:-}" ] || cp "$STUB_LOCK_AFTER" package-lock.json
[ -z "\${STUB_DIRTY_FILE:-}" ] || echo changed >> "$STUB_DIRTY_FILE"
exit 1`,
  npm: `echo "npm $*" >> "$STUB_LOG"
case " $* " in *" --json "*) cat "\${STUB_AUDIT_JSON:-/dev/null}" ;; esac
exit "\${STUB_AUDIT_EXIT:-0}"`,
  gh: `echo "gh[$GH_TOKEN] $*" >> "$STUB_LOG"
while [ $# -gt 0 ]; do [ "$1" != --body-file ] || cp "$2" "$STUB_OUT/body-$GH_SUB.md"; shift; done
case "$GH_SUB" in
  "pr list") echo "\${STUB_OPEN_PR:-}" ;;
  "pr create") echo "https://github.com/o/r/pull/9" ;;
  "issue list") echo "\${STUB_ISSUES:-[]}" ;;
esac`,
};

/**
 * Build the throwaway repo + stubs, run the script once, and return what happened.
 * The repo carries a stub scripts/release/check-push-target.sh: the real check (tested in
 * scripts/release/check-push-target.test.mjs) correctly refuses a local bare `origin`, and the script calls
 * it by a cwd-relative path, so the production script needs no test-only switch.
 */
function run({ lockAfter, dirtyFile, pushCheck = 0, openPr = "", issues = [], auditExit = 0, auditJson, staleBranch = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "audit-fix-"));
  const [bare, work, bin, out] = ["origin.git", "work", "bin", "out"].map((d) => join(root, d));
  const log = join(root, "calls.log");
  for (const d of [work, bin, out]) mkdirSync(d, { recursive: true });
  const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: GIT_ENV, encoding: "utf8" }).trim();

  git(root, "init", "-q", "--bare", "-b", "dev", bare);
  git(root, "init", "-q", "-b", "dev", work);
  mkdirSync(join(work, "scripts/release"), { recursive: true });
  writeFileSync(join(work, "package.json"), '{"name":"app"}\n');
  writeFileSync(join(work, "package-lock.json"), lock(BASE));
  writeFileSync(join(work, "scripts/release/check-push-target.sh"), 'echo "check-push-target $*" >> "$STUB_LOG"\nexit "${STUB_PUSH_CHECK:-0}"\n');
  git(work, "add", ".");
  git(work, ...SETUP_ID, "commit", "-q", "-m", "init");
  git(work, "remote", "add", "origin", bare);
  git(work, "push", "-q", "origin", "dev");
  if (staleBranch) {
    // A leftover branch from an earlier run, now behind dev: the script must replace it, not extend it.
    git(work, "switch", "-q", "-c", BRANCH);
    writeFileSync(join(work, "stale.txt"), "old run\n");
    git(work, "add", ".");
    git(work, ...SETUP_ID, "commit", "-q", "-m", "stale");
    git(work, "push", "-q", "origin", BRANCH);
    git(work, "switch", "-q", "dev");
    git(work, "branch", "-q", "-D", BRANCH);
    writeFileSync(join(work, "newer.txt"), "dev moved on\n");
    git(work, "add", ".");
    git(work, ...SETUP_ID, "commit", "-q", "-m", "dev moved on");
    git(work, "push", "-q", "origin", "dev");
  }

  for (const [name, body] of Object.entries(STUBS)) {
    const file = join(bin, name);
    // gh: expose "<noun> <verb>" so the stub can switch on it without re-parsing flags.
    const prelude = name === "gh" ? 'GH_SUB="$1 $2"\n' : "";
    writeFileSync(file, `#!/usr/bin/env bash\n${prelude}${body}\n`);
    chmodSync(file, 0o755);
  }
  const lockAfterFile = join(root, "lock-after.json");
  if (lockAfter) writeFileSync(lockAfterFile, lock(lockAfter));
  const auditJsonFile = join(root, "audit.json");
  if (auditJson) writeFileSync(auditJsonFile, auditJson);

  const env = {
    ...GIT_ENV,
    PATH: `${bin}:${process.env.PATH}`,
    GITHUB_REPOSITORY: "o/r",
    GH_TOKEN: "app-token",
    ISSUE_TOKEN: "issue-token",
    STUB_LOG: log,
    STUB_OUT: out,
    STUB_PUSH_CHECK: String(pushCheck),
    STUB_AUDIT_EXIT: String(auditExit),
    STUB_OPEN_PR: openPr,
    STUB_ISSUES: JSON.stringify(issues),
    ...(lockAfter && { STUB_LOCK_AFTER: lockAfterFile }),
    ...(dirtyFile && { STUB_DIRTY_FILE: dirtyFile }),
    ...(auditJson && { STUB_AUDIT_JSON: auditJsonFile }),
  };
  const r = spawnSync("bash", [script], { cwd: work, env, encoding: "utf8" });
  const lines = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
  const read = (f) => (existsSync(join(out, f)) ? readFileSync(join(out, f), "utf8") : "");
  return {
    status: r.status,
    stderr: r.stderr,
    /** Logged stub calls whose line matches `re`. */
    calls: (re) => lines.filter((l) => re.test(l)),
    /** Branches that exist on origin. */
    remoteBranches: () => git(bare, "for-each-ref", "--format=%(refname:short)", "refs/heads").split("\n").sort(),
    remote: (...a) => git(bare, ...a),
    /** `git status --porcelain` of the working checkout after the run. */
    dirty: () => git(work, "status", "--porcelain"),
    prBody: read("body-pr create.md"),
    issueBody: read("body-issue create.md") || read("body-issue edit.md"),
  };
}

describe("audit-fix.sh: nothing worth shipping", () => {
  test("no change and a green check: no push, no PR, no issue", () => {
    const r = run();
    expect(r.status).toBe(0);
    expect(r.remoteBranches()).toEqual(["dev"]);
    expect(r.calls(/ pr /)).toEqual([]);
    expect(r.calls(/ issue (create|edit|close)/)).toEqual([]);
    expect(r.dirty()).toBe("");
    // The write goes through npm 11, never the bundled npm 10 (#752/#753); the check runs exactly as CI runs it.
    expect(r.calls(/^npx/)).toEqual(["npx -y npm@11 audit fix --package-lock-only --ignore-scripts"]);
    expect(r.calls(/^npm/)).toEqual(["npm audit --audit-level=high --omit=dev"]);
  });

  test("lockfile churn with no version change is dropped: lockfile restored, nothing pushed", () => {
    const churned = { ...BASE, "node_modules/lodash": { version: "4.17.20", resolved: "https://registry.npmjs.org/lodash", integrity: "sha512-x" } };
    const r = run({ lockAfter: churned });
    expect(r.status).toBe(0);
    expect(r.remoteBranches()).toEqual(["dev"]);
    expect(r.calls(/ pr /)).toEqual([]);
    expect(r.dirty()).toBe("");
  });
});

describe("audit-fix.sh: a fix is available", () => {
  test("pushes only package-lock.json on a fresh branch, opens one PR into dev and queues auto-merge", () => {
    // Also proves the dev-flag guard lets a NEW package carry dev:true (only packages present before are checked).
    const r = run({ lockAfter: { ...BUMPED, "node_modules/new-dev-tool": { version: "1.0.0", dev: true } } });
    expect(r.status).toBe(0);
    expect(r.remoteBranches()).toEqual(["dev", BRANCH]);
    expect(r.remote("diff", "--name-only", "dev", BRANCH)).toBe("package-lock.json");
    expect(r.remote("rev-parse", `${BRANCH}^`)).toBe(r.remote("rev-parse", "dev"));
    expect(r.remote("log", "-1", "--format=%s", BRANCH)).toBe(PR_TITLE);
    expect(r.calls(/^check-push-target o\/r$/)).toHaveLength(1);

    const created = r.calls(/ pr create /);
    expect(created).toHaveLength(1);
    expect(created[0]).toContain("--base dev");
    expect(created[0]).toContain(`--head ${BRANCH}`);
    expect(created[0]).toContain(PR_TITLE);
    expect(r.calls(/ pr merge /)).toEqual(["gh[app-token] pr merge --auto --squash https://github.com/o/r/pull/9"]);
    expect(r.calls(/ pr /).every((l) => l.startsWith("gh[app-token]"))).toBe(true);
    expect(r.prBody).toContain("| lodash | 4.17.20 | 4.17.21 |");
    expect(r.prBody).toContain("| new-dev-tool | - | 1.0.0 |");
  });

  // The stub prints what `gh pr list --jq` would: "<number> <auto-merge already on?>".
  test.each([
    // Left open by a run that died before switching auto-merge on: switch it on now, or nothing ever merges it.
    ["42 false", ["gh[app-token] pr merge --auto --squash 42"]],
    ["42 true", []],
  ])("a PR is already open (%s): no second PR, stale branch is replaced", (openPr, merges) => {
    const r = run({ lockAfter: BUMPED, openPr, staleBranch: true });
    expect(r.status).toBe(0);
    expect(r.calls(/ pr create /)).toEqual([]);
    expect(r.calls(/ pr merge /)).toEqual(merges);
    expect(r.remote("rev-parse", `${BRANCH}^`)).toBe(r.remote("rev-parse", "dev"));
    expect(r.remote("diff", "--name-only", "dev", BRANCH)).toBe("package-lock.json");
  });
});

describe("audit-fix.sh: guards stop a bad push", () => {
  test.each([
    ["another file was modified", { lockAfter: BUMPED, dirtyFile: "package.json" }],
    // The #752 regression: production-reachable packages flagged dev:true hide from `npm audit --omit=dev`.
    ["a package gains dev:true", { lockAfter: { ...BUMPED, "node_modules/lodash": { version: "4.17.21", dev: true } } }],
    ["the push-target check fails", { lockAfter: BUMPED, pushCheck: 1 }],
  ])("%s: non-zero exit, nothing pushed, no PR", (_name, opts) => {
    const r = run(opts);
    expect(r.status).not.toBe(0);
    expect(r.remoteBranches()).toEqual(["dev"]);
    expect(r.calls(/ pr (create|merge)/)).toEqual([]);
  });
});

describe("audit-fix.sh: the failing-check issue", () => {
  const failing = { auditExit: 1, auditJson: AUDIT_JSON };

  test("creates one issue (issue token only) naming the high/critical packages when none is open", () => {
    const r = run({ ...failing, issues: [{ number: 5, title: "Something else" }] });
    expect(r.status).toBe(0);
    const created = r.calls(/ issue create /);
    expect(created).toHaveLength(1);
    expect(created[0]).toContain(ISSUE_TITLE);
    expect(r.calls(/ issue edit /)).toEqual([]);
    expect(r.calls(/ issue /).every((l) => l.startsWith("gh[issue-token]"))).toBe(true);
    expect(r.issueBody).toContain("lodash");
    expect(r.issueBody).toContain("https://github.com/advisories/GHSA-test-1234");
    expect(r.issueBody).not.toContain("semver"); // moderate: not what the check fails on
  });

  test("edits the open issue instead of making a second one", () => {
    const r = run({ ...failing, issues: [{ number: 5, title: "Something else" }, { number: 7, title: ISSUE_TITLE }] });
    expect(r.status).toBe(0);
    expect(r.calls(/ issue create /)).toEqual([]);
    expect(r.calls(/ issue edit 7 /)).toHaveLength(1);
    expect(r.calls(/ issue edit /)).toHaveLength(1);
  });

  test("an audit that fails without naming a package (registry error) is a red run, not an issue", () => {
    const r = run({ auditExit: 1, auditJson: JSON.stringify({ error: { code: "ENOTFOUND" } }) });
    expect(r.status).not.toBe(0);
    expect(r.calls(/ issue (create|edit)/)).toEqual([]);
  });

  test("closes the open issue (and only that one) once the check passes", () => {
    const r = run({ issues: [{ number: 5, title: "Something else" }, { number: 7, title: ISSUE_TITLE }] });
    expect(r.status).toBe(0);
    expect(r.calls(/ issue close /)).toHaveLength(1);
    expect(r.calls(/ issue close 7 /)).toHaveLength(1);
    expect(r.calls(/ issue (create|edit)/)).toEqual([]);
  });
});
