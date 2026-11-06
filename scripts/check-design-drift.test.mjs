/**
 * check-design-drift.test.mjs
 *
 * Regression guard for the #529 color-token-usage check: a file that uses
 * an undefined token such as `var(--color-ink-300)` must fail the check
 * (#534 fixed every pre-existing site, so nothing is exempt). This
 * spawns the real script as a subprocess against the real src/ tree (the
 * script has no exported functions to unit-test directly — it's a CLI that
 * reads globals.css/DESIGN.md/src/ off disk and calls process.exit), drops
 * a throwaway probe file in and out via try/finally so a failed assertion
 * can't leave debris in the tree.
 */

import { describe, test, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SCRIPT = resolve(ROOT, "scripts/check-design-drift.mjs");

// Not a real component — never imported, only scanned for var(--color-...)
// usage by the drift script. Deleted in afterEach even on assertion failure.
const PROBE_PATH = resolve(ROOT, "src/components/__driftGrandfatherProbe.tsx");

function runDriftCheck() {
  return spawnSync("node", [SCRIPT], { cwd: ROOT, encoding: "utf8" });
}

afterEach(() => {
  if (existsSync(PROBE_PATH)) rmSync(PROBE_PATH);
});

describe("check-design-drift.mjs — undefined color tokens fail the check", () => {
  test("an undefined token used in a new file fails the check", () => {
    // --color-ink-300 is not defined in globals.css @theme.
    writeFileSync(
      PROBE_PATH,
      'export const probe = "text-[var(--color-ink-300)]";\n',
    );
    const result = runDriftCheck();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("UNDEFINED COLOR TOKEN  --color-ink-300");
    expect(result.stderr).toContain("__driftGrandfatherProbe.tsx");
  });

  test("baseline (no probe file) passes", () => {
    const result = runDriftCheck();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Design token parity check passed.");
  });
});
