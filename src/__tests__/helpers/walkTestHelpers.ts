import { vi } from "vitest";
import type { Walk } from "@/lib/useWalkingRoute";

/** A card's `walk` prop for component tests: no route, no hint, unless overridden. */
export function makeWalk(over: Partial<Walk> = {}): Walk {
  return {
    onWalk: vi.fn(),
    isActive: false,
    onClear: vi.fn(),
    info: null,
    steps: null,
    showLocationHint: false,
    activeStepIndex: 0,
    onStepChange: vi.fn(),
    ...over,
  };
}
