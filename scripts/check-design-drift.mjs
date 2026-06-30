/**
 * check-design-drift.mjs
 *
 * WHY THIS EXISTS:
 * globals.css @theme is the canonical source of truth for design tokens — Tailwind v4
 * reads it directly at build time. DESIGN.md mirrors those tokens and adds prose
 * rationale + Do's/Don'ts for human and AI collaborators. The risk is silent drift:
 * globals.css changes and DESIGN.md silently lies to every agent that reads it.
 *
 * This script enforces parity between the two. It is tool-agnostic (pure Node built-ins,
 * no external deps) so it survives regardless of whether the `designmd` CLI is installed,
 * updated, or removed. That's intentional — the alpha CLI's exporter is unreliable
 * (drops font stacks, emits camelCase var names), so we own this check ourselves.
 *
 * Scope: colors, spacing, and radius tokens ONLY.
 * - Typography/fonts excluded: the alpha exporter cannot faithfully reproduce them.
 * - Motion/elevation excluded: DESIGN.md carries these as prose, not numeric values.
 * - Components excluded: they reference tokens by name (not by value) — no value drift.
 *
 * Name mapping: DESIGN.md uses camelCase keys; globals.css uses kebab-case CSS vars.
 * The mapping is explicit and maintained here. If a new globals token has no DESIGN.md
 * key and isn't in a known skip list, this script FAILS — forcing the author to update
 * DESIGN.md and the map before the PR can merge.
 *
 * Usage:
 *   node scripts/check-design-drift.mjs [path/to/DESIGN.md]
 * Exits 0 if all in-scope tokens match, 1 if any drift or unmapped tokens detected.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CSS_PATH    = resolve(ROOT, 'src/app/globals.css');
const DESIGN_PATH = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, 'DESIGN.md');

// ---------------------------------------------------------------------------
// CSS parsing
// ---------------------------------------------------------------------------

/** Extract the content of the @theme { ... } block via brace matching. */
function extractThemeBlock(css) {
  const themeIdx = css.indexOf('@theme');
  if (themeIdx === -1) throw new Error('No @theme rule found in globals.css');
  const braceOpen = css.indexOf('{', themeIdx);
  if (braceOpen === -1) throw new Error('No opening brace found after @theme');

  let depth = 0;
  let themeEnd = -1;
  for (let i = braceOpen; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) { themeEnd = i; break; }
    }
  }
  if (themeEnd === -1) throw new Error('Unclosed @theme block in globals.css');
  return css.slice(braceOpen + 1, themeEnd);
}

/** Normalize a token value: lowercase, trim whitespace. */
function normalizeValue(v) {
  return v.trim().toLowerCase();
}

/**
 * Parse all CSS custom properties from a text block.
 * Returns Map<'--var-name', normalizedValue>.
 * Handles alignment spaces and inline comments after the semicolon.
 */
function parseCssVars(block) {
  const vars = new Map();
  // Match: --name: value; (value must not contain ';' or newlines)
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;\n]+?)\s*;/g)) {
    vars.set(`--${m[1]}`, normalizeValue(m[2]));
  }
  return vars;
}

// Only color, spacing, and radius vars are in scope for parity checking.
const inScope = (cssVar) =>
  cssVar.startsWith('--color-') ||
  cssVar.startsWith('--spacing-') ||
  cssVar.startsWith('--radius-');

// ---------------------------------------------------------------------------
// YAML frontmatter parsing (hand-rolled to avoid a dep)
// ---------------------------------------------------------------------------

/** Extract lines between the first two '---' fences in a Markdown file. */
function extractFrontmatterLines(md) {
  const lines = md.split('\n');
  let started = false;
  const fm = [];
  for (const line of lines) {
    if (!started && line.trim() === '---') { started = true; continue; }
    if (started  && line.trim() === '---') break;
    if (started) fm.push(line);
  }
  return fm;
}

/**
 * Parse a named flat section from frontmatter lines.
 * Returns { key: rawStringValue } for all immediate (single-indent) children.
 * Stops at the next top-level YAML key (line starting with a letter).
 * Only handles quoted values ("..." or '...'); nested/unquoted entries are ignored.
 */
function parseFrontmatterSection(fmLines, sectionName) {
  const tokens = {};
  let inSection = false;

  for (const line of fmLines) {
    // Top-level YAML key detection (starts with a letter — no leading whitespace)
    if (/^[a-zA-Z]/.test(line)) {
      if (line.startsWith(`${sectionName}:`)) {
        inSection = true;
        continue;
      }
      if (inSection) break; // Another top-level key ends this section
    }

    if (!inSection) continue;
    if (/^\s*$/.test(line)) continue; // Blank lines within section are fine

    // Match: "  key: "value"" (double-quoted)
    const mDouble = line.match(/^[ \t]+(\w+):\s+"([^"]+)"\s*(?:#.*)?$/);
    if (mDouble) { tokens[mDouble[1]] = mDouble[2]; continue; }

    // Match: "  key: 'value'" (single-quoted, defensive)
    const mSingle = line.match(/^[ \t]+(\w+):\s+'([^']+)'\s*(?:#.*)?$/);
    if (mSingle) { tokens[mSingle[1]] = mSingle[2]; }
    // Note: unquoted or nested entries (components, multi-line scalars) are
    // intentionally skipped — the only sections we parse use quoted scalars.
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Name mapping: DESIGN.md key -> CSS custom property name
// ---------------------------------------------------------------------------

// DESIGN.md-only color keys with NO --color-* counterpart in globals.css.
// These are skipped in both directions — not a drift error if they appear only
// in DESIGN.md and not in globals.css.
//
//   primary = a semantic alias for sage-600 used in DESIGN.md prose; it is not
//             its own registered custom property in @theme.
//   white   = used in DESIGN.md as a conceptual contrast reference; #FFFFFF is
//             a raw literal in usage, not a custom property.
const COLOR_DESIGN_ONLY = new Set(['primary', 'white']);

// DESIGN.md drops the 'brand-' prefix for the three PFP brand colors.
const COLOR_BRAND_REMAP = {
  navy:   'brand-navy',
  orange: 'brand-orange',
  yellow: 'brand-yellow',
};

// Semantic colors map directly (name matches the CSS var suffix).
const COLOR_SEMANTIC = new Set(['success', 'warning', 'danger']);

/**
 * Convert a DESIGN.md color key to its CSS custom property name.
 * Returns:
 *   string    — the CSS var (e.g. '--color-bone-50')
 *   null      — DESIGN.md-only key; skip without error
 *   undefined — unrecognized key; script will report an error
 */
function colorKeyToCssVar(key) {
  if (COLOR_DESIGN_ONLY.has(key)) return null;
  if (COLOR_BRAND_REMAP[key])     return `--color-${COLOR_BRAND_REMAP[key]}`;
  if (COLOR_SEMANTIC.has(key))    return `--color-${key}`;

  // Category tokens: catPantry -> --color-cat-pantry
  // Pattern: 'cat' immediately followed by an uppercase letter.
  if (/^cat[A-Z]/.test(key)) {
    return `--color-cat-${key.slice(3).toLowerCase()}`;
  }

  // Scale tokens: bone50 -> --color-bone-50, ink700 -> --color-ink-700
  // Pattern: one or more lowercase letters followed by one or more digits.
  const scaleMatch = key.match(/^([a-z]+)(\d+)$/);
  if (scaleMatch) {
    return `--color-${scaleMatch[1]}-${scaleMatch[2]}`;
  }

  // Fallback: key is not handled by this map — caller will report an error.
  return undefined;
}

/**
 * Convert a DESIGN.md spacing key to its CSS custom property name.
 * sp1 -> --spacing-1, sp10 -> --spacing-10
 */
function spacingKeyToCssVar(key) {
  const m = key.match(/^sp(\d+)$/);
  return m ? `--spacing-${m[1]}` : undefined;
}

/**
 * Convert a DESIGN.md rounded key to its CSS custom property name.
 * sm/md/lg/xl/full -> --radius-sm/--radius-md/etc.
 */
function roundedKeyToCssVar(key) {
  const VALID = new Set(['sm', 'md', 'lg', 'xl', 'full']);
  return VALID.has(key) ? `--radius-${key}` : undefined;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const cssText    = readFileSync(CSS_PATH, 'utf8');
const themeBlock = extractThemeBlock(cssText);
const allCssVars = parseCssVars(themeBlock);

// Filter to only the token groups we compare.
const globalsTokens = new Map(
  [...allCssVars].filter(([k]) => inScope(k))
);

const designText = readFileSync(DESIGN_PATH, 'utf8');
const fmLines    = extractFrontmatterLines(designText);

const designColors  = parseFrontmatterSection(fmLines, 'colors');
const designSpacing = parseFrontmatterSection(fmLines, 'spacing');
const designRounded = parseFrontmatterSection(fmLines, 'rounded');

// Build designTokens: Map<cssVar, normalizedValue> from DESIGN.md keys.
const designTokens = new Map();
const errors = [];

for (const [key, val] of Object.entries(designColors)) {
  const cssVar = colorKeyToCssVar(key);
  if (cssVar === null) continue; // intentionally DESIGN.md-only
  if (cssVar === undefined) {
    errors.push(
      `DESIGN.md colors: key "${key}" is unrecognized by the drift map.\n` +
      `  -> Update colorKeyToCssVar() in scripts/check-design-drift.mjs.`
    );
    continue;
  }
  designTokens.set(cssVar, normalizeValue(val));
}

for (const [key, val] of Object.entries(designSpacing)) {
  const cssVar = spacingKeyToCssVar(key);
  if (cssVar === undefined) {
    errors.push(
      `DESIGN.md spacing: key "${key}" is unrecognized by the drift map.\n` +
      `  -> Update spacingKeyToCssVar() in scripts/check-design-drift.mjs.`
    );
    continue;
  }
  designTokens.set(cssVar, normalizeValue(val));
}

for (const [key, val] of Object.entries(designRounded)) {
  const cssVar = roundedKeyToCssVar(key);
  if (cssVar === undefined) {
    errors.push(
      `DESIGN.md rounded: key "${key}" is unrecognized by the drift map.\n` +
      `  -> Update roundedKeyToCssVar() in scripts/check-design-drift.mjs.`
    );
    continue;
  }
  designTokens.set(cssVar, normalizeValue(val));
}

// Check 1: every in-scope globals token must be in DESIGN.md.
for (const [cssVar, cssVal] of globalsTokens) {
  if (designTokens.has(cssVar)) {
    const designVal = designTokens.get(cssVar);
    if (cssVal !== designVal) {
      errors.push(
        `MISMATCH  ${cssVar}\n` +
        `  globals.css  : ${cssVal}\n` +
        `  DESIGN.md    : ${designVal}`
      );
    }
  } else {
    errors.push(
      `UNMAPPED GLOBALS TOKEN  ${cssVar}  (value: ${cssVal})\n` +
      `  -> Add this token to DESIGN.md and map it in check-design-drift.mjs,\n` +
      `     or add it to COLOR_DESIGN_ONLY if it intentionally has no mirror.`
    );
  }
}

// Check 2: every DESIGN.md token that has a CSS var must exist in globals.
for (const [cssVar, designVal] of designTokens) {
  if (!globalsTokens.has(cssVar)) {
    errors.push(
      `MISSING FROM GLOBALS  ${cssVar}  (DESIGN.md value: ${designVal})\n` +
      `  -> Either add ${cssVar} to globals.css @theme, or remove it from DESIGN.md.`
    );
  }
}

// Report
if (errors.length === 0) {
  console.log('Design token parity check passed.');
  console.log(`  Compared ${globalsTokens.size} in-scope globals.css tokens against DESIGN.md.`);
  console.log('  All values match.');
  process.exit(0);
} else {
  console.error(`Design token parity check FAILED -- ${errors.length} issue(s):\n`);
  for (const e of errors) {
    console.error(`  ${e}\n`);
  }
  console.error('Fix the issues above, then re-run: node scripts/check-design-drift.mjs');
  process.exit(1);
}
