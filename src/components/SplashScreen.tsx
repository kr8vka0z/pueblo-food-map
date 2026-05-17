'use client';

/**
 * SplashScreen — v2 first-visit entry.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md
 *   §Mobile · 375 x 812 · splash
 *   §Desktop · 1440 x 900 · splash
 *   Open questions #4, #5, #8, #9
 *
 * - Single responsive component; md: breakpoint (≥768px) switches to 2-column desktop layout.
 * - Geolocation requested ONLY on primary CTA tap (open question #5).
 * - Desktop layout: "WHAT YOU'LL FIND" header lives above the right-column category grid (option b, open question #8).
 * - "How it works" 8th card fires a "Coming soon" toast (open question #9 stub).
 * - EN-only for demo.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Wordmark from './Wordmark';
import { useGeolocation } from '@/lib/useGeolocation';

// ─── Category data ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Food pantry',        colorVar: 'var(--color-cat-pantry)' },
  { label: 'Grocery store',      colorVar: 'var(--color-cat-grocery)' },
  { label: 'Convenience store',  colorVar: 'var(--color-cat-convenience)' },
  { label: 'Farm',               colorVar: 'var(--color-cat-farm)' },
  { label: 'Community garden',   colorVar: 'var(--color-cat-garden)' },
  { label: 'Edible landscape',   colorVar: 'var(--color-cat-landscape)' },
  { label: 'Meal site',          colorVar: 'var(--color-cat-meal)' },
] as const;

// ─── Sub-components ────────────────────────────────────────────────────────────

function CategorySwatch({ label, colorVar }: { label: string; colorVar: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: colorVar }}
        aria-hidden="true"
      />
      <span className="text-sm font-medium text-[var(--color-bone-100)] leading-tight">
        {label}
      </span>
    </div>
  );
}

function CategoryCard({ label, colorVar }: { label: string; colorVar: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 bg-white/10"
    >
      <span
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: colorVar }}
        aria-hidden="true"
      />
      <span className="text-sm font-semibold text-[var(--color-bone-100)] leading-tight">
        {label}
      </span>
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function ComingSoonToast({ visible }: { visible: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={[
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'px-5 py-3 rounded-[var(--radius-full)]',
        'bg-[var(--color-bone-100)] text-[var(--color-brand-navy)]',
        'text-sm font-semibold shadow-lg',
        'transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      Coming soon
    </div>
  );
}

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

  // Track whether a geo request is in flight so we know to watch for state changes.
  const [geoRequested, setGeoRequested] = useState(false);

  // "Coming soon" toast state
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Resolve after geo request ────────────────────────────────────────────────
  // When the user taps "Find food near me", we call geo.request() and then
  // watch for the state to leave 'prompt'. Once it settles we call onPrimary.
  useEffect(() => {
    if (!geoRequested) return;
    // Still waiting for browser prompt to resolve
    if (geo.state.permission === 'prompt') return;

    // State has settled — granted or denied
    const mode: 'located' | 'pueblo-center' =
      geo.state.permission === 'granted' && geo.state.position !== null
        ? 'located'
        : 'pueblo-center';

    onPrimary(mode);
  }, [geoRequested, geo.state, onPrimary]);

  const handlePrimaryClick = useCallback(() => {
    // If already granted with a position (e.g. they refreshed after prior grant),
    // skip the browser prompt entirely.
    if (geo.state.permission === 'granted' && geo.state.position !== null) {
      onPrimary('located');
      return;
    }
    // If already denied, skip straight to Pueblo center.
    if (geo.state.permission === 'denied') {
      onPrimary('pueblo-center');
      return;
    }
    // Otherwise request; the useEffect above will fire once state settles.
    setGeoRequested(true);
    geo.request();
  }, [geo, onPrimary]);

  const handleHowItWorksClick = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen w-full flex flex-col md:flex-row"
      style={{ backgroundColor: 'var(--color-brand-navy)' }}
    >
      {/* ── Mobile layout (default) + Desktop left column ── */}
      <div
        className={[
          // Mobile: full-width vertical stack with 24px side padding
          'flex flex-col justify-center gap-8 px-6 py-10',
          // Desktop: fixed ~480px wide left column with 64px padding
          'md:w-[480px] md:flex-shrink-0 md:px-16 md:py-16',
        ].join(' ')}
      >
        {/* Wordmark */}
        <div>
          <Wordmark
            size="xl"
            className="text-[var(--color-bone-50)] block"
          />
        </div>

        {/* Tagline */}
        <p
          className="text-lg leading-relaxed text-[var(--color-bone-100)] font-medium max-w-sm"
        >
          Find food close to home — pantries, gardens, grocery, and more.
        </p>

        {/* Mobile-only: categories list (desktop gets the right column grid) */}
        <div className="flex flex-col gap-4 md:hidden">
          {CATEGORIES.map((cat) => (
            <CategorySwatch key={cat.label} label={cat.label} colorVar={cat.colorVar} />
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-4">
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
            Find food near me
          </button>

          {/* Secondary CTA */}
          <button
            type="button"
            onClick={onSecondary}
            aria-label="Show the Pueblo map without using my location"
            className={[
              'w-full py-3 px-6 text-base font-medium',
              'text-[var(--color-bone-100)] underline underline-offset-2',
              'hover:text-[var(--color-bone-50)]',
              'transition-colors duration-150',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              'focus-visible:outline-[var(--color-bone-100)] rounded-sm',
            ].join(' ')}
          >
            Show the Pueblo map
          </button>
        </div>

        {/* Microcopy */}
        <p
          className="text-[14px] leading-relaxed text-[var(--color-ink-400)]"
        >
          We only use your location to show food nearby. Nothing is saved.
        </p>
      </div>

      {/* ── Desktop right column: "WHAT YOU'LL FIND" header + category grid ── */}
      {/* Hidden on mobile; shown md+ */}
      <div
        className={[
          'hidden md:flex md:flex-col md:flex-1',
          'justify-center px-12 py-16',
          'border-l border-white/10',
        ].join(' ')}
      >
        {/* Header above grid — option (b) from open question #8 */}
        <h2
          className="text-xs font-bold tracking-widest uppercase text-[var(--color-ink-400)] mb-6"
        >
          What you&apos;ll find
        </h2>

        {/* 2-column category card grid (7 categories + 1 stub = 8 cells) */}
        <div className="grid grid-cols-2 gap-3 max-w-lg">
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat.label} label={cat.label} colorVar={cat.colorVar} />
          ))}

          {/* 8th cell: "How it works" stub (open question #9) */}
          <button
            type="button"
            onClick={handleHowItWorksClick}
            className={[
              'flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3',
              'bg-white/5 border border-white/20',
              'hover:bg-white/10 transition-colors duration-150',
              'text-sm font-semibold text-[var(--color-bone-100)] leading-tight',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              'focus-visible:outline-[var(--color-bone-100)]',
              'cursor-pointer',
            ].join(' ')}
          >
            How it works →
          </button>
        </div>
      </div>

      {/* Toast for "How it works" stub */}
      <ComingSoonToast visible={toastVisible} />
    </div>
  );
}
