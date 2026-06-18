'use client';

/**
 * SplashScreen — v3 refresh (issue #100).
 *
 * Changes from v2:
 *   - Removed: CATEGORIES array, CategorySwatch, CategoryCard, mobile category
 *     color-dot list, desktop 2-column "WHAT YOU'LL FIND" grid, "How it works"
 *     stub tile, ComingSoonToast, handleHowItWorksClick, toast timer state/effect.
 *   - Added: purpose line (splash.purpose), sponsor credit with hyperlink
 *     (splash.sponsor.prefix → "Pueblo Food Project" → pueblofoodproject.org).
 *   - Layout: single centered column, mobile-first, no-scroll at 375×812.
 *     Desktop: same column, max-w 520px, vertically centered with generous spacing.
 *
 * v3 review changes:
 *   - Removed secondary CTA ("Show the Pueblo map") — primary CTA is now the
 *     only entry point. Fallback to pueblo-center still applies when geo is
 *     denied or dismissed (existing onPrimary('pueblo-center') path unchanged).
 *   - Sponsor credit moved to bottom-right corner (mirrors SponsorCredit on map).
 *     Uses SponsorCredit component directly; splash.sponsor.* i18n keys removed.
 *   - Removed hairline divider (no longer needed without in-column credit).
 *   - onSecondary prop removed.
 *
 * Props interface and localStorage gate (pfm.splash.seen.v2) are unchanged.
 */

import { useCallback, useEffect, useState } from 'react';
import Wordmark from './Wordmark';
import SponsorCredit from './SponsorCredit';
import { useGeolocation } from '@/lib/useGeolocation';
import { useLocale } from '@/lib/LocaleContext';
import { t } from '@/lib/i18n';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SplashScreenProps {
  /** Called after geo request resolves (granted → 'located') or is denied → 'pueblo-center' */
  onPrimary: (mode: 'located' | 'pueblo-center') => void;
}

// ─── SplashScreen ──────────────────────────────────────────────────────────────

export default function SplashScreen({ onPrimary }: SplashScreenProps) {
  const geo = useGeolocation();
  const { locale, setLocale } = useLocale();

  // Track whether a geo request is in flight so we know to watch for state changes.
  const [geoRequested, setGeoRequested] = useState(false);

  // ── Resolve after geo request ────────────────────────────────────────────────
  useEffect(() => {
    if (!geoRequested) return;
    if (geo.state.permission === 'prompt') return;

    const mode: 'located' | 'pueblo-center' =
      geo.state.permission === 'granted' && geo.state.position !== null
        ? 'located'
        : 'pueblo-center';

    onPrimary(mode);
  }, [geoRequested, geo.state, onPrimary]);

  const handlePrimaryClick = useCallback(() => {
    if (geo.state.permission === 'granted' && geo.state.position !== null) {
      onPrimary('located');
      return;
    }
    if (geo.state.permission === 'denied') {
      onPrimary('pueblo-center');
      return;
    }
    setGeoRequested(true);
    geo.request();
  }, [geo, onPrimary]);

  // Each splash CTA sets the site language to its own language, then runs the
  // standard find-food flow. (The EN/ES toggle lives on the map view, not here.)
  const handleCtaClick = useCallback(
    (lang: 'en' | 'es') => {
      setLocale(lang);
      handlePrimaryClick();
    },
    [setLocale, handlePrimaryClick],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    // Outer layer: fixed full-viewport overlay (scrim + scroll container).
    // overflow-y-auto enables scroll when content exceeds viewport height on
    // small phones — content centers when it fits, scrolls when it doesn't.
    // z-[9000] clears Mapbox (z=2) and all map controls (z=1000).
    //
    // Frosted scrim: semi-transparent bone-450 + backdrop-blur so the live map
    // is faintly visible behind the splash text (which stays clearly readable).
    // To tune the effect, change the two CSS custom properties:
    //   --splash-scrim-opacity  (default 0.25) — higher = more opaque, less peek-through
    //   --splash-scrim-blur     (default 4px)  — higher = more frosted
    //
    // SponsorCredit is positioned on this outer fixed container so it pins to the
    // viewport corner and does NOT scroll with the content. There is no EN/ES toggle
    // on the splash — the two CTAs below set the language; the toggle lives on the map.
    <div
      className="fixed inset-0 z-[9000] overflow-y-auto"
      style={{
        // Frosted translucent scrim: ~bone-450 (interpolated darker tint) at ~25% opacity, 4px blur
        backgroundColor: 'rgba(182, 172, 139, var(--splash-scrim-opacity, 0.25))',
        backdropFilter: 'blur(var(--splash-scrim-blur, 4px))',
        WebkitBackdropFilter: 'blur(var(--splash-scrim-blur, 4px))',
      }}
      // Trap focus within the splash while it's shown.
      // role=dialog + aria-modal tells ATs this is a modal overlay.
      role="dialog"
      aria-modal="true"
      aria-label={t("splash.dialogLabel", locale)}
    >
      {/* ── Inner flex wrapper: centers content when it fits, lets it scroll naturally when tall ── */}
      <div className="flex min-h-full items-center justify-center">
        {/* ── Content column ── */}
        <div
          className={[
            // Full-width, capped at 820px, centered with side padding.
            // Wider cap lets "Pueblo Food Map" sit on one line at desktop sizes.
            'relative z-10 flex flex-col w-full max-w-[820px] text-center',
            'px-6 py-10 pt-16',
            // Roomier spacing between blocks so the text isn't bunched together
            'gap-7 md:gap-8',
            // Desktop: a touch more padding, same single-column layout
            'md:px-12 md:py-16 md:pt-16',
          ].join(' ')}
        >
          {/* Wordmark */}
          <div>
            <Wordmark
              size="xl"
              className="text-[var(--color-brand-navy)] block splash-text-outline"
            />
          </div>

          {/* Purpose subtitle (replaces the former tagline; takes its size + prominence) */}
          <div className="flex flex-col gap-3">
            <p
              className="text-2xl md:text-3xl font-semibold leading-normal text-[var(--color-brand-navy)] max-w-md mx-auto splash-text-outline"
              data-testid="splash-purpose"
            >
              {t('splash.purpose', locale)}
            </p>
          </div>

          {/* CTAs — one per language. Clicking sets the site language, then runs
              the find-food flow. (No EN/ES toggle on the splash.) */}
          <div className="flex flex-col gap-3 mt-1">
            {/* English entry */}
            <button
              type="button"
              lang="en"
              onClick={() => handleCtaClick('en')}
              className={[
                'w-full rounded-[var(--radius-md)] px-6 py-4 md:py-5',
                'text-lg md:text-xl font-semibold leading-none',
                'bg-[var(--color-brand-orange)] text-[var(--color-brand-navy)]',
                'hover:brightness-105 active:brightness-95',
                'transition-[filter] duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                'focus-visible:outline-[var(--color-brand-orange)]',
              ].join(' ')}
            >
              {t('splash.cta.primary', 'en')}
            </button>

            {/* Spanish entry — also switches the whole site to Spanish */}
            <button
              type="button"
              lang="es"
              onClick={() => handleCtaClick('es')}
              className={[
                'w-full rounded-[var(--radius-md)] px-6 py-4 md:py-5',
                'text-lg md:text-xl font-semibold leading-none',
                'bg-[var(--color-brand-orange)] text-[var(--color-brand-navy)]',
                'hover:brightness-105 active:brightness-95',
                'transition-[filter] duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                'focus-visible:outline-[var(--color-brand-orange)]',
              ].join(' ')}
            >
              {t('splash.cta.primary', 'es')}
            </button>
          </div>

          {/* Microcopy */}
          <p className="text-base md:text-lg leading-relaxed text-[var(--color-ink-500)] splash-text-outline-sm">
            {t('splash.microcopy', locale)}
          </p>
        </div>
      </div>

      {/* ── Sponsor credit — bottom-right corner (viewport-pinned, mirrors map) ── */}
      <SponsorCredit locale={locale} />
    </div>
  );
}
