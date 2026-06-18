"use client";

/**
 * MapLoadingFallback — placeholder shown while the Mapbox GL bundle loads.
 *
 * Extracted from MapWrapper's dynamic() loading: callback so the text can be
 * locale-aware. The loading: prop in Next.js dynamic() is a real React
 * component and can call hooks — it renders inside the existing LocaleProvider
 * tree. We read locale here via useLocale() rather than threading a prop,
 * which avoids cluttering MapWrapper's dynamic() call site.
 *
 * Prop-based form (locale prop) is also exported for use in tests, where the
 * LocaleProvider is controlled by the test harness.
 */

import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";

interface MapLoadingFallbackProps {
  /** Override locale for testing. If omitted, reads from LocaleContext. */
  locale?: Locale;
}

export default function MapLoadingFallback({ locale: localeProp }: MapLoadingFallbackProps = {}) {
  // useLocale() is safe here: this component renders inside LocaleProvider
  // (it is the loading placeholder for <MapWrapper> which is always wrapped).
  // localeProp is used by tests that render this component in isolation.
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-bone-100)] text-[var(--color-ink-400)] text-sm motion-safe:animate-pulse">
      {t("map.loading", locale)}
    </div>
  );
}
