"use client";

/**
 * LanguageToggle — EN | ES segmented pill toggle.
 *
 * Consumes LocaleContext via useLocale(). Renders a segmented button group:
 *   - Active locale has a filled background.
 *   - Inactive locale is outlined / text-only.
 *   - Keyboard accessible: Tab to focus, Enter/Space to activate.
 *   - Screen reader: announces "Language: English, button" / "Language: Spanish, button".
 *
 * Spec: github.com/kr8vka0z/pueblo-food-map/issues/68
 *
 * #689 PR 2, design decision 8: on a MIRRORED page (this pathname has an
 * /es counterpart — mirroredCounterpartHref returns non-null), the segment
 * for the tree you're NOT currently on (l !== tree) renders as a real <a>
 * href to that counterpart URL instead of an in-place setLocale() button —
 * crossing root layouts is a full page load (design decision 2), so a
 * client-side setLocale() there would leave the URL/server metadata/JSON-LD
 * un-switched. The segment matching the CURRENT tree (l === tree) stays the
 * original in-place button — unaffected, same as a non-mirrored page. When
 * `usePathname()` has no counterpart (non-mirrored page, or null — the
 * value in this test suite without a route mocked), BOTH segments are the
 * original buttons: byte-identical to pre-#689 behavior.
 */

import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/LocaleContext";
import { t, type Locale } from "@/lib/i18n";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { track, EVENTS } from "@/lib/analytics";
import { mirroredCounterpartHref } from "@/lib/localizedHref";
import { writeLocaleCookie } from "@/lib/LocaleContext";

const LABELS: Record<Locale, string> = {
  en: "EN",
  es: "ES",
};

const SR_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Spanish",
};

// WHY identical for both <button> and <a>: this must render byte-identical
// to the pre-#689 button-only markup for the non-mirrored-page and
// current-tree-segment cases — no new layout classes, so nothing visually
// shifts for the vast majority of renders this change doesn't touch.
const SEGMENT_CLASS =
  "relative px-3 text-xs font-semibold transition-colors duration-150 h-full " +
  "first:rounded-l-full last:rounded-r-full " +
  // #233: 26px-tall segments → 48px hit areas. 11px up/down, and
  // 10px outward only (EN left, ES right) so each clears 48 wide
  // while the two still meet at the divider rather than overlap.
  "before:absolute before:inset-x-0 before:-inset-y-[11px] " +
  "first:before:-left-2.5 last:before:-right-2.5 " +
  PRESS_FEEDBACK + " " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset " +
  "focus-visible:ring-[var(--color-sage-500)] ";

function segmentColorClass(active: boolean): string {
  return active
    ? "bg-[var(--color-ink-700)] text-[var(--color-bone-50)]"
    : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]";
}

export default function LanguageToggle() {
  const { locale, setLocale, tree } = useLocale();
  const pathname = usePathname();
  const counterpartHref = pathname ? mirroredCounterpartHref(pathname, tree) : null;

  return (
    <div
      role="group"
      aria-label={t("lang.toggle.label", locale)}
      // No overflow-hidden (#233): it would clip the segments' ::before tap
      // overlays below. Each segment rounds its own outer end instead, which
      // draws the same pill.
      className="flex items-center rounded-full border border-[var(--color-bone-300)] bg-[var(--color-bone-100)]"
      style={{ height: 28 }}
    >
      {(["en", "es"] as Locale[]).map((l) => {
        const active = locale === l;

        // On a mirrored page, the segment for the tree we're NOT on is a
        // real cross-tree link (see this file's header). The segment
        // matching the current tree stays the ordinary in-place button.
        if (counterpartHref && l !== tree) {
          return (
            <a
              key={l}
              href={counterpartHref}
              // Writes the cookie + fires the same analytics event as the
              // in-place toggle, then lets the browser navigate normally
              // (no preventDefault/router.push — crossing root layouts is
              // always a full load, design decision 2).
              onClick={() => {
                writeLocaleCookie(l);
                void track(EVENTS.LOCALE_SWITCHED, { to: l });
              }}
              // aria-pressed is a button-only ARIA state (jsx-a11y/role-
              // supports-aria-props) — this is a real <a>, so aria-current
              // is the link-appropriate equivalent for "this is the
              // currently-shown language."
              aria-current={active ? "true" : undefined}
              aria-label={`Language: ${SR_LABELS[l]}`}
              className={SEGMENT_CLASS + segmentColorClass(active)}
            >
              {LABELS[l]}
            </a>
          );
        }

        return (
          <button
            key={l}
            type="button"
            onClick={() => {
              // #485 PR 2: only an ACTUAL switch counts — tapping the
              // already-active pill is a no-op tap, not a language change.
              if (l !== locale) void track(EVENTS.LOCALE_SWITCHED, { to: l });
              setLocale(l);
            }}
            aria-pressed={active}
            aria-label={`Language: ${SR_LABELS[l]}`}
            className={SEGMENT_CLASS + segmentColorClass(active)}
          >
            {LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
