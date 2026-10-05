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
 *   - Sponsor credit moved to bottom-right corner. Removed entirely 2026-09-16
 *     (Kyle): the sponsor credit lives only at the top of the Menu drawer now.
 *   - Removed hairline divider (no longer needed without in-column credit).
 *   - onSecondary prop removed.
 *
 * Props interface and localStorage gate (pfm.splash.seen.v2) are unchanged.
 */

import { useCallback, useEffect, useState } from 'react';
import Wordmark from './Wordmark';
import { useGeolocation, type LocationFailure } from '@/lib/useGeolocation';
import { useLocale, writeLocaleCookie } from '@/lib/LocaleContext';
import { markSplashSeen } from '@/lib/splashGate';
import { track, EVENTS } from '@/lib/analytics';
import { t } from '@/lib/i18n';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SplashScreenProps {
  /**
   * Called after geo request resolves (granted → 'located') or fails → 'pueblo-center'.
   * `failure` is set on the failing path so the map can explain it (#739):
   * MapWrapper runs its own geolocation hook and never sees this one's result.
   */
  onPrimary: (mode: 'located' | 'pueblo-center', failure?: LocationFailure) => void;
  /**
   * True while HomePageClient hasn't resolved the gate yet (server HTML and
   * first client render). Marks the root so globals.css can hide it for
   * returning visitors; absent once resolved so a re-shown splash (#99) stays visible.
   */
  pending?: boolean;
}

// ─── SplashScreen ──────────────────────────────────────────────────────────────

export default function SplashScreen({ onPrimary, pending }: SplashScreenProps) {
  const geo = useGeolocation();
  const { locale, setLocale, tree } = useLocale();

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

    onPrimary(
      mode,
      geo.state.permission === 'denied' || geo.state.permission === 'failed'
        ? geo.state
        : undefined,
    );
  }, [geoRequested, geo.state, onPrimary]);

  const handlePrimaryClick = useCallback(() => {
    if (geo.state.permission === 'granted' && geo.state.position !== null) {
      onPrimary('located');
      return;
    }
    // Only a real refusal short-circuits. A timeout/unavailable failure
    // (permission 'failed', #738) falls through so this tap tries again; its
    // eventual fallback to Pueblo-center is the resolve effect above.
    if (geo.state.permission === 'denied') {
      // Already refused on an earlier visit: still tell them why (#739).
      onPrimary('pueblo-center', geo.state);
      return;
    }
    setGeoRequested(true);
    geo.request();
  }, [geo, onPrimary]);

  // Each splash CTA sets the site language to its own language, then runs the
  // standard find-food flow. (The EN/ES toggle lives on the map view, not here.)
  //
  // Review fix (#689 PR 2, round 2): this splash mounts on /es too
  // (HomePageClient, shared by both trees). setLocale() only flips the
  // CLIENT-side `locale` state — it can never change `tree`, which is fixed
  // by which root layout served the page (LocaleContext.tsx).
  //
  // ONLY the ES-tree-picks-English case needs a cross-tree navigation:
  // Kyle's decision 2 on #689 keeps "/" with an es cookie on TODAY's
  // in-page client-side Spanish (no server-side redirect, no auto-
  // navigation — AGENTS.md hard rule) — so picking Spanish on the EN
  // splash stays the ORIGINAL plain in-place setLocale (this is the
  // decision, not an oversight: the earlier round of this fix made EN+ES
  // cross-navigate too, which was wrong). Picking English on the /es
  // splash is different: there's no way to render an English BODY under
  // an /es URL in the first place (server metadata/hreflang/JSON-LD would
  // still say Spanish), so that one case navigates to the EN tree's home,
  // "/?near=1" — near=1 so the destination runs the same geo-locate flow
  // this CTA promises instead of landing on a bare map. markSplashSeen()
  // runs FIRST: HomePageClient's own effect only skips the splash via
  // ?near=1 for THIS one page load (see its own header) — without also
  // writing the persistent gate, a later visit with no ?near=1 in the URL
  // would show the EN splash again, undoing the choice just made.
  const handleCtaClick = useCallback(
    (lang: 'en' | 'es') => {
      // #738: the splash CTA is the main "Find food near me" entry but fired no
      // named event, so the dashboard undercounted taps. First line, before the
      // cross-tree navigation below, so that branch is counted too.
      void track(EVENTS.NEAR_ME_CLICKED, { source: 'splash' });
      if (tree === 'es' && lang === 'en') {
        markSplashSeen();
        writeLocaleCookie('en');
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- WHY not router.push(): this crosses root layouts (/es -> (site)), always a full page load (design decision 2) — router.push does a client-side soft nav that can't switch root layouts. Same intentional choice LanguageToggle.tsx's mirrored links make.
        window.location.assign('/?near=1');
        return;
      }
      setLocale(lang);
      handlePrimaryClick();
    },
    [tree, setLocale, handlePrimaryClick],
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
    // There is no EN/ES toggle
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
      // #590: point at the existing purpose paragraph below (id="splash-purpose")
      // rather than adding new hidden copy — it already reads as a description.
      aria-describedby="splash-purpose"
      data-splash-pending={pending ? '' : undefined}
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
              id="splash-purpose"
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

            {/* Spanish entry — also switches the whole site to Spanish.
                #600: "Encuentra comida cerca de mí" wrapped "mí" alone onto
                its own line at 360-375px. text-balance re-picks the wrap
                point so a forced 2-line break splits evenly instead of
                greedily (no lone trailing word); px-4 below `sm` frees a
                little more width first so it's less likely to wrap at all.
                py-4/md:py-5 (tap-target height) is untouched and identical
                to the English button above. */}
            <button
              type="button"
              lang="es"
              onClick={() => handleCtaClick('es')}
              className={[
                'w-full rounded-[var(--radius-md)] px-4 sm:px-6 py-4 md:py-5',
                'text-lg md:text-xl font-semibold leading-none text-balance',
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
    </div>
  );
}
