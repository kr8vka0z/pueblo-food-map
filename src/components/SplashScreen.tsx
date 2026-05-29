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
import LanguageToggle from './LanguageToggle';
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
  const { locale } = useLocale();

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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      // Full-viewport overlay above the map. z-[9000] clears Mapbox (z=2) and
      // all map controls (z=1000). Fixed so it doesn't scroll with content.
      //
      // Frosted scrim: semi-transparent bone-50 + backdrop-blur so the live map
      // is faintly visible behind the splash text (which stays clearly readable).
      // To tune the effect, change the two CSS custom properties below:
      //   --splash-scrim-opacity  (default 0.25) — higher = more opaque, less peek-through
      //   --splash-scrim-blur     (default 4px)  — higher = more frosted
      className="fixed inset-0 z-[9000] flex items-center justify-center"
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
      aria-label="Welcome — find food near you"
    >
      {/* ── Language toggle — top-right corner ── */}
      <div className="absolute top-4 right-4" style={{ zIndex: 10 }}>
        <LanguageToggle />
      </div>

      {/* ── Content column ── */}
      <div
        className={[
          // Mobile: full-width, capped at 520px, centered with side padding
          'relative z-10 flex flex-col w-full max-w-[520px] text-center',
          'px-6 py-10 pt-16',
          // Mobile: comfortable spacing between blocks
          'gap-5',
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

        {/* Tagline + purpose */}
        <div className="flex flex-col gap-2">
          <p className="text-xl font-semibold leading-snug text-[var(--color-brand-navy)] max-w-md mx-auto splash-text-outline">
            {t('splash.tagline', locale)}
          </p>
          <p
            className="text-[15px] leading-relaxed text-[var(--color-ink-500)] max-w-md mx-auto splash-text-outline"
            data-testid="splash-purpose"
          >
            {t('splash.purpose', locale)}
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3 mt-1">
          {/* Primary CTA */}
          <button
            type="button"
            onClick={handlePrimaryClick}
            className={[
              'w-full rounded-[var(--radius-md)] px-6 py-4',
              'text-base font-semibold leading-none',
              'bg-[var(--color-brand-orange)] text-[var(--color-brand-navy)]',
              'hover:brightness-105 active:brightness-95',
              'transition-[filter] duration-150',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              'focus-visible:outline-[var(--color-brand-orange)]',
            ].join(' ')}
          >
            {t('splash.cta.primary', locale)}
          </button>
        </div>

        {/* Microcopy */}
        <p className="text-[13px] leading-relaxed text-[var(--color-ink-500)] splash-text-outline">
          {t('splash.microcopy', locale)}
        </p>
      </div>

      {/* ── Sponsor credit — bottom-right corner (mirrors map) ── */}
      <SponsorCredit locale={locale} />
    </div>
  );
}
