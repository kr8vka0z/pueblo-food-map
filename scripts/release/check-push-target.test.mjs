/** check-push-target.test.mjs — guards the release push-target check: the URL shapes the real job produces must pass, any retarget must fail. */
import { describe, test, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve(import.meta.dirname, "check-push-target.sh");
const REPO = "kr8vka0z/pueblo-food-map";

/** Exit code of the check in a throwaway repo whose origin is `url`. */
function run(url, config = []) {
  const cwd = mkdtempSync(join(tmpdir(), "push-target-"));
  const git = (...a) => execFileSync("git", a, { cwd });
  git("init", "-q");
  git("remote", "add", "origin", url);
  for (const [k, v] of config) git("config", k, v);
  return spawnSync("bash", [script, REPO], { cwd }).status;
}

describe("check-push-target", () => {
  test("passes for the URLs the job really has", () => {
    // claude-code-action's default: token embedded in the remote URL.
    expect(run(`https://x-access-token:ghs_abc@github.com/${REPO}.git`)).toBe(0);
    // Its credential-helper mode, and plain actions/checkout.
    expect(run(`https://github.com/${REPO}.git`)).toBe(0);
    expect(run(`https://github.com/${REPO}`)).toBe(0);
    expect(run("https://github.com/Kr8vka0z/Pueblo-Food-Map.git")).toBe(0);
  });

  test("fails when the push would go anywhere else", () => {
    expect(run(`https://x-access-token:ghs_abc@evil.example/${REPO}.git`)).toBe(1);
    expect(run("https://github.com/evil/pueblo-food-map.git")).toBe(1);
    expect(run(`https://github.com@evil.example/${REPO}.git`)).toBe(1);
    expect(run(`https://github.com/${REPO}.git/../../evil/x`)).toBe(1);
    expect(run(`git@github.com:${REPO}.git`)).toBe(1);
    // A dot in the name must be literal, not "any character".
    expect(run("https://github.com/kr8vka0z/pueblo-foodXmap.git")).toBe(1);
  });

  test("fails when a rewrite rule redirects the push", () => {
    expect(
      run(`https://github.com/${REPO}.git`, [["url.https://evil.example/.insteadOf", "https://github.com/"]]),
    ).toBe(1);
    expect(
      run(`https://github.com/${REPO}.git`, [["url.https://evil.example/.pushInsteadOf", "https://github.com/"]]),
    ).toBe(1);
  });
});
