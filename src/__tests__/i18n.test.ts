import { describe, test, expect } from "vitest";
import { I18N_DICTIONARIES, t } from "@/lib/i18n";

const { en, es } = I18N_DICTIONARIES;

/** Keys intentionally identical across locales (program names, URLs, etc.). */
const IDENTICAL_ALLOWLIST = new Set([
  "app.name",
  "topbar.locale.en",
  "topbar.locale.es",
  "badge.snap",
  "badge.wic",
  "search.shortcut",
  "menu.title",
  "menu.language",
  "menu.help.doubleup",
  "suggest.fallback",
  "feedback.fallback",
  "report.fallback",
  "suggest.submitterEmail.placeholder",
  "suggest.address.placeholder",
  "report.email.placeholder",
  "feedback.email.placeholder",
]);

/** Keys that must differ between EN and ES. */
const MUST_DIFFER = [
  "menu.about",
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
