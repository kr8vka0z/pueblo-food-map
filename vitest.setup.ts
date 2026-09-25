import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// This app serves one physical city (Pueblo, CO, America/Denver) and every
// weekly-hours call site is client-only ("use client" — BottomSheet,
// DesktopVenueWindow, VenueCard, useMapFilters), so computeOpenStatus()'s
// use of the ambient process clock (now.getDay()/getHours(), src/lib/hours.ts)
// is correct for a real visitor's own browser. It's wrong on a CI runner,
// which defaults to UTC: hoursIrregular.test.ts's "weekly open takes
// priority" case (mixing weekly + Denver-forced irregular hours) is the
// first test to depend on that ambient TZ matching Denver, and has failed
// on every GitHub Actions run since #400 landed it (commit a7d5f4c) while
// passing locally on a Denver-TZ Mac. Pinning here, not per-test, since any
// future weekly-hours test would hit the same gap. Node >=13 honors a
// runtime process.env.TZ write; this must run before any test file does.
process.env.TZ = "America/Denver";

// jsdom (pinned version, see package.json) ships an empty HTMLDialogElement
// implementation — no showModal()/close(), just the plain HTMLElement it
// extends (verified against node_modules/jsdom/lib/jsdom/living/nodes/
// HTMLDialogElement-impl.js). PhotoViewer.tsx (#508) uses the real spec'd
// API — showModal()/close(), listening for the native `close` event — which
// is correct for production browsers but throws "not a function" under
// jsdom without this. Polyfill only the two methods, backed by the `open`
// property jsdom DOES already reflect to the `open` attribute, and firing
// the same `close` event a real browser fires on close() — so any component
// (this one, and future dialog-based components) can treat `close` as its
// one source of truth in both test and production.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };

  // Real browsers close a modal <dialog> on Escape via the CloseWatcher API
  // — a mechanism decoupled from the keydown DOM event's own capture/bubble
  // dispatch, not a competing addEventListener. jsdom implements neither.
  // This polyfills the OBSERVABLE effect (the dialog closes) but must NOT
  // reproduce it as a same-phase listener: BottomSheet.tsx/
  // DesktopVenueWindow.tsx (#508 fix, see dialogGuard.ts) gate their own
  // Escape-dismiss on "is a dialog still open" DURING this same keydown's
  // synchronous dispatch — a listener here that closed the dialog
  // synchronously could run before or after those guards depending on
  // registration order, silently reintroducing the exact race the fix
  // exists to avoid. queueMicrotask defers the actual close() until after
  // the whole (fully synchronous) event dispatch — every listener in every
  // phase — has already run and read the dialog as still open, matching
  // real browsers closely enough for this to be a reliable test signal
  // rather than a coincidence of listener registration order.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const openDialog = document.querySelector("dialog[open]");
    if (!openDialog) return;
    queueMicrotask(() => (openDialog as HTMLDialogElement).close());
  });
}

// Provide default mock for next/navigation so client components calling useRouter()
// render cleanly in jsdom tests without needing per-file boilerplate.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});
