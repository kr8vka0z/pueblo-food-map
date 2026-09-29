/**
 * faqItemsFor — resolves numbered FAQ i18n keys (#709). Pure and i18n-only, so
 * client components (ResourcesContent) can import it without pulling in the
 * venue data that venueSchema.ts drags along.
 */

import { t, type Locale } from "@/lib/i18n";

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
