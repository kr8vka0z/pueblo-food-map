/**
 * SplashScreen — location already allowed but no fix yet (#894 item 2).
 *
 * A prior grant makes the hook report { granted, position: null } on load;
 * the CTA must wait for the fix instead of dropping to the Pueblo center.
 */

import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import SplashScreen from "@/components/SplashScreen";
import * as LocaleContext from "@/lib/LocaleContext";

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

const request = vi.fn();
let geoState: unknown;
vi.mock("@/lib/useGeolocation", () => ({
  useGeolocation: () => ({ state: geoState, request }),
}));

beforeEach(() => {
  request.mockClear();
  vi.spyOn(LocaleContext, "useLocale").mockReturnValue({ locale: "en", setLocale: vi.fn(), tree: "en" });
});

test("an already-granted permission waits for the position, then opens 'located'", () => {
  geoState = { permission: "granted", position: null };
  const onPrimary = vi.fn();
  const { container, rerender } = render(<SplashScreen onPrimary={onPrimary} />);

  fireEvent.click(container.querySelector('button[lang="en"]')!);
  expect(request).toHaveBeenCalledTimes(1);
  expect(onPrimary).not.toHaveBeenCalled();

  geoState = { permission: "granted", position: { lat: 38.25, lng: -104.6 } };
  rerender(<SplashScreen onPrimary={onPrimary} />);
  expect(onPrimary).toHaveBeenCalledTimes(1);
  expect(onPrimary).toHaveBeenCalledWith("located", undefined);
});
