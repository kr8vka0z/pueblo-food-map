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
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const NAMES = new Set(["__dirname", "__filename"]);

/** Names from NAMES the file reads but never declares; parsed, so comments and strings don't count. */
function undeclaredUses(file: string): string[] {
  const src = ts.createSourceFile(file, readFileSync(join(ROOT, file), "utf-8"), ts.ScriptTarget.Latest, true);
  const used = new Set<string>();
  const declared = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && NAMES.has(node.text)) {
      if (ts.isVariableDeclaration(node.parent) && node.parent.name === node) declared.add(node.text);
      else used.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return [...used].filter((n) => !declared.has(n));
}

describe("incident-2026-10-26-refresh-esm-dirname: no bare __dirname/__filename under ESM", () => {
  test("every file that uses __dirname or __filename declares it", () => {
    const files = globSync(["scripts/**/*.{ts,tsx,mts,mjs,js}", "src/**/*.{ts,tsx,mts,mjs,js}"], {
      cwd: ROOT,
      exclude: (f) => f.includes("node_modules") || f.includes("/generated/") || /\.test\.tsx?$/.test(f),
    });
    const offenders = files.filter((f) => undeclaredUses(f).length > 0);
    expect(offenders).toEqual([]);
  });
});
