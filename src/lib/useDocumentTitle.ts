"use client";

/**
 * useDocumentTitle — keeps document.title in sync with a caller-computed
 * string (issue #589: Spanish visitors kept the English <title>).
 *
 * WHY needed at all: locale is a client-side cookie/toggle (LocaleContext),
 * not a route — LanguageToggle flips `locale` via React state with no
 * navigation. Next.js Metadata only sets <title> once, from the server's
 * always-English render (AGENTS.md "Known bilingual limitation", #287); after
 * a toggle to Spanish, or on the initial hydration of an ES-cookied visitor,
 * nothing else touches that DOM node. This hook is the client-side patch:
 * call it from a localized page's "Content" component with the fully
 * composed title for the CURRENT locale (build it with `t(key, locale)`,
 * `pageDocumentTitle()` from @/lib/site for the common
 * "<Title> · Pueblo Food Map" suffix, or a literal for pages outside that
 * pattern) — the effect re-applies whenever that string changes, covering
 * both an ES-locale first mount and a live EN<->ES toggle.
 *
 * Deliberately does NOT read locale itself: keeping it a plain string-in,
 * side-effect-out hook means it owes nothing to i18n and stays reusable for
 * any future non-locale document.title need.
 */

import { useEffect } from "react";

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
