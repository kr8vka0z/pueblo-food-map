/** prepare.test.mjs — guards the semver rule (feat -> minor, else patch, major only by override) and the noise filter. */
import { describe, test, expect } from "vitest";
import { nextVersion, parseSubject, isNoise } from "./prepare.mjs";

const items = (...s) => s.map(parseSubject);

describe("nextVersion", () => {
  test("patch when no feat", () => {
    expect(nextVersion("1.2.3", items("fix: a (#1)", "chore(deps): b (#2)"))).toBe("1.2.4");
  });
  test("minor when any feat", () => {
    expect(nextVersion("1.2.3", items("fix: a (#1)", "feat(map): b (#2)"))).toBe("1.3.0");
  });
  test("a ! title never bumps major by itself", () => {
    expect(nextVersion("1.2.3", items("feat!: a (#1)"))).toBe("1.3.0");
    expect(nextVersion("1.2.3", items("fix!: a (#1)"))).toBe("1.2.4");
  });
  test("override wins and is validated", () => {
    expect(nextVersion("0.1.7", items("fix: a"), { override: "1.0.0" })).toBe("1.0.0");
    expect(() => nextVersion("0.1.7", [], { override: "v1" })).toThrow();
  });
});

describe("parseSubject", () => {
  test("extracts type and PR number", () => {
    expect(parseSubject("feat(x)!: y (#12)")).toMatchObject({ type: "feat", pr: 12 });
    expect(parseSubject("Merge stuff")).toMatchObject({ type: "other", pr: null });
  });
});

describe("isNoise", () => {
  test("drops sync merges and the release commit, keeps real work", () => {
    expect(isNoise("Merge pull request #9 from kr8vka0z/sync/main-abc1234")).toBe(true);
    expect(isNoise("chore(release): v1.2.0")).toBe(true);
    expect(isNoise("chore(release): weekly release pipeline (#720)")).toBe(false);
    expect(isNoise("fix(map): pins (#5)")).toBe(false);
  });
});
