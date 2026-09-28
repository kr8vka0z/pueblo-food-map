"use client";

/**
 * LocaleContext — global locale state for EN/ES toggle.
 *
 * - LocaleProvider starts at "en" and, after hydration, switches to the
 *   saved `pfm-locale` cookie read from document.cookie (#289) — UNLESS a
 *   caller passes `initialLocale`. src/app/(site)/layout.tsx (the EN root
 *   layout) still passes none: no route reads the cookie server-side, so
 *   its pages stay static (#287). src/app/es/layout.tsx (#689 PR 2, the
 *   /es root layout) DOES pass `initialLocale="es"` — which also LOCKS the
 *   tree, since the cookie-sync effect only runs `if (!initialLocale)` —
 *   see ARCHITECTURE.md "i18n model" for the full picture.
 * - useLocale() hook returns { locale, setLocale, tree } for any client
 *   component — `tree` is fixed at the ROUTE that served the page (#689 PR
 *   2), distinct from the switchable `locale`; see its own field comment
 *   below and src/lib/localizedHref.ts's header for why the split matters.
 * - setLocale writes the `pfm-locale` cookie so the choice persists across
 *   sessions.
 *
 * Cookie spec:
 *   name:    pfm-locale
 *   values:  "en" | "es"
 *   default: "en"
 *   max-age: 1 year (365 days)
 *   path:    /
 *   samesite: Lax
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const COOKIE_NAME = "pfm-locale";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

/**
 * Read the pfm-locale cookie from document.cookie (client-side only).
 * Returns null if not found or if called server-side.
 */
export function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const value = match.split("=")[1];
  return value === "en" || value === "es" ? value : null;
}

/**
 * Write the pfm-locale cookie (client-side only).
 * Persists for 1 year, path=/, SameSite=Lax.
 */
export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.cookie = [
    `${COOKIE_NAME}=${locale}`,
    `max-age=${COOKIE_MAX_AGE}`,
    "path=/",
    "SameSite=Lax",
  ].join("; ");
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /**
   * The route TREE this page was served from ("en" | "es") — #689 PR 2.
   * Fixed at mount from `initialLocale`; unlike `locale`, it never changes
   * client-side (setLocale doesn't touch it), because it reflects which
   * root layout served this page, not the visitor's language preference.
   * localizedHref (src/lib/localizedHref.ts) keys off THIS, never `locale`
   * — see that file's header for why the distinction matters.
   */
  tree: Locale;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => undefined,
  tree: "en",
});

// ─── Provider ─────────────────────────────────────────────────────────────────

interface LocaleProviderProps {
  /**
   * Optional initial locale. The EN root layout (src/app/(site)/layout.tsx)
   * does not pass it (a server-side cookie read would make routes dynamic,
   * #287); when absent, the provider starts at "en" and applies the saved
   * cookie client-side on mount. The ES root layout (src/app/es/layout.tsx,
   * #689 PR 2) DOES pass `initialLocale="es"` — locking the tree (the
   * cookie-sync effect below only runs `if (!initialLocale)`), not just
   * seeding the initial state.
   */
  initialLocale?: Locale;
  children: React.ReactNode;
}

export function LocaleProvider({
  initialLocale,
  children,
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? "en");
  // WHY not state: tree reflects which root layout served this page —
  // that only ever changes via a full page load (crossing root layouts),
  // never a client-side re-render, so it's derived once and never updated.
  const tree = initialLocale ?? "en";

  // Sync client cookie on mount when no explicit initialLocale prop is provided (#289)
  useEffect(() => {
    if (!initialLocale) {
      const saved = readLocaleCookie();
      if (saved) {
        queueMicrotask(() => {
          setLocaleState((prev) => (prev !== saved ? saved : prev));
        });
      }
    }
  }, [initialLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeLocaleCookie(next);
  }, []);

  // Keep <html lang> in sync with the active locale for screen-reader pronunciation.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, tree }}>
      {children}
    </LocaleContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useLocale — access the current locale and a setter from any client component.
 *
 * @example
 *   const { locale, setLocale } = useLocale();
 *   <button onClick={() => setLocale("es")}>{t("topbar.locale.es", locale)}</button>
 */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
