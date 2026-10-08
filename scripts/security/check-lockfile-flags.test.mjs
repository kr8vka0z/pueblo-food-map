/** check-lockfile-flags.test.mjs — guards the walk behind the CVE audit's dev-flag check: it must catch the npm 10 mislabel (e527456) without flagging packages only dev tooling reaches. */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hiddenProductionPackages } from "./check-lockfile-flags.mjs";

/** Minimal lockfile: `root` is packages[""], `pkgs` maps lockfile paths to entries. */
const lock = (root, pkgs) => ({ packages: { "": root, ...pkgs } });

describe("hiddenProductionPackages", () => {
  test("the repo's real lockfile has no offenders", () => {
    const real = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../package-lock.json"), "utf8"));
    expect(hiddenProductionPackages(real)).toEqual([]);
  });

  test("reports a production dependency's optional dependency flagged dev (the sharp incident)", () => {
    const l = lock(
      { dependencies: { sharp: "1" } },
      {
        "node_modules/sharp": { optionalDependencies: { "@img/sharp-linux-x64": "1" } },
        "node_modules/@img/sharp-linux-x64": { dev: true, optional: true },
      },
    );
    expect(hiddenProductionPackages(l)).toEqual(["node_modules/@img/sharp-linux-x64"]);
  });

  test("ignores packages only devDependencies reach", () => {
    const l = lock(
      { devDependencies: { tool: "1" } },
      {
        "node_modules/tool": { dev: true, dependencies: { helper: "1" } },
        "node_modules/helper": { dev: true },
      },
    );
    expect(hiddenProductionPackages(l)).toEqual([]);
  });

  test("peer dependencies: a required peer flagged dev is reported, an optional peer is not", () => {
    const l = lock(
      { dependencies: { host: "1" } },
      {
        "node_modules/host": {
          peerDependencies: { needed: "1", wanted: "1" },
          peerDependenciesMeta: { wanted: { optional: true } },
        },
        "node_modules/needed": { dev: true },
        "node_modules/wanted": { dev: true },
      },
    );
    expect(hiddenProductionPackages(l)).toEqual(["node_modules/needed"]);
  });

  test("resolves node-style: the copy nested under the requirer wins over the root copy", () => {
    const pkgs = (nestedDev, rootDev) => ({
      "node_modules/a": { dependencies: { b: "1" } },
      "node_modules/a/node_modules/b": { dev: nestedDev },
      "node_modules/b": { dev: rootDev },
    });
    const root = { dependencies: { a: "1" } };
    // Production reaches only the nested b, so a dev-flagged root b is not an offender...
    expect(hiddenProductionPackages(lock(root, pkgs(false, true)))).toEqual([]);
    // ...and a dev-flagged nested b is, even though the root b is clean.
    expect(hiddenProductionPackages(lock(root, pkgs(true, false)))).toEqual(["node_modules/a/node_modules/b"]);
  });
});
