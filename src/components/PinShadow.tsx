/**
 * PinShadow — the map pins' soft shadow, drawn as plain SVG shapes (#722).
 *
 * WHY not a filter: the pins used CSS `filter: drop-shadow(0 2px 4px
 * rgba(0,0,0,0.25))`, and a filter is recomputed every time the browser
 * repaints the pin, which on a pan is every frame for ~130 pins. Plain
 * shapes paint for almost nothing.
 *
 * ponytail: the 4px blur is faked by five stacked, ever-wider translucent
 * copies of the shape, offset 2px down. Close to the old shadow at pin size;
 * if a pin ever grows large enough to show the steps, switch to a real
 * feGaussianBlur defined once for the whole map.
 */

import type { ReactNode } from "react";

/** Lucide's MapPin outline (24-unit box), shared by the place and event pins. */
export const PIN_PATH =
  "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0";

// Extra stroke width (px) and opacity per copy. Stacked, they give about
// 0.12 black at the shape's edge, fading to nothing 4 px out: the falloff of
// the old 4px CSS blur, in 1 px steps.
const LAYERS = [
  { grow: 8, opacity: 0.01 },
  { grow: 6, opacity: 0.015 },
  { grow: 4, opacity: 0.025 },
  { grow: 2, opacity: 0.03 },
  { grow: 1, opacity: 0.04 },
];

interface PinShadowProps {
  /** Screen px per SVG user unit, so the shadow is the same size on every pin. */
  px: number;
  /** Stroke width (user units) the real shape already has; the shadow grows from it. */
  baseStroke?: number;
  /** The shape(s) to cast a shadow from. Fill is black unless a child sets its own. */
  children: ReactNode;
}

export default function PinShadow({ px, baseStroke = 0, children }: PinShadowProps) {
  return (
    <g
      aria-hidden="true"
      transform={`translate(0 ${2 / px})`}
      fill="#000"
      stroke="#000"
      strokeLinejoin="round"
    >
      {LAYERS.map(({ grow, opacity }) => (
        <g key={grow} opacity={opacity} strokeWidth={baseStroke + grow / px}>
          {children}
        </g>
      ))}
    </g>
  );
}
