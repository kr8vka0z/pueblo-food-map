/**
 * check-banned.test.mjs
 *
 * Regression guard for #248: check-banned.mjs must not false-positive on
 * banned strings vendored inside build/output dirs (.wrangler, .open-next,
 * coverage, .next, .claude, node_modules) — those are generated/third-party
 * code, not something a human wrote in this repo. Spawns the real script as
 * a subprocess (it's a CLI that walks the filesystem and calls process.exit,
 * no exported functions to unit-test directly), drops a throwaway probe file
 * in and out via try/finally so a failed assertion can't leave debris.
 */

import { describe, test, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, rmdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SCRIPT = resolve(ROOT, "scripts/check-banned.mjs");

// One throwaway file per excluded build/output dir — each named so a banned
// pattern (Arial) would trip the check if that dir were ever scanned.
const EXCLUDED_DIRS = [".wrangler", ".open-next", "coverage", ".next", ".claude", "node_modules"];
const PROBE_PATHS = EXCLUDED_DIRS.map((dir) => resolve(ROOT, dir, "__checkBannedProbe.js"));
// A real src/ probe — proves the script still catches a genuine violation.
const SRC_PROBE = resolve(ROOT, "src/__checkBannedProbe.ts");

function runBannedCheck() {
  return spawnSync("node", [SCRIPT], { cwd: ROOT, encoding: "utf8" });
}

// Dirs this test itself creates (dir didn't exist before mkdirSync) — safe to
// rmdir afterward. node_modules/.claude etc. already exist in a real
// checkout and must never be touched.
const dirsCreatedByTest = [];

afterEach(() => {
  for (const p of PROBE_PATHS) {
    if (existsSync(p)) rmSync(p);
  }
  if (existsSync(SRC_PROBE)) rmSync(SRC_PROBE);
  while (dirsCreatedByTest.length > 0) {
    const dir = dirsCreatedByTest.pop();
    if (existsSync(dir)) rmdirSync(dir); // fails loudly if non-empty — never force-deletes real content
  }
});

describe("check-banned.mjs — build/output dirs are excluded (#248)", () => {
  test("a banned string dropped in each excluded dir does not fail the check", () => {
    for (const p of PROBE_PATHS) {
      const dir = dirname(p);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        dirsCreatedByTest.push(dir);
      }
      writeFileSync(p, 'export const x = "Arial";\n'); // allow-banned: probe fixture, lives inside an excluded dir
    }
    const result = runBannedCheck();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No banned strings found.");
  });

  test("baseline (no probes) passes — the real src/ tree is clean", () => {
    const result = runBannedCheck();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No banned strings found.");
  });

  test("a banned string in src/ (not excluded) still fails the check", () => {
    writeFileSync(SRC_PROBE, 'export const x = "Arial";\n'); // allow-banned: probe fixture, this test asserts the checker still flags it
    const result = runBannedCheck();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("BANNED [Arial font]");
    expect(result.stderr).toContain("__checkBannedProbe.ts");
  });

  test("a stock Tailwind chromatic class fails the check — errors use `danger`", () => {
    writeFileSync(SRC_PROBE, 'export const x = "text-red-600";\n'); // allow-banned: probe fixture, this test asserts the checker still flags it
    const result = runBannedCheck();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("BANNED [Tailwind chromatic palette]");
  });

  test("a sage-500 fill in a component fails the check — filled buttons use sage-600 (AA)", () => {
    writeFileSync(SRC_PROBE, 'export const x = "bg-[var(--color-sage-500)] text-[var(--color-bone-50)]";\n'); // allow-banned: probe fixture, this test asserts the checker still flags it
    const result = runBannedCheck();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("BANNED [sage-500 fill (fails AA behind text)]");
  });
});
