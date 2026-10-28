import { describe, test, expect } from "vitest";
import { I18N_DICTIONARIES, resolveEmailLang, t } from "@/lib/i18n";
import esClient from "@/lib/i18n.es";
import { serverEn, serverEs } from "@/lib/i18n.server";
import { clientReachableFiles, keysUsedIn } from "@/__tests__/helpers/clientI18nKeys";

const { en, es } = I18N_DICTIONARIES;

/** Keys intentionally identical across locales (program names, URLs, etc.). */
const IDENTICAL_ALLOWLIST = new Set([
  "app.name",
  "badge.snap",
  "badge.wic",
  "menu.title",
  "menu.language",
  // #689 PR 2: only ever rendered for an ES-locale visitor (see the key's
  // own comment in i18n.ts) — inherently Spanish-facing UI text, not a
  // translatable EN string, so identical EN/ES is correct here too.
  "menu.verEnEspanol",
  "resources.211.name",
  "resources.wic.name",
  "resources.doubleup.name",
  "suggest.fallback",
  "feedback.fallback",
  "report.fallback",
  "suggest.submitterEmail.placeholder",
  "suggest.address.placeholder",
  "report.email.placeholder",
  "feedback.email.placeholder",
  // directions.routeDuration is a pure placeholder — both locales output only {duration}
  // with no surrounding text, so identical EN/ES is correct (#134).
  "directions.routeDuration",
  // directions.stepMi uses the same "mi" abbreviation in both EN and ES — international
  // convention; "mi" is understood universally in the Pueblo CO context (#134).
  "directions.stepMi",
  // box.stats.noData is a bare em dash ("—") standing in for "no pair yet" —
  // a symbol, not prose, so it's correctly identical in both locales (slice 7).
  "box.stats.noData",
]);

/** Keys that must differ between EN and ES. */
const MUST_DIFFER = [
  "menu.sponsoredBy",
  "form.turnstile.verifying",
  "form.turnstile.error",
  "splash.dialogLabel",
  "menu.opensInNewTab",
  "search.placeholder",
  "marker.category.pantry",
] as const;

function extractPlaceholders(value: string): string[] {
  const matches = value.match(/\{(\w+)\}/g) ?? [];
  return matches.sort();
}

describe("i18n dictionary parity", () => {
  test("every EN key exists in ES", () => {
    const enKeys = Object.keys(en);
    const esKeys = new Set(Object.keys(es));
    const missing = enKeys.filter((k) => !esKeys.has(k));
    expect(missing, `Missing ES keys: ${missing.join(", ")}`).toEqual([]);
  });

  test("placeholder tokens match per key", () => {
    for (const key of Object.keys(en)) {
      if (!(key in es)) continue;
      expect(extractPlaceholders(es[key])).toEqual(extractPlaceholders(en[key]));
    }
  });

  test("critical keys differ between EN and ES", () => {
    for (const key of MUST_DIFFER) {
      expect(t(key, "es")).not.toBe(t(key, "en"));
    }
  });

  test("non-allowlisted keys should not be identical EN/ES", () => {
    // Any key with identical EN and ES copy must be in IDENTICAL_ALLOWLIST (program
    // names, URLs, emails, shared symbols). The old substring escape
    // (!key.includes("placeholder") && !key.includes("email")) was removed: the four
    // affected keys (suggest.submitterEmail.placeholder, suggest.address.placeholder,
    // report.email.placeholder, feedback.email.placeholder) are already in IDENTICAL_ALLOWLIST,
    // so the escape was redundant and silently bypassed the guard for any future key
    // whose name happened to contain those substrings.
    const identicalUnexpected: string[] = [];
    for (const key of Object.keys(en)) {
      if (!(key in es)) continue;
      if (IDENTICAL_ALLOWLIST.has(key)) continue;
      if (en[key] === es[key]) {
        identicalUnexpected.push(key);
      }
    }
    expect(
      identicalUnexpected,
      `Keys with identical EN/ES copy not in IDENTICAL_ALLOWLIST: ${identicalUnexpected.join(", ")}`,
    ).toEqual([]);
  });

  test("no empty ES values", () => {
    for (const [key, value] of Object.entries(es)) {
      expect(value.trim().length, `Empty ES value for ${key}`).toBeGreaterThan(0);
    }
  });
});

// Blessing Boxes slice 6, single-language alert emails: adopt/alerts/
// host-alerts routes trust NOTHING a caller sends past this — strict, same
// convention boxTurnstile.ts's resolveBoxTurnstileKey uses.
describe("resolveEmailLang", () => {
  test("the literal string 'es' resolves to 'es'", () => {
    expect(resolveEmailLang("es")).toBe("es");
  });

  test.each([["ES"], ["en-US"], ["es-MX"], [undefined], [null], [1], [""], ["en"]])(
    "%p resolves to 'en' (strict — only the exact literal 'es' escapes the default)",
    (raw) => {
      expect(resolveEmailLang(raw)).toBe("en");
    },
  );
});

// #723: the browser gets only the English client strings, plus the Spanish
// ones for a Spanish visitor. A key client code uses that lives only in the
// server file would show up in the browser as the raw key.
describe("i18n key placement (#723)", () => {
  const clientEn = Object.keys(en).filter((k) => !(k in serverEn));

  test("every key client code can look up is in the browser dictionaries, in both languages", () => {
    const used = keysUsedIn(clientReachableFiles(), Object.keys(en));
    expect(used.size).toBeGreaterThan(500); // the walk really found the client code
    expect([...used].filter((k) => !clientEn.includes(k) || !(k in esClient))).toEqual([]);
  });

  test.each([
    ["client", clientEn, Object.keys(esClient)],
    ["server", Object.keys(serverEn), Object.keys(serverEs)],
  ])("%s dictionaries: same keys in English and Spanish", (_, enKeys, esKeys) => {
    expect([...esKeys].sort()).toEqual([...enKeys].sort());
  });

  test("no key lives in both the client and the server dictionaries", () => {
    expect(Object.keys(serverEn).filter((k) => clientEn.includes(k) || k in esClient)).toEqual([]);
  });
});
