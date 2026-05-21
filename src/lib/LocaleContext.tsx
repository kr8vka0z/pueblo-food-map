"use client";

/**
 * LocaleContext — global locale state for EN/ES toggle.
 *
 * - LocaleProvider reads the `pfm-locale` cookie on first render (SSR-safe:
 *   the cookie value is passed as a prop from the server layout).
 * - useLocale() hook returns { locale, setLocale } for any client component.
 * - setLocale writes the `pfm-locale` cookie so the choice persists across
 *   sessions and is available on the initial server render.
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
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => undefined,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

interface LocaleProviderProps {
  /**
   * Initial locale value — pass the cookie value read server-side in layout.tsx
   * so the initial SSR render matches the user's stored preference.
   * Defaults to "en" when no cookie is set.
   */
  initialLocale?: Locale;
  children: React.ReactNode;
}

export function LocaleProvider({
  initialLocale = "en",
  children,
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeLocaleCookie(next);
  }, []);

  // Keep <html lang> in sync with the active locale for screen-reader pronunciation.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
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
