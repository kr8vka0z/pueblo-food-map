/**
 * BoxCheckinPanel — no status tap while a photo uploads (#894 item 5).
 *
 * The upload holds the single-use Turnstile token until it answers; a status
 * tap in that window sent the same token again and failed. The status buttons
 * are disabled until the upload finishes, then a tap posts normally.
 */

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/lib/LocaleContext";

vi.mock("@/lib/imageResize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/imageResize")>()),
  shrinkImageToJpeg: async () => new Blob(["shrunk"], { type: "image/jpeg" }),
}));

import BoxCheckinPanel from "@/components/BoxCheckinPanel";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  // Like the real widget (execution "render"): reset() hands back a fresh token.
  let callback: ((tok: string) => void) | undefined;
  let n = 0;
  vi.stubGlobal("turnstile", {
    render: vi.fn((_c: HTMLElement, opts: { callback?: (tok: string) => void }) => {
      callback = opts.callback;
      callback?.("token-1");
      return "widget-id";
    }),
    reset: vi.fn(() => setTimeout(() => callback?.(`token-${(n += 1) + 1}`), 0)),
    remove: vi.fn(),
  });
  window.localStorage.clear();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:fake"), revokeObjectURL: vi.fn() }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

test("status buttons are disabled while a photo uploads, and a status tap works once it finishes", async () => {
  let finishUpload!: (v: unknown) => void;
  mockFetch.mockImplementationOnce(() => new Promise((r) => (finishUpload = r)));
  const user = userEvent.setup();
  render(
    <LocaleProvider initialLocale="en">
      <BoxCheckinPanel boxId="box-1" onCheckinSuccess={vi.fn()} />
    </LocaleProvider>,
  );

  await user.click(await screen.findByRole("button", { name: "Add a photo" }));
  await user.upload(
    document.getElementById("box-photo-standalone-input") as HTMLInputElement,
    new File(["bytes"], "photo.jpg", { type: "image/jpeg" }),
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
  await user.click(screen.getByRole("button", { name: "Send" }));

  const statusButtons = ["I filled it", "Running low", "It's empty", "I used this box"].map((name) =>
    screen.getByRole("button", { name }),
  );
  for (const b of statusButtons) expect(b).toBeDisabled();

  await act(async () => finishUpload({ ok: true, json: async () => ({ ok: true }) }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Running low" })).toBeEnabled());

  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, status: "low", lastFilledAt: null }) });
  await user.click(screen.getByRole("button", { name: "Running low" }));
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  const [url, init] = mockFetch.mock.calls[1] as [string, RequestInit];
  expect(url).toBe("/api/public/blessing-boxes/box-1/checkins");
  expect(JSON.parse(init.body as string)).toMatchObject({ kind: "low", turnstileToken: "token-2" });
});
