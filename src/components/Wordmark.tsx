/**
 * Wordmark — reusable brand wordmark (a display-only <span>; SplashScreen is its caller).
 *
 * Uses the `.wordmark` utility class from globals.css (Fraunces + 0.04em letter-spacing).
 * Spec: docs/pueblo-food-map-v2-handoff.md §Open question #7
 * Responsive size: 4xl on mobile (safe at 375px) → 6xl on md+.
 */

export default function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`wordmark text-4xl md:text-6xl font-bold ${className}`.trim()}>
      Pueblo Food Map
    </span>
  );
}
