"use client";

/**
 * BoxRedirectClient — the client half of /box/[id] (map-first rework,
 * 2026-09-18). The page itself no longer renders a standalone box page; it
 * immediately sends the visitor to the map with this box's card open
 * (`/?venue=<id>`, the same deep-link param HomePageClient already reads —
 * see MapWrapper.tsx's deep-link effect). Kept as a real page (not a plain
 * `next.config.ts` redirect) so `generateMetadata` in page.tsx can still
 * emit box-specific title/description/OG tags for shared links and social
 * previews — a static redirect can't run per-id metadata.
 *
 * Client-side `router.replace` (not `redirect()` from a Server Component)
 * because this needs to run AFTER the page's own metadata has already been
 * emitted in `<head>` — a server redirect would skip rendering the page
 * (and its metadata) entirely for a crawler that doesn't execute JS, which
 * is the whole point of keeping generateMetadata server-side.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";

interface BoxRedirectClientProps {
  id: string;
  name: string;
}

export default function BoxRedirectClient({ id, name }: BoxRedirectClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const destination = `/?venue=${encodeURIComponent(id)}`;

  useEffect(() => {
    router.replace(destination);
  }, [destination, router]);

  // Visible only for the brief flash before the replace takes effect for a
  // JS visitor. A JS-disabled visitor never runs the effect above at all and
  // would otherwise be stuck on "Loading…" forever (fix, PR review
  // 2026-09-18) — the plain <a> link below is a real navigation, not a
  // router.push, so it works with JS off too.
  return (
    <p className="p-6 text-sm text-[var(--color-ink-500)]">
      {name} — {t("box.cardLoading", locale)}
      <br />
      <Link
        href={destination}
        className="text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] underline"
      >
        {t("box.redirectLink", locale)}
      </Link>
    </p>
  );
}
