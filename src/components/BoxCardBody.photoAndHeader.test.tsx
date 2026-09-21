/**
 * BoxCardBody tests for #508 (photo -> PhotoViewer) and #515 (badge/name/
 * actions row split). New file rather than additions to BoxCardBody.test.tsx
 * — this repo's bug-fix-branch hook refuses edits to an existing test file
 * (a fix is proven by a test that predates it), so each of these two issues'
 * NEW behavior gets its own coverage here instead.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/lib/LocaleContext";
import BoxCardBody from "@/components/BoxCardBody";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

const mockTurnstile = {
  render: vi.fn((_container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-turnstile-token");
    return "widget-id-1";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockTurnstile.render.mockClear();
  vi.stubGlobal("turnstile", mockTurnstile);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const BASE_BOX: PublicBlessingBox = {
  id: "test-box-1",
  name: "Practice Blessing Box #1 (TEST DATA)",
  category: "blessing_box",
  lat: 38.27,
  lng: -104.61,
  address: "123 Test St, Pueblo, CO",
  source: "manual",
  last_verified: "2026-09-01T00:00:00.000Z",
  box: {
    hostName: null,
    hostNote: null,
    mostNeeded: null,
    installedOn: "2026-01-01",
    removedOn: null,
    status: "stocked",
    lastFilledAt: "2026-09-17T09:00:00.000Z",
    recentCheckins: [],
    latestPhoto: null,
    adopters: [],
  },
};

function renderCard(box: Partial<PublicBlessingBox["box"]> = {}, actions?: React.ReactNode) {
  const fullBox: PublicBlessingBox = { ...BASE_BOX, box: { ...BASE_BOX.box, ...box } };
  return render(
    <LocaleProvider initialLocale="en">
      <BoxCardBody box={fullBox} actions={actions} nameId="test-name-id" />
    </LocaleProvider>,
  );
}

describe("BoxCardBody — photo opens PhotoViewer full size (#508)", () => {
  test("the photo is wrapped in a 'View photo full size' button, closed by default", () => {
    renderCard({ latestPhoto: { id: 42, createdAt: "2026-09-17T09:00:00.000Z" } });
    const trigger = screen.getByRole("button", { name: "View photo full size" });
    expect(trigger.querySelector("img")).not.toBeNull();
    const dialog = screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
    expect(dialog.open).toBe(false);
  });

  test("tapping the photo opens the viewer showing the same photo and its caption", async () => {
    const user = userEvent.setup();
    renderCard({ latestPhoto: { id: 42, createdAt: "2026-09-17T09:00:00.000Z" } });
    await user.click(screen.getByRole("button", { name: "View photo full size" }));
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    // Two <img>s now exist (card thumbnail + viewer's full-size copy) —
    // scope to the dialog to check the viewer's own.
    const dialogImg = dialog.querySelector("img");
    expect(dialogImg?.getAttribute("src")).toBe("/api/public/box-photos/42");
    expect(dialog.textContent).toContain("Photo ·");
  });

  test("closing the viewer (× button) returns it to closed", async () => {
    const user = userEvent.setup();
    renderCard({ latestPhoto: { id: 42, createdAt: "2026-09-17T09:00:00.000Z" } });
    await user.click(screen.getByRole("button", { name: "View photo full size" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    const dialog = screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
    expect(dialog.open).toBe(false);
  });
});

// #515 — badge + actions share row 1; the name is its own full-width row 2.
describe("BoxCardBody — header row split (#515)", () => {
  test("badge and actions render together in one row, ahead of the name in DOM order", () => {
    renderCard({}, <button type="button">Close</button>);
    const badge = screen.getByText("Blessing Box");
    const actionButton = screen.getByRole("button", { name: "Close" });
    const name = screen.getByText("Practice Blessing Box #1 (TEST DATA)");

    // Badge and the caller's action share a common row ancestor...
    const badgeRow = badge.parentElement;
    expect(badgeRow?.contains(actionButton)).toBe(true);
    // ...and that row is the name's previous sibling, not its ancestor —
    // i.e. the name is a sibling row, not squeezed into the same flex row.
    expect(badgeRow?.nextElementSibling).toBe(name);
  });

  test("the name is still the labelled heading (nameId) with no actions", () => {
    renderCard({});
    const name = screen.getByText("Practice Blessing Box #1 (TEST DATA)");
    expect(name.id).toBe("test-name-id");
  });
});
