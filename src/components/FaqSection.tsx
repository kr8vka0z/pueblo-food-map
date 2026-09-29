/**
 * FaqSection — server-rendered FAQ block plus its FAQPage JSON-LD (#709).
 *
 * WHY one component emits both: the JSON-LD is built from the SAME items array
 * the visible list renders, so the structured-data text can never drift from
 * the page text (Google requires the two to match). No "use client": the
 * hubs and /resources FAQ add zero client JS. Markup mirrors AboutContent's
 * FAQ so the look is identical.
 */

import { t, type Locale } from "@/lib/i18n";
import { buildFaqJsonLd, serializeJsonLd } from "@/lib/venueSchema";

export interface FaqItem {
  question: string;
  answer: string;
}

/** Resolves `${prefix}.q1..qN` / `a1..aN` for one locale. */
export function faqItemsFor(prefix: string, count: number, locale: Locale): FaqItem[] {
  return Array.from({ length: count }, (_, i) => ({
    question: t(`${prefix}.q${i + 1}`, locale),
    answer: t(`${prefix}.a${i + 1}`, locale),
  }));
}

export default function FaqSection({
  id,
  heading,
  items,
  locale,
}: {
  id: string;
  heading: string;
  items: FaqItem[];
  locale: Locale;
}) {
  return (
    <section aria-labelledby={id}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildFaqJsonLd(items, locale)) }}
      />
      <h2 id={id} className="text-lg font-semibold text-[var(--color-ink-700)] mb-3">
        {heading}
      </h2>
      <div className="space-y-5">
        {items.map((item) => (
          <div key={item.question}>
            <h3 className="text-base font-semibold text-[var(--color-ink-700)] mb-1">
              {item.question}
            </h3>
            <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
