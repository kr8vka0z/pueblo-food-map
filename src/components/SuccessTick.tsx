/**
 * SuccessTick — house success-tick SVG animation (design feature library, #959).
 *
 * Circle draws first (260ms), then the checkmark (starts at 210ms, 470ms total).
 * Pure CSS animation in globals.css; prefers-reduced-motion shows it already drawn.
 * Always decorative (`aria-hidden="true"`) beside visible confirmation copy.
 */

export default function SuccessTick({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`pfm-success-tick shrink-0 ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="21" pathLength="1" transform="rotate(-90 24 24)" />
      <path d="M15 24.5l6 6 12-13" pathLength="1" />
    </svg>
  );
}
