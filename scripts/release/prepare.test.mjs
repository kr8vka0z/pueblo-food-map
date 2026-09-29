/** prepare.test.mjs — guards the semver rule: feat -> minor, else patch, major only when asked. */
import { describe, test, expect } from "vitest";
import { nextVersion, parseSubject } from "./prepare.mjs";

const items = (...s) => s.map(parseSubject);

describe("nextVersion", () => {
  test("patch when no feat", () => {
    expect(nextVersion("1.2.3", items("fix: a (#1)", "chore(deps): b (#2)"))).toBe("1.2.4");
  });
  test("minor when any feat", () => {
    expect(nextVersion("1.2.3", items("fix: a (#1)", "feat(map): b (#2)"))).toBe("1.3.0");
  });
  test("breaking does not bump major without allowMajor", () => {
    expect(nextVersion("1.2.3", items("feat!: a (#1)"))).toBe("1.3.0");
    expect(nextVersion("1.2.3", items("fix!: a (#1)"))).toBe("1.2.4");
  });
  test("major with allowMajor, via ! or BREAKING CHANGE body", () => {
    expect(nextVersion("1.2.3", items("feat!: a (#1)"), { allowMajor: true })).toBe("2.0.0");
    expect(nextVersion("1.2.3", [{ type: "fix", body: "BREAKING CHANGE: x" }], { allowMajor: true })).toBe("2.0.0");
  });
  test("override wins and is validated", () => {
    expect(nextVersion("0.1.7", items("fix: a"), { override: "1.0.0" })).toBe("1.0.0");
    expect(() => nextVersion("0.1.7", [], { override: "v1" })).toThrow();
  });
});

describe("parseSubject", () => {
  test("extracts type, breaking, PR number", () => {
    expect(parseSubject("feat(x)!: y (#12)")).toMatchObject({ type: "feat", breaking: true, pr: 12 });
    expect(parseSubject("Merge stuff")).toMatchObject({ type: "other", pr: null });
  });
});
