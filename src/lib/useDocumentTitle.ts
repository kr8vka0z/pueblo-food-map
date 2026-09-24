"use client";

/**
 * useDocumentTitle — keeps document.title in sync with a caller-computed
 * string (issue #589: Spanish visitors kept the English <title>).
 *
 * WHY needed at all: locale is a client-side cookie/toggle (LocaleContext),
 * not a route — LanguageToggle flips `locale` via React state with no
 * navigation, and Next.js Metadata's server-rendered <title> is always
 * English (`buildPageMetadata`/`generateMetadata`, src/lib/site.ts — no
 * route reads the locale cookie server-side, so metadata can't localize
 * without going dynamic; see ARCHITECTURE.md's i18n model section, "<title>
 * (#589)", for the full picture). Call it from a localized page's "Content"
 * component with the fully composed title for the
 * CURRENT locale (build it with `t(key, locale)`, `pageDocumentTitle()` from
 * @/lib/site for the common "<Title> · Pueblo Food Map" suffix, or a literal
 * for pages outside that pattern) — the effect re-applies whenever that
 * string changes, covering both an ES-locale first mount and a live EN<->ES
 * toggle.
 *
 * WHY the MutationObserver, not just `document.title = title` (#589
 * follow-up — client nav worked, a hard page load didn't): on a real
 * network (reproduced against dev.pueblofoodmap.com; does NOT reproduce on
 * near-zero-latency localhost, confirming it's a genuine timing race, not a
 * fixed order), this app's per-page `metadata` export is resolved by Next's
 * streaming-metadata path — a `<div hidden>` wrapping a Suspense boundary
 * named "Next.Metadata"/"Next.MetadataOutlet" (verified in the built HTML;
 * see node_modules/next/dist/lib/metadata/metadata.js's `MetadataWrapper`).
 * When that boundary's chunk arrives, React hydrates the `<title>` Fiber it
 * contains for the FIRST time; since React's DOM renderer does NOT treat
 * `<title>`/`<meta>` as deduplicated "resources" (only `style`/`link`
 * precedence tags get that treatment — see react-dom-client's
 * `getResource`), that first commit ADOPTS the existing `<title>` element
 * and overwrites its text node directly via `setInitialProperties` —
 * bypassing the `document.title` setter entirely (confirmed live: a trap on
 * `Document.prototype.title`'s setter never fires for this overwrite; a
 * MutationObserver on `document.head` does). This can land at any point
 * after this hook's own effect, depending on real-world chunk-arrival
 * timing — there is no fixed commit order to just "come after." Rendering
 * our own `<title>` JSX instead (an alternative considered) doesn't solve
 * this either: React warns that behavior with multiple simultaneous
 * `<title>` elements is undefined, and since `<title>` isn't a deduplicated
 * resource, whichever Fiber's chunk happens to arrive LAST wins the DOM
 * position — the same un-ownable race, just moved. Self-healing is the only
 * fix that doesn't depend on winning that race: watch `document.head` and,
 * whenever a mutation leaves `document.title` not matching the CURRENT
 * desired title, put it back. The correction re-uses the plain
 * `document.title` setter, which the observer also sees, but the callback
 * is idempotent (it only writes when the values differ) so it converges
 * after exactly one correction rather than looping.
 *
 * Deliberately does NOT read locale itself: keeping it a plain string-in,
 * side-effect-out hook means it owes nothing to i18n and stays reusable for
 * any future non-locale document.title need.
 */

import { useEffect } from "react";

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;

    // Scoped to document.head (not just the <title> node) because a stomp
    // can replace the node outright, not just mutate its text — observing
    // the node it happened to be attached to at effect-run time would miss
    // that case. Disconnected on unmount/title-change so a page that
    // legitimately wants a different (or no) locale-driven title later —
    // e.g. client-navigating to /venue/[id], which deliberately stays
    // English (its title is a proper venue name, nothing to translate —
    // src/app/venue/[id]/page.tsx) — never gets corrected by a stale
    // observer left running from the PREVIOUS page's title.
    const observer = new MutationObserver(() => {
      if (document.title !== title) {
        document.title = title;
      }
    });
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [title]);
}
