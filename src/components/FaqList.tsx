/**
 * FaqList — the visible Q&A markup for a FAQ (#709), no JSON-LD. Shared by the
 * server-only FaqSection (pantry hub) and the client ResourcesContent, which
 * must render at the visitor's locale (the /about pattern). Markup mirrors
 * AboutContent's FAQ. Imports only types, so it is safe in a client bundle.
 */

import type { FaqItem } from "@/lib/faqItems";

export default function FaqList({
  id,
  heading,
  items,
}: {
  id: string;
  heading: string;
  items: FaqItem[];
}) {
  return (
    <section aria-labelledby={id}>
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
