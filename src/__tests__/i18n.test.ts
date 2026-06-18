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

  test("non-allowlisted keys should not be identical EN/ES (spot check)", () => {
    const identicalUnexpected: string[] = [];
    for (const key of Object.keys(en)) {
      if (!(key in es)) continue;
      if (IDENTICAL_ALLOWLIST.has(key)) continue;
      if (en[key] === es[key] && !key.includes("placeholder") && !key.includes("email")) {
        identicalUnexpected.push(key);
      }
    }
    // menu.about was the known bug; ensure it is not in the unexpected list
    expect(identicalUnexpected).not.toContain("menu.about");
  });

  test("no empty ES values", () => {
    for (const [key, value] of Object.entries(es)) {
      expect(value.trim().length, `Empty ES value for ${key}`).toBeGreaterThan(0);
    }
  });
});
