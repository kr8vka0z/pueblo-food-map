import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

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
