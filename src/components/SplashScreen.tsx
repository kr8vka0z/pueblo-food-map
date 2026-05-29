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
 * Props interface and localStorage gate (pfm.splash.seen.v2) are unchanged.
 */

import { useCallback, useEffect, useState } from 'react';
import Wordmark from './Wordmark';
import LanguageToggle from './LanguageToggle';
import { useGeolocation } from '@/lib/useGeolocation';
import { useLocale } from '@/lib/LocaleContext';
import { t } from '@/lib/i18n';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SplashScreenProps {
  /** Called after geo request resolves (granted → 'located') or is denied → 'pueblo-center' */
  onPrimary: (mode: 'located' | 'pueblo-center') => void;
  /** Called when user skips geo — always 'pueblo-center' */
  onSecondary: () => void;
}

// ─── SplashScreen ──────────────────────────────────────────────────────────────

export default function SplashScreen({ onPrimary, onSecondary }: SplashScreenProps) {
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

  // ── i18n values ──────────────────────────────────────────────────────────────
  const sponsorPrefix = t('splash.sponsor.prefix', locale);
  const sponsorLinkLabel = `Pueblo Food Project (${t('splash.sponsor.newTab', locale)})`;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-brand-navy)' }}
    >
      {/* Subtle radial highlight — visual polish, not structural */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 40%, rgba(247,148,60,0.07) 0%, transparent 70%)',
        }}
      />

      {/* ── Language toggle — top-right corner ── */}
      <div className="absolute top-4 right-4" style={{ zIndex: 10 }}>
        <LanguageToggle />
      </div>

      {/* ── Content column ── */}
      <div
        className={[
          // Mobile: full-width, capped at 520px, centered with side padding
          'relative z-10 flex flex-col w-full max-w-[520px]',
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
            className="text-[var(--color-bone-50)] block"
          />
        </div>

        {/* Tagline + purpose */}
        <div className="flex flex-col gap-2">
          <p className="text-xl font-semibold leading-snug text-[var(--color-bone-50)] max-w-md">
            {t('splash.tagline', locale)}
          </p>
          <p
            className="text-[15px] leading-relaxed text-[var(--color-ink-400)] max-w-md"
            data-testid="splash-purpose"
          >
            {t('splash.purpose', locale)}
          </p>
        </div>

        {/* CTAs */}
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

          {/* Secondary CTA */}
          <button
            type="button"
            onClick={onSecondary}
            aria-label={t('splash.cta.secondary.aria', locale)}
            className={[
              'w-full py-3 px-6 text-base font-medium',
              'text-[var(--color-bone-100)] underline underline-offset-2',
              'hover:text-[var(--color-bone-50)]',
              'transition-colors duration-150',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              'focus-visible:outline-[var(--color-bone-100)] rounded-sm',
            ].join(' ')}
          >
            {t('splash.cta.secondary', locale)}
          </button>
        </div>

        {/* Microcopy */}
        <p className="text-[13px] leading-relaxed text-[var(--color-ink-400)]">
          {t('splash.microcopy', locale)}
        </p>

        {/* Divider */}
        <div
          aria-hidden="true"
          className="w-full border-t border-white/10"
        />

        {/* Sponsor credit */}
        <p className="text-[13px] text-[var(--color-ink-400)] leading-snug">
          <span>{sponsorPrefix}</span>
          <a
            href="https://pueblofoodproject.org/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={sponsorLinkLabel}
            className={[
              'font-medium text-[var(--color-bone-100)]',
              'underline underline-offset-2 decoration-white/30',
              'hover:text-[var(--color-bone-50)] hover:decoration-white/60',
              'transition-colors duration-150',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              'focus-visible:outline-[var(--color-bone-100)] rounded-sm',
            ].join(' ')}
          >
            Pueblo Food Project
          </a>
        </p>
      </div>
    </div>
  );
}
