/**
 * EventFlyerField (#760): the behavior that can lose an admin's work —
 * a wrong file type never reaches the network, a successful upload hands the
 * new `updated_at` up (else the form's next Save would 409), a server rejection
 * shows its field message, and create mode offers no upload.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/imageResize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/imageResize")>()),
  shrinkFlyerToJpeg: vi.fn(async () => new Blob(["small"], { type: "image/jpeg" })),
}));

import EventFlyerField from "@/components/EventFlyerField";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const pick = (file: File) => fireEvent.change(screen.getByLabelText("Flyer image file"), { target: { files: [file] } });

describe("EventFlyerField", () => {
  test("create mode (no event yet) offers no file input", () => {
    render(<EventFlyerField onVersion={vi.fn()} />);
    expect(screen.queryByLabelText("Flyer image file")).toBeNull();
  });

  test("a non-image file is refused in the browser, with no request sent", async () => {
    render(<EventFlyerField eventId="e1" version="v1" onVersion={vi.fn()} />);
    pick(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a file with a blank reported type (some Android pickers) is still tried, not refused up front", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, errors: { flyer: "nope" } }), { status: 422 }));
    render(<EventFlyerField eventId="e1" version="v1" onVersion={vi.fn()} />);
    pick(new File(["x"], "photo", { type: "" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  test("a good upload posts the shrunk file with the version, then reports the new version and shows the preview", async () => {
    const onVersion = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, updated_at: "v2", flyer: { src: "/api/public/events/e1/flyer/a.jpg", width: 10, height: 20, alt: null, alt_es: null } }), { status: 200 }),
    );
    render(<EventFlyerField eventId="e1" version="v1" onVersion={onVersion} />);

    pick(new File(["x"], "big.png", { type: "image/png" }));

    await waitFor(() => expect(onVersion).toHaveBeenCalledWith("v2"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/events/e1/flyer");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("expectedUpdatedAt")).toBe("v1");
    expect((init.body as FormData).get("flyer")).toBeInstanceOf(Blob);
    expect(await screen.findByRole("img")).toBeInTheDocument();
  });

  test("a server rejection shows its message and leaves the version alone", async () => {
    const onVersion = vi.fn();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, errors: { flyer: "That image is too large. Choose a smaller one." } }), { status: 413 }));
    render(<EventFlyerField eventId="e1" version="v1" onVersion={onVersion} />);

    pick(new File(["x"], "big.jpg", { type: "image/jpeg" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("too large");
    expect(onVersion).not.toHaveBeenCalled();
  });
});
