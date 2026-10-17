/**
 * audit-fix.test.mjs — drives the real scripts/security/audit-fix.sh in a throwaway git repo (with a local bare repo as `origin`, so the push is real)
 * and stub `npx` / `npm` / `gh` first on PATH. The stubs are small simulators: `npm audit` fails while the lockfile in the working directory holds a
 * "vulnerable" name@version, and `gh pr list` / `gh issue list` run the script's own `--jq` program (real jq) over fixture JSON.
 * Guards the risky parts: nothing ships unless the fix turns the required check green, only a same-repo PR is ever reused, the PR and issue calls
 * use the right tokens, and the one bot-owned issue follows dev's own lockfile (created once, edited, closed; a human's look-alike is never touched).
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
  "node_modules/minimist": { version: "1.2.0" },
  "node_modules/some-test-tool": { version: "2.0.0", dev: true },
};
const BUMPED = { ...BASE, "node_modules/lodash": { version: "4.17.21" } };
// Vulnerable name@version lists the npm stub fails the check on. FIXABLE is cured by BUMPED; PARTIAL still fails after it (minimist has no fix).
const FIXABLE = "lodash@4.17.20";
const PARTIAL = "lodash@4.17.20,minimist@1.2.0";

const pr = (number, extra = {}) => ({ number, headRefName: BRANCH, isCrossRepository: false, autoMergeRequest: null, ...extra });
const botIssue = (number) => ({ number, title: ISSUE_TITLE, author: { is_bot: true } });
const humanIssue = (number) => ({ number, title: ISSUE_TITLE, author: { is_bot: false } });

// Each stub appends one line to $STUB_LOG, which lives outside the repo so it never shows up in `git status`.
const STUBS = {
  // The real `npm audit fix` exits 1 while any advisory stays unfixed; the script must ignore that.
  npx: `echo "npx $*" >> "$STUB_LOG"
[ -z "\${STUB_NPX_STDERR:-}" ] || echo "$STUB_NPX_STDERR" >&2
[ -z "\${STUB_LOCK_AFTER:-}" ] || cp "$STUB_LOCK_AFTER" package-lock.json
[ -z "\${STUB_DIRTY_FILE:-}" ] || echo changed >> "$STUB_DIRTY_FILE"
exit 1`,
  // Fails (exit 1) while package-lock.json in the cwd holds a name@version listed in STUB_VULN; --json names them like npm does.
  npm: `echo "npm $*" >> "$STUB_LOG"
if [ -n "\${STUB_AUDIT_BROKEN:-}" ]; then
  case " $* " in *" --json "*) echo '{"error":{"code":"ENOTFOUND"}}' ;; esac
  exit 1
fi
out=$(jq -c --arg v "\${STUB_VULN:-}" '
  [.packages | to_entries[] | select(.key != "") | {n: (.key | sub("^.*node_modules/"; "")), v: .value.version}] as $have
  | ($v | split(",")) as $bad
  | [$have[] | select((.n + "@" + .v) as $id | $bad | any(. == $id))]
  | {vulnerabilities: (map({key: .n, value: {name: .n, severity: "high", via: [{url: ("https://advisories.test/" + .n)}]}}) | from_entries)}' package-lock.json)
case " $* " in *" --json "*) echo "$out" ;; esac
[ "$(echo "$out" | jq '.vulnerabilities | length')" = 0 ]`,
  gh: `echo "gh[$GH_TOKEN] $*" >> "$STUB_LOG"
args=("$@"); head=""; prog="."
for ((i = 0; i < \${#args[@]}; i++)); do
  case "\${args[i]}" in
    --head) head="\${args[i+1]}" ;;
    --jq) prog="\${args[i+1]}" ;;
    --body-file) cp "\${args[i+1]}" "$STUB_OUT/body-$GH_SUB.md" ;;
  esac
done
case "$GH_SUB" in
  "pr list") printf '%s' "\${STUB_PRS:-[]}" | jq --arg h "$head" '[.[] | select(.headRefName == $h)]' | jq -r "$prog" ;;
  "pr create") echo "https://github.com/o/r/pull/9" ;;
  "issue list") printf '%s' "\${STUB_ISSUES:-[]}" ;;
esac`,
};

/**
 * Build the throwaway repo + stubs, run the script once, and return what happened.
 * The repo carries a stub scripts/release/check-push-target.sh: the real check (tested in
 * scripts/release/check-push-target.test.mjs) correctly refuses a local bare `origin`, and the script calls
 * it by a cwd-relative path, so the production script needs no test-only switch.
 */
function run({ lockAfter, dirtyFile, pushCheck = 0, prs = [], issues = [], vuln = "", auditBroken = false, npxStderr = "", staleBranch = false } = {}) {
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

  const env = {
    ...GIT_ENV,
    PATH: `${bin}:${process.env.PATH}`,
    GITHUB_REPOSITORY: "o/r",
    GH_TOKEN: "app-token",
    ISSUE_TOKEN: "issue-token",
    STUB_LOG: log,
    STUB_OUT: out,
    STUB_PUSH_CHECK: String(pushCheck),
    STUB_VULN: vuln,
    STUB_PRS: JSON.stringify(prs),
    STUB_ISSUES: JSON.stringify(issues),
    ...(auditBroken && { STUB_AUDIT_BROKEN: "1" }),
    ...(npxStderr && { STUB_NPX_STDERR: npxStderr }),
    ...(lockAfter && { STUB_LOCK_AFTER: lockAfterFile }),
    ...(dirtyFile && { STUB_DIRTY_FILE: dirtyFile }),
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

const ISSUE_WRITES = / issue (create|edit|close)/;
const PR_WRITES = / pr (create|merge|close)/;

describe("audit-fix.sh: nothing worth shipping", () => {
  test("no change and a green check: no push, no PR, no issue, one audit", () => {
    const r = run();
    expect(r.status).toBe(0);
    expect(r.remoteBranches()).toEqual(["dev"]);
    expect(r.calls(PR_WRITES)).toEqual([]);
    expect(r.calls(ISSUE_WRITES)).toEqual([]);
    expect(r.dirty()).toBe("");
    // Pinned npm 11 for the write (#752/#753), production deps only, 3-day release age; the check runs as CI runs it, once.
    expect(r.calls(/^npx/)).toEqual(["npx -y npm@11.21.0 audit fix --package-lock-only --ignore-scripts --omit=dev --min-release-age=3"]);
    expect(r.calls(/^npm/)).toEqual(["npm audit --audit-level=high --omit=dev"]);
    // The open-PR lookup must ask for this branch into dev (a wrong --head would miss the bot's own PR).
    const listed = r.calls(/ pr list /);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toContain(`--head ${BRANCH} --base dev`);
  });

  test("lockfile churn with no version change is dropped: lockfile restored, nothing pushed", () => {
    const churned = { ...BASE, "node_modules/lodash": { version: "4.17.20", resolved: "https://registry.npmjs.org/lodash", integrity: "sha512-x" } };
    const r = run({ lockAfter: churned });
    expect(r.status).toBe(0);
    expect(r.remoteBranches()).toEqual(["dev"]);
    expect(r.calls(PR_WRITES)).toEqual([]);
    expect(r.dirty()).toBe("");
  });

  test("nothing to fix and the bot's own PR is still open: it is superseded and closed with its branch", () => {
    const r = run({ prs: [pr(42)] });
    expect(r.status).toBe(0);
    expect(r.calls(/ pr close 42 --delete-branch /)).toHaveLength(1);
    expect(r.calls(/ pr (create|merge)/)).toEqual([]);
  });

  test("a fork PR from a branch with the same name is never closed", () => {
    const r = run({ prs: [pr(43, { isCrossRepository: true })] });
    expect(r.status).toBe(0);
    expect(r.calls(PR_WRITES)).toEqual([]);
  });
});

describe("audit-fix.sh: a fix turns the check green", () => {
  test("pushes only package-lock.json on a fresh branch, opens one PR into dev, arms auto-merge on that commit, raises no issue", () => {
    // dev is red (FIXABLE) and this run just created the fix PR: it is minutes from merging, so no issue either way.
    const r = run({ lockAfter: { ...BUMPED, "node_modules/new-tool": { version: "1.0.0" } }, vuln: FIXABLE });
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
    // Never merge content this run did not just push.
    expect(r.calls(/ pr merge /)).toEqual([
      `gh[app-token] pr merge --auto --squash --match-head-commit ${r.remote("rev-parse", BRANCH)} https://github.com/o/r/pull/9`,
    ]);
    expect(r.calls(/ pr /).every((l) => l.startsWith("gh[app-token]"))).toBe(true);
    expect(r.prBody).toContain("| lodash | 4.17.20 | 4.17.21 |");
    expect(r.prBody).toContain("| new-tool | - | 1.0.0 |");
    expect(r.calls(ISSUE_WRITES)).toEqual([]);
  });

  // The stub's `gh pr list` runs the script's own --jq over this fixture, so a flipped condition changes the outcome.
  test.each([
    // Left open by a run that died before arming auto-merge: arm it now, or nothing ever merges it.
    [false, 1],
    [true, 0],
  ])("a same-repo PR is already open (auto-merge on: %s): no second PR, stale branch replaced, armed %i time(s)", (on, merges) => {
    const r = run({ lockAfter: BUMPED, prs: [pr(42, { autoMergeRequest: on ? { enabledAt: "x" } : null })], staleBranch: true });
    expect(r.status).toBe(0);
    expect(r.calls(/ pr create /)).toEqual([]);
    const armed = r.calls(/ pr merge /);
    expect(armed).toHaveLength(merges);
    armed.forEach((l) => expect(l).toContain(`--match-head-commit ${r.remote("rev-parse", BRANCH)} 42`));
    expect(r.remote("rev-parse", `${BRANCH}^`)).toBe(r.remote("rev-parse", "dev"));
    expect(r.remote("diff", "--name-only", "dev", BRANCH)).toBe("package-lock.json");
  });

  test("a PR from a fork with the same branch name is neither reused nor armed: a new PR is created", () => {
    const r = run({ lockAfter: BUMPED, prs: [pr(43, { isCrossRepository: true })], vuln: FIXABLE });
    expect(r.status).toBe(0);
    expect(r.calls(/ pr create /)).toHaveLength(1);
    expect(r.calls(/ pr (merge|close) /).filter((l) => /\b43\b/.test(l))).toEqual([]);
    expect(r.calls(/ pr merge /)).toHaveLength(1);
  });

  test.each([
    ["no issue is open", [], "create"],
    ["the bot's issue is open (kept open, edited)", [botIssue(7)], "edit 7"],
  ])("fix PR already open at the start and dev still red (%s): the issue names the PR", (_n, issues, verb) => {
    const r = run({ lockAfter: BUMPED, prs: [pr(42)], vuln: FIXABLE, issues });
    expect(r.status).toBe(0);
    expect(r.calls(new RegExp(` issue ${verb} `))).toHaveLength(1);
    expect(r.calls(/ issue close /)).toEqual([]);
    expect(r.issueBody).toContain("#42");
  });
});

describe("audit-fix.sh: guards stop a bad push", () => {
  test.each([
    ["another file was modified", { lockAfter: BUMPED, dirtyFile: "package.json" }],
    ["the push-target check fails", { lockAfter: BUMPED, pushCheck: 1 }],
  ])("%s: non-zero exit, nothing pushed, no PR", (_name, opts) => {
    const r = run({ ...opts, vuln: FIXABLE });
    expect(r.status).not.toBe(0);
    expect(r.remoteBranches()).toEqual(["dev"]);
    expect(r.calls(PR_WRITES)).toEqual([]);
  });
});

describe("audit-fix.sh: a fix that would not turn the check green is not shipped", () => {
  test("no push, no PR; the issue lists what still fails and the fixable rows", () => {
    const r = run({ lockAfter: BUMPED, vuln: PARTIAL });
    expect(r.status).toBe(0);
    expect(r.remoteBranches()).toEqual(["dev"]);
    expect(r.calls(PR_WRITES)).toEqual([]);
    expect(r.dirty()).toBe("");
    expect(r.calls(/ issue create /)).toHaveLength(1);
    // minimist is named twice: failing on dev now, and still failing after the fix.
    expect(r.issueBody.match(/advisories\.test\/minimist/g)).toHaveLength(2);
    expect(r.issueBody).toContain("| lodash | 4.17.20 | 4.17.21 |"); // what the fixer could do
  });

  test("a same-repo bot PR left open from an earlier run is closed with its branch", () => {
    const r = run({ lockAfter: BUMPED, vuln: PARTIAL, prs: [pr(42)] });
    expect(r.status).toBe(0);
    expect(r.calls(/ pr close 42 --delete-branch /)).toHaveLength(1);
    expect(r.calls(/ pr (create|merge) /)).toEqual([]);
    expect(r.remoteBranches()).toEqual(["dev"]);
  });
});

describe("audit-fix.sh: the failing-check issue", () => {
  test("creates one issue (issue token only) naming the failing packages; a human's look-alike issue is not touched", () => {
    const r = run({ vuln: FIXABLE, issues: [humanIssue(5)] });
    expect(r.status).toBe(0);
    const created = r.calls(/ issue create /);
    expect(created).toHaveLength(1);
    expect(created[0]).toContain(ISSUE_TITLE);
    expect(r.calls(/ issue (edit|close) /)).toEqual([]);
    expect(r.calls(/ issue /).every((l) => l.startsWith("gh[issue-token]"))).toBe(true);
    expect(r.issueBody).toContain("lodash");
    expect(r.issueBody).toContain("https://advisories.test/lodash");
  });

  test("edits the bot's open issue instead of making a second one", () => {
    const r = run({ vuln: FIXABLE, issues: [humanIssue(5), botIssue(7)] });
    expect(r.status).toBe(0);
    expect(r.calls(/ issue create /)).toEqual([]);
    expect(r.calls(/ issue edit /)).toHaveLength(1);
    expect(r.calls(/ issue edit 7 /)).toHaveLength(1);
    expect(r.calls(/ issue /).every((l) => l.startsWith("gh[issue-token]"))).toBe(true);
  });

  test("a fix held back by the 3-day release age is passed on in the issue", () => {
    const warning = "npm warn audit fix lodash@4.17.21 was held back: published after the configured release-age cutoff";
    const r = run({ vuln: FIXABLE, npxStderr: warning });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain(warning);
    expect(r.issueBody).toContain(warning);
  });

  test("an audit that fails without naming a package (registry error) is a red run, not an issue", () => {
    const r = run({ auditBroken: true });
    expect(r.status).not.toBe(0);
    expect(r.calls(/ issue (create|edit)/)).toEqual([]);
  });

  test("closes the bot's open issue (and only that one) once dev's own lockfile passes", () => {
    const r = run({ issues: [humanIssue(5), botIssue(7)] });
    expect(r.status).toBe(0);
    expect(r.calls(/ issue close /)).toHaveLength(1);
    expect(r.calls(/ issue close 7 /)).toHaveLength(1);
    expect(r.calls(/ issue (create|edit)/)).toEqual([]);
    expect(r.calls(/ issue /).every((l) => l.startsWith("gh[issue-token]"))).toBe(true);
  });

  test("a human's look-alike issue alone is never closed", () => {
    const r = run({ issues: [humanIssue(5)] });
    expect(r.status).toBe(0);
    expect(r.calls(ISSUE_WRITES)).toEqual([]);
  });
});
