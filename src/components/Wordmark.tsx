'use client';

/**
 * Wordmark — reusable brand wordmark.
 *
 * Uses the `.wordmark` utility class from globals.css (Fraunces + 0.04em letter-spacing).
 * Spec: docs/pueblo-food-map-v2-handoff.md §Open question #7
 *
 * Map-reset mode (#61):
 *   Pass `onClick` to render a <button> instead of a <span>. The button is
 *   positioned absolute top-left of the map (z-index 1000), meets the 44×44px
 *   minimum tap-target requirement, and carries a translated aria-label.
 */

import { t, type Locale } from '@/lib/i18n';

const SIZE_CLASSES = {
  sm: 'text-xl font-semibold',
  md: 'text-2xl font-semibold',
  lg: 'text-4xl font-bold',
  // xl is used exclusively in SplashScreen (display-only span mode).
  // Responsive: 4xl on mobile (safe at 375px) → 6xl on md+.
  xl: 'text-4xl md:text-6xl font-bold',
} as const;

// ─── Display-only mode (SplashScreen usage) ────────────────────────────────

interface WordmarkSpanProps {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  onClick?: undefined;
  locale?: Locale;
  /** Accepted but ignored in display-only (span) mode. Only applies to button mode. */
  selfPositioned?: boolean;
}

// ─── Map-reset button mode (#61) ───────────────────────────────────────────

interface WordmarkButtonProps {
  /** When provided, renders a <button> instead of a <span>. */
  onClick: () => void;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  /** Locale for aria-label translation. Defaults to "en". */
  locale?: Locale;
  /**
   * When false, omits the built-in `absolute top-4 left-4` positioning classes
   * so a parent container can own placement. Defaults to true.
   */
  selfPositioned?: boolean;
}

type WordmarkProps = WordmarkSpanProps | WordmarkButtonProps;

export default function Wordmark({ size = 'xl', className = '', onClick, locale = 'en', selfPositioned = true }: WordmarkProps) {
  const appName = t('app.name', locale);

  if (onClick) {
    // Button mode: map-reset affordance (#61)
    const ariaLabel = t('wordmark.ariaLabel', locale);
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={[
          'wordmark',
          // Positioning — absolute top-left when self-positioned
          ...(selfPositioned ? ['absolute top-4 left-4'] : []),
          // Visual — pill bg matching other map controls
          'bg-white/90 backdrop-blur-sm rounded-xl shadow-sm',
          // Mobile: min 44×44px tap target
          'min-h-[44px] min-w-[44px] px-3 py-2',
          // Typography size for map context (sole font-size declaration on this element)
          'text-sm md:text-base',
          // Interactive states
          'hover:bg-white active:scale-95',
          'transition-all duration-150',
          // Keyboard focus ring
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2',
          'cursor-pointer',
          className,
        ].join(' ').trim()}
        style={{ zIndex: 1000 }}
      >
        {appName}
      </button>
    );
  }

  // Display-only span mode (original, used in SplashScreen)
  return (
    <span className={`wordmark ${SIZE_CLASSES[size]} ${className}`.trim()}>
      Pueblo Food Map
    </span>
  );
}
