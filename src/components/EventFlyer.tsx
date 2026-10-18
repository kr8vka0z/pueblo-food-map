"use client";

/**
 * EventFlyer — the flyer picture at the top of the event card (#760).
 *
 * It only exists inside EventCardBody, which is itself loaded only when a card
 * opens, so the image never loads with the map or the feed. The box is sized
 * from the stored width and height (`aspect-ratio`), so the card does not jump
 * when the bytes arrive, and capped in height so a tall portrait flyer cannot
 * fill a phone screen on its own.
 *
 * A flyer that is missing or fails to load renders NOTHING (no broken-image
 * icon, no empty frame). `onError` covers a failure after React attached; the
 * mount check covers one that failed before it did (a cached 404, or an error
 * that fired between the markup and hydration).
 *
 * Tapping opens the file full size in a new tab: a plain link, nothing to load
 * or keep open. Not draggable-selectable text, so no live-region or focus
 * handling is needed beyond a normal link.
 */

import { useEffect, useRef, useState } from "react";
import type { PublicFlyer } from "@/lib/events";

export interface EventFlyerProps {
  flyer: PublicFlyer;
  /** Already localized, with the event name as the last fallback. */
  alt: string;
}

export default function EventFlyer({ flyer, alt }: EventFlyerProps) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;
  return (
    <a
      href={flyer.src}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="event-flyer"
      className="block w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-bone-200)] bg-[var(--color-bone-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
      style={{ aspectRatio: `${flyer.width} / ${flyer.height}`, maxHeight: "min(55vh, 28rem)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a plain <img>: the Worker serves it already shrunk; next/image would add a loader and weight */}
      <img
        ref={imgRef}
        src={flyer.src}
        alt={alt}
        width={flyer.width}
        height={flyer.height}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    </a>
  );
}
