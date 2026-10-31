"use client";

/**
 * SpanishMessages — puts the Spanish client strings in place before anything
 * under it renders (#723). Rendered by src/app/es/layout.tsx only, so only
 * Spanish pages download i18n.es.ts, and they hydrate already in Spanish
 * (never an English flash or a missing-key fallback). English-tree visitors
 * who switch get the same file through loadSpanish() (LocaleContext.tsx).
 */

import esClient from "@/lib/i18n.es";
import { setSpanish } from "@/lib/i18n";

setSpanish(esClient);

export default function SpanishMessages({ children }: { children: React.ReactNode }) {
  return children;
}
