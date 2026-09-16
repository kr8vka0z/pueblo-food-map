"use client";

/**
 * ResourcesContent — visible body of /resources: plain-language cards for the
 * food help programs a Pueblo resident is most likely to need.
 *
 * WHY a page and not a drawer section: the bottom nav's Resources item used to
 * open the menu drawer scrolled to five bare links, which looked like the same
 * thing as Menu (Kyle, 2026-09-16). Each program now says what it is, what it's
 * good for and how to get it, with call / text / website buttons.
 *
 * Same shape as AboutContent: the route stays a static Server Component and this
 * client component reads the visitor's locale via useLocale() (#289).
 *
 * Every fact here was read off the program's own site on 2026-09-16 (2-1-1
 * Colorado, Hunger Free Colorado, Colorado WIC, Double Up Food Bucks Colorado,
 * Pueblo County DHS). Re-check them when editing — phone hours drift.
 */

import { Phone, MessageSquareText, ExternalLink, ChevronDown } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import SiteFooter from "@/components/SiteFooter";
import PageNav, { PAGE_NAV_CLEARANCE } from "./PageNav";

type Action =
  | { kind: "call"; href: string; number: string }
  | { kind: "text"; href: string; number: string }
  /** labelKey defaults to resources.action.website */
  | { kind: "web"; href: string; labelKey?: string };

/** Kyle's order (2-1-1, SNAP, WIC, Double Up, hotline), then the county's senior box. */
export const PROGRAMS: Array<{ key: string; actions: Action[] }> = [
  {
    key: "211",
    actions: [
      { kind: "call", href: "tel:211", number: "2-1-1" },
      { kind: "text", href: "sms:898211", number: "898-211" },
      { kind: "web", href: "https://www.211colorado.org/food-assistance/" },
    ],
  },
  {
    key: "snap",
    actions: [
      { kind: "web", href: "https://www.colorado.gov/PEAK", labelKey: "resources.snap.apply" },
      { kind: "call", href: "tel:+17195836160", number: "719-583-6160" },
    ],
  },
  {
    key: "wic",
    actions: [
      { kind: "call", href: "tel:+17195834392", number: "719-583-4392" },
      { kind: "web", href: "https://www.coloradowic.gov/eligibility/apply", labelKey: "resources.wic.signup" },
    ],
  },
  {
    key: "doubleup",
    actions: [
      { kind: "web", href: "https://doubleupcolorado.org/find-a-location/", labelKey: "resources.doubleup.find" },
    ],
  },
  {
    key: "hotline",
    actions: [
      { kind: "call", href: "tel:+18558554626", number: "855-855-4626" },
      { kind: "web", href: "https://hungerfreecolorado.org/service/food-resource-hotline/" },
    ],
  },
  {
    key: "everydayeats",
    actions: [
      // ponytail: `?body=` pre-fills FOOD on iOS and Android; a client that
      // ignores it still opens a message to the right number, and the card
      // text says what to send.
      { kind: "text", href: "sms:+18776443663?body=FOOD", number: "1-877-644-3663" },
      { kind: "web", href: "https://county.pueblo.org/human-services-department/everyday-eats" },
    ],
  },
];

const ACTION_CLASS =
  "inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full text-sm font-semibold " +
  "border border-[var(--color-sage-500)] text-[var(--color-sage-700)] bg-white " +
  "hover:bg-[var(--color-sage-100)] transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  PRESS_FEEDBACK;

export default function ResourcesContent() {
  const { locale } = useLocale();

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      <PageNav locale={locale} />

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-6 space-y-3">
        <h1
          className="text-3xl font-normal text-[var(--color-ink-900)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("resources.heading", locale)}
        </h1>
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
          {t("resources.intro", locale)}
        </p>

        {PROGRAMS.map(({ key, actions }) => (
          <section
            key={key}
            id={key}
            aria-labelledby={`resource-${key}`}
            className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white scroll-mt-4"
          >
            {/* Starts closed so all six programs fit on a phone screen without
                scrolling (Kyle, 2026-09-16). Native <details>: keyboard, screen
                reader expanded state and find-in-page all work with no JS.
                Name only when closed — measured at 375×812, adding the one-line
                "what" pushed the last card ~190px (EN) / ~280px (ES) below the fold. */}
            <details className="group">
              <summary
                className={
                  "flex items-start gap-3 p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden " +
                  "rounded-[var(--radius-lg)] hover:bg-[var(--color-bone-100)] " +
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                }
              >
                <h2 id={`resource-${key}`} className="flex-1 min-w-0 text-base font-semibold text-[var(--color-ink-800)]">
                  {t(`resources.${key}.name`, locale)}
                </h2>
                <ChevronDown
                  size={20}
                  aria-hidden
                  className="shrink-0 mt-0.5 text-[var(--color-sage-600)] transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
                  {t(`resources.${key}.what`, locale)}
                </p>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)] mb-1">
                    {t("resources.goodFor", locale)}
                  </h3>
                  <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
                    {t(`resources.${key}.goodFor`, locale)}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)] mb-1">
                    {t("resources.how", locale)}
                  </h3>
                  <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
                    {t(`resources.${key}.how`, locale)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {actions.map((a) =>
                    a.kind === "web" ? (
                      <a key={a.href} href={a.href} target="_blank" rel="noopener noreferrer" className={ACTION_CLASS}>
                        <ExternalLink size={14} aria-hidden />
                        {t(a.labelKey ?? "resources.action.website", locale)}
                        <span className="sr-only"> {t("menu.opensInNewTab", locale)}</span>
                      </a>
                    ) : (
                      <a key={a.href} href={a.href} className={ACTION_CLASS}>
                        {a.kind === "call" ? (
                          <Phone size={14} aria-hidden />
                        ) : (
                          <MessageSquareText size={14} aria-hidden />
                        )}
                        {t(a.kind === "call" ? "resources.action.call" : "resources.action.text", locale, {
                          number: a.number,
                        })}
                      </a>
                    ),
                  )}
                </div>
              </div>
            </details>
          </section>
        ))}

        <p className="text-xs text-[var(--color-ink-500)] leading-relaxed">
          {t("resources.checked", locale)}
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
