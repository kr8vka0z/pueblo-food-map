/**
 * FaqSection — server-rendered FAQ block plus its FAQPage JSON-LD (#709).
 *
 * WHY one component emits both: the JSON-LD is built from the SAME items array
 * the visible list renders, so the structured-data text can never drift from
 * the page text (Google requires the two to match). No "use client": the
 * pantry hub adds zero client JS. (/resources can't use this: its body
 * follows the visitor's locale, so it renders FaqList itself.)
 */

import type { Locale } from "@/lib/i18n";
import type { FaqItem } from "@/lib/faqItems";
import { buildFaqJsonLd, serializeJsonLd } from "@/lib/venueSchema";
import FaqList from "@/components/FaqList";

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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildFaqJsonLd(items, locale)) }}
      />
      <FaqList id={id} heading={heading} items={items} />
    </>
  );
}
