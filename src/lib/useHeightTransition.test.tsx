/**
 * useHeightTransition.test.tsx — the rules that decide whether the sheet
 * animates (#882 preview feedback): a toggle animates old -> new height, and
 * reduced motion or `enabled: false` (the sheet while a walk route is active)
 * stay instant. jsdom has no layout or Web Animations, so the element's height
 * and `animate` are stubbed; what the browser does with the keyframes is
 * checked by hand in a real browser (see the PR).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "@testing-library/react";
import { useHeightTransition } from "@/lib/useHeightTransition";

let height = 100;
const animate = vi.fn(() => ({ addEventListener: vi.fn(), cancel: vi.fn(), playState: "running" }));

function Box({ open, enabled = true }: { open: boolean; enabled?: boolean }) {
  const ref = useHeightTransition(open, { enabled });
  return <div ref={ref} />;
}

function setReducedMotion(on: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: on }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  height = 100;
  animate.mockClear();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ height }) as DOMRect);
  (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
  setReducedMotion(false);
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
});

describe("useHeightTransition", () => {
  test("a toggle animates from the old height to the new one", () => {
    const view = render(<Box open={false} />);
    height = 300;
    view.rerender(<Box open />);

    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes] = animate.mock.calls[0] as unknown as [{ height: string }[]];
    expect(keyframes.map((k) => k.height)).toEqual(["100px", "300px"]);
  });

  test.each([
    ["reduced motion", () => setReducedMotion(true), true],
    ["disabled (walk route active)", () => {}, false],
  ])("%s: instant, no animation", (_name, setup, enabled) => {
    setup();
    const view = render(<Box open={false} enabled={enabled} />);
    height = 300;
    view.rerender(<Box open enabled={enabled} />);

    expect(animate).not.toHaveBeenCalled();
  });
});
