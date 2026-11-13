/**
 * EventFlyerField (#760): the behavior that can lose an admin's work —
 * a wrong file type never reaches the network, a successful upload hands the
 * new `updated_at` up (else the form's next Save would 409), a server rejection
 * shows its field message, create mode offers no upload, and Remove sends
 * nothing until the on-page confirm's second press.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

  describe("Remove asks on the page first", () => {
    const flyer = { src: "/api/public/events/e1/flyer/a.jpg", width: 10, height: 20, alt: null, alt_es: null };

    test("pressing Cancel in the confirm sends nothing", async () => {
      const user = userEvent.setup();
      render(<EventFlyerField eventId="e1" version="v1" onVersion={vi.fn()} initialFlyer={flyer} />);
      await user.click(screen.getByRole("button", { name: /^remove$/i }));
      expect(fetchMock).not.toHaveBeenCalled(); // the first press only opens the confirm
      await user.click(screen.getByRole("button", { name: /^cancel$/i }));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /^remove$/i })).toHaveFocus();
    });

    test("only the confirm's Remove flyer button deletes it, with the version", async () => {
      const user = userEvent.setup();
      const onVersion = vi.fn();
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, updated_at: "v2", flyer: null }), { status: 200 }));
      render(<EventFlyerField eventId="e1" version="v1" onVersion={onVersion} initialFlyer={flyer} />);
      await user.click(screen.getByRole("button", { name: /^remove$/i }));
      await user.click(screen.getByRole("button", { name: /remove flyer/i }));

      await waitFor(() => expect(onVersion).toHaveBeenCalledWith("v2"));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/admin/events/e1/flyer");
      expect(init.method).toBe("DELETE");
      expect(JSON.parse(init.body as string)).toEqual({ expectedUpdatedAt: "v1" });
      // The confirm closes with the flyer, so it can't reopen on the next upload still asking.
      await waitFor(() => expect(screen.queryByRole("button", { name: /remove flyer/i })).toBeNull());
    });

    test("while an upload is in flight, the open confirm's Remove flyer sends nothing more", async () => {
      const user = userEvent.setup();
      fetchMock.mockReturnValue(new Promise(() => {})); // the upload never answers
      render(<EventFlyerField eventId="e1" version="v1" onVersion={vi.fn()} initialFlyer={flyer} />);
      await user.click(screen.getByRole("button", { name: /^remove$/i }));
      pick(new File(["x"], "new.jpg", { type: "image/jpeg" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      await user.click(screen.getByRole("button", { name: /remove flyer/i }));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
