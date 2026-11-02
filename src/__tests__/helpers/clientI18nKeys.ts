/**
 * clientI18nKeys — which translation keys the browser can ask for (#723).
 *
 * Walks the import graph from every "use client" file under src/ (type-only
 * imports skipped, since they never reach a bundle) and collects, from every
 * file it reaches:
 *   - each string literal that is itself a key, and
 *   - each dotted literal or template head that is a key prefix: a template
 *     like `category.full.${x}` (head ending in "."), or a prefix such as
 *     "resources.faq" handed to a `${prefix}.q${n}` lookup.
 * Every key under a prefix counts, so a dynamic key is never missed.
 *
 * ponytail: a regex scan, not a TypeScript parse. It over-collects (a stray
 * literal that happens to equal a key just ships one extra string), which is
 * the safe direction; a key built with no literal anywhere in client code
 * would be missed, and the no-missing-keys test would not see it either.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function listSource(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : listSource(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // a package: not our code
  if (/\.tsx?$/.test(base) && existsSync(base)) return base;
  for (const ext of EXTENSIONS) if (existsSync(base + ext)) return base + ext;
  return null;
}

function importsOf(file: string, source: string): string[] {
  const specs: string[] = [];
  // Static imports and re-exports, skipping `import type` / `export type`.
  for (const m of source.matchAll(/^\s*(import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gm)) {
    if (!m[2]) specs.push(m[3]);
  }
  for (const m of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) specs.push(m[1]);
  for (const m of source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1]);
  return specs.map((s) => resolveImport(file, s)).filter((p): p is string => p !== null);
}

/** Every src/ file a "use client" file can pull into the browser. */
export function clientReachableFiles(): string[] {
  const all = listSource(SRC);
  const queue = all.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
  const seen = new Set(queue);
  while (queue.length) {
    const file = queue.pop()!;
    for (const next of importsOf(file, readFileSync(file, "utf8"))) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen].sort();
}

/** The keys (out of `allKeys`) that code in `files` can look up. */
export function keysUsedIn(files: string[], allKeys: Iterable<string>): Set<string> {
  const keys = [...allKeys];
  const keySet = new Set(keys);
  const used = new Set<string>();
  for (const file of files) {
    if (/\/lib\/i18n[^/]*\.ts$/.test(file)) continue; // the dictionaries themselves
    const source = readFileSync(file, "utf8");
    const literals = [
      ...[...source.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1] ?? m[2]),
      // A template literal's text up to its first ${ (the whole text if none).
      ...[...source.matchAll(/`([^`$]*)/g)].map((m) => m[1]),
    ];
    for (const lit of literals) {
      if (!lit) continue;
      if (keySet.has(lit)) used.add(lit);
      // A bare word ("email") is too common to count as a prefix; a dotted
      // one ("resources.faq") or a template head ("category.full.") is not.
      if (!lit.includes(".") || !/^[\w.]+$/.test(lit)) continue;
      const prefix = lit.endsWith(".") ? lit : `${lit}.`;
      for (const key of keys) if (key.startsWith(prefix)) used.add(key);
    }
  }
  return used;
}
