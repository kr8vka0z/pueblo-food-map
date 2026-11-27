/**
 * AdminSuccessTick — restrained draw-in check mark from the design library
 * (`assets/feature-library/success-tick`), tinted sage-700, no confetti.
 * Reserved for rare, high-stakes completions (PublishPanel after publishing to
 * the public map, EventForm after saving/publishing an event).
 */
export default function AdminSuccessTick({ size = 24 }: { size?: number }) {
  return (
    <svg
      className="pfm-success-tick shrink-0"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="21" pathLength={1} transform="rotate(-90 24 24)" />
      <path d="M15 24.5l6 6 12-13" pathLength={1} />
    </svg>
  );
}
