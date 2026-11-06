// @vitest-environment node
/**
 * Guards against bare `__dirname` / `__filename` in repo code.
 *
 * package.json is `"type": "module"`, so tsx runs scripts as ESM, where those
 * two names don't exist. vitest shims them, so a test that imports the file
 * passes while the real run crashes. That happened to the weekly venue refresh
 * on 2026-10-26 and 11-02 (`scripts/refresh/careAndShare.ts`, fixed in #892,
 * spec #893): it crashed before writing anything, two weeks running. A file
 * may use either name only after defining it itself, e.g.
 * `const __dirname = dirname(fileURLToPath(import.meta.url))`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const CODE = /\.(ts|tsx|mts|mjs|js)$/;

function codeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "generated") return [];
    if (statSync(path).isDirectory()) return codeFiles(path);
    return CODE.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Code with line and block comments removed, so a WHY comment naming `__dirname` doesn't count. */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("incident-2026-10-26-refresh-esm-dirname: no bare __dirname/__filename under ESM", () => {
  test("every file that uses __dirname or __filename defines it", () => {
    const offenders = ["scripts", "src"].flatMap((d) => codeFiles(join(ROOT, d))).filter((file) => {
      const code = stripComments(readFileSync(file, "utf-8"));
      return ["__dirname", "__filename"].some(
        (name) => new RegExp(`\\b${name}\\b`).test(code) && !new RegExp(`\\b(const|let|var)\\s+${name}\\b`).test(code),
      );
    });
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
