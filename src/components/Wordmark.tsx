'use client';

/**
 * Wordmark — reusable brand wordmark.
 *
 * Uses the `.wordmark` utility class from globals.css (Fraunces + 0.04em letter-spacing).
 * Spec: docs/pueblo-food-map-v2-handoff.md §Open question #7
 */

const SIZE_CLASSES = {
  sm: 'text-xl font-semibold',
  md: 'text-2xl font-semibold',
  lg: 'text-4xl font-bold',
  xl: 'text-5xl font-bold',
} as const;

interface WordmarkProps {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export default function Wordmark({ size = 'xl', className = '' }: WordmarkProps) {
  return (
    <span className={`wordmark ${SIZE_CLASSES[size]} ${className}`.trim()}>
      Pueblo Food Map
    </span>
  );
}
