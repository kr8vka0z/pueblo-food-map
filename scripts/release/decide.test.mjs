/** decide.test.mjs — guards what a cut may do: open, update, leave alone or refuse a release PR. */
import { describe, test, expect } from "vitest";
import { decideCut, isMaintenanceOnly } from "./decide.mjs";

const pr = (headRefName, number = 7) => ({ number, url: `https://example.test/pull/${number}`, headRefName });
const base = {
  devTree: "tree-dev",
  mainTree: "tree-main",
  prs: [],
  syncUrls: [],
  cutSha: "new",
  recordedCut: "",
  forcedVersion: "",
  versionIsLive: false,
};
const decide = (over) => decideCut({ ...base, ...over });

describe("decideCut", () => {
  test("same files on dev and main: no PR, even if a sync PR is open", () => {
    expect(decide({ devTree: "t", mainTree: "t", syncUrls: ["sync"] }).action).toBe("nothing");
  });

  test("same files with a release PR open: leaves that PR alone and names it", () => {
    const d = decide({ devTree: "t", mainTree: "t", prs: [pr("release/v1.4.0")], recordedCut: "old" });
    expect(d.action).toBe("nothing");
    expect(d.message).toContain("/pull/7");
  });

  test("files differ and nothing is open: a new release", () => {
    expect(decide({ forcedVersion: "2.0.0" })).toMatchObject({ action: "new", version: "2.0.0" });
  });

  test("a stuck sync PR blocks a new cut and a repeat cut", () => {
    expect(decide({ syncUrls: ["sync"] }).action).toBe("blocked");
    expect(decide({ syncUrls: ["sync"], prs: [pr("release/v1.4.0")], recordedCut: "new" }).action).toBe("blocked");
  });

  test("repeat cut on the commit already recorded: changes nothing", () => {
    const d = decide({ prs: [pr("release/v1.4.0")], recordedCut: "new" });
    expect(d).toMatchObject({ action: "same", prNumber: 7, version: "1.4.0" });
  });

  test("repeat cut after dev moved: updates in place with the branch's version", () => {
    const d = decide({ prs: [pr("release/v1.4.0")], recordedCut: "old" });
    expect(d).toMatchObject({ action: "update", prNumber: 7, version: "1.4.0" });
  });

  test("refuses to change an open PR's version, since its branch cannot be renamed", () => {
    const d = decide({ prs: [pr("release/v1.4.0")], recordedCut: "old", forcedVersion: "2.0.0" });
    expect(d.action).toBe("blocked");
  });

  test("refuses to reuse a version a hotfix already took live", () => {
    expect(decide({ prs: [pr("release/v1.3.3")], recordedCut: "old", versionIsLive: true }).action).toBe("blocked");
  });

  test("refuses two open release PRs and a branch with no version in its name", () => {
    expect(decide({ prs: [pr("release/v1.4.0", 7), pr("release/v1.5.0", 8)] }).action).toBe("blocked");
    expect(decide({ prs: [pr("release/next")] }).action).toBe("blocked");
  });
});

describe("isMaintenanceOnly", () => {
  test("true only when every changed file is a dependency or CI file", () => {
    expect(isMaintenanceOnly(["package.json", "package-lock.json", ".github/workflows/ci.yml"])).toBe(true);
    expect(isMaintenanceOnly(["package-lock.json", "src/app/page.tsx"])).toBe(false);
    expect(isMaintenanceOnly(["scripts/package.json"])).toBe(false);
    expect(isMaintenanceOnly([])).toBe(false);
  });
});
