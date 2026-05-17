/**
 * Banned-string guard for v2 design tokens & fonts.
 * Run: node scripts/check-banned.mjs
 * Wired into: npm run lint
 *
 * Escape hatch: add `// allow-banned: <reason>` on the offending line.
 * Excludes: docs/, scripts/check-banned.mjs itself, node_modules/, .next/
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PATTERNS = [
  { name: 'Inter font import',          re: /["'`]Inter["'`]|next\/font\/google.*Inter|font-family:\s*["']?Inter["']?/i },
  { name: 'Inter Tight font',           re: /["'`]Inter Tight["'`]/i },
  { name: 'Roboto font',                re: /["'`]Roboto["'`]/i },
  { name: 'Arial font',                 re: /["'`]Arial["'`]/i },
  { name: 'Source Sans Pro font',       re: /["'`]Source Sans Pro["'`]/i },
  { name: 'system-ui-only stack',       re: /font-family:\s*system-ui\s*;/i },
  { name: 'next/font/google import',    re: /from\s+["']next\/font\/google["']/ },
  { name: 'Tailwind gray palette',      re: /\bgray-(50|100|200|300|400|500|600|700|800|900)\b/ },
  { name: 'Tailwind blue palette',      re: /\bblue-(50|100|200|300|400|500|600|700|800|900)\b/ },
  { name: 'Tailwind slate palette',     re: /\bslate-(50|100|200|300|400|500|600|700|800|900)\b/ },
  { name: 'Tailwind zinc palette',      re: /\bzinc-(50|100|200|300|400|500|600|700|800|900)\b/ },
  { name: 'Tailwind neutral palette',   re: /\bneutral-(50|100|200|300|400|500|600|700|800|900)\b/ },
  { name: 'Tailwind stone palette',     re: /\bstone-(50|100|200|300|400|500|600|700|800|900)\b/ },
];

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '').replace(/^\/([A-Z]:)/, '$1');

const EXCLUDE_DIRS  = new Set(['node_modules', '.next', 'out', 'build', 'docs', '.claude']);
const EXCLUDE_FILES = new Set([join(ROOT, 'scripts', 'check-banned.mjs').replace(/\\/g, '/')]);
const INCLUDE_EXTS  = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']);

function walk(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry)) walk(full, results);
    } else if (INCLUDE_EXTS.has(full.slice(full.lastIndexOf('.')))) {
      results.push(full);
    }
  }
  return results;
}

let violations = 0;

for (const filePath of walk(ROOT)) {
  const normalised = filePath.replace(/\\/g, '/');
  if (EXCLUDE_FILES.has(normalised)) continue;

  const lines = readFileSync(filePath, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\/\/\s*allow-banned:/i.test(line)) continue;
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) {
        const rel = relative(ROOT, filePath).replace(/\\/g, '/');
        console.error(`BANNED [${name}]  ${rel}:${i + 1}  →  ${line.trim()}`);
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n✗ ${violations} banned string(s) found. Fix or add // allow-banned: <reason> to suppress.`);
  process.exit(1);
} else {
  console.log('✓ No banned strings found.');
}
