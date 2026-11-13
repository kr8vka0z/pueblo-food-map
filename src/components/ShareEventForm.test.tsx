/**
 * ShareEventForm (#883) — the risky client behavior the PR review found:
 * unsent personal text kept out of analytics capture, the thank-you screen
 * surviving a successful send, no send while a flyer is still uploading, and
 * a stale address lookup never overwriting a newer address.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { NO_CAPTURE_CLASS } from "@/lib/analytics";
import { t } from "@/lib/i18n";

vi.mock("@/lib/imageResize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/imageResize")>()),
  shrinkFlyerToJpeg: async () => new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" }),
}));

import ShareEventForm from "@/components/ShareEventForm";

const SEND = t("shareEvent.submit", "en");

/** A promise plus its resolve, so a test decides when a fetch answers. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const json = (body: unknown) => ({ ok: true, json: async () => body });

let routes: Record<string, (url: string, init?: RequestInit) => Promise<unknown>>;
let calls: { url: string; init?: RequestInit }[];

beforeEach(() => {
  calls = [];
  routes = {};
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const key = Object.keys(routes).find((k) => url.startsWith(k));
      return key ? routes[key](url, init) : Promise.resolve(json({ ok: false }));
    }),
  );
  vi.stubGlobal("turnstile", {
    render: vi.fn((_c: HTMLElement, opts: { callback?: (tok: string) => void }) => {
      opts.callback?.("test-turnstile-token");
      return "widget-id";
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  });
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function renderForm() {
  return render(
    <LocaleProvider initialLocale="en">
      <ShareEventForm />
    </LocaleProvider>,
  );
}

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const change = (label: RegExp, value: string) => fireEvent.change(field(label), { target: { value } });

function fillRequired() {
  change(/^Event name/, "Turkey Giveaway");
  change(/Who's hosting it/, "Pueblo Food Project");
  change(/^Date/, "2099-11-22");
  change(/^Starts/, "10:00");
  change(/^Ends/, "13:00");
  change(/What is it/, "Free turkeys.");
  change(/Street address/, "1 Main St");
  change(/Your name/, "Pat");
  change(/Your email/, "pat@example.com");
}

const sendButton = () => screen.getByRole("button", { name: SEND });
const submitCalls = () => calls.filter((c) => c.url === "/events/share/submit");

describe("ShareEventForm", () => {
  test("the preview card, the address-check results and the phone sheet are excluded from analytics capture", async () => {
    routes["/events/share/geocode"] = async () =>
      json({ ok: true, matches: [{ lat: 38.2, lng: -104.6, matchedAddress: "1 Main St, Pueblo, CO" }, { lat: 38.3, lng: -104.5, matchedAddress: "1 Main St, Pueblo West, CO" }] });
    renderForm();
    change(/^Event name/, "Turkey Giveaway");
    expect(screen.getAllByText("Turkey Giveaway")[0].closest(`.${NO_CAPTURE_CLASS}`)).not.toBeNull();

    change(/Street address/, "1 Main St");
    fireEvent.blur(field(/Street address/));
    const choice = await screen.findByRole("button", { name: "1 Main St, Pueblo West, CO" });
    expect(choice.closest(`.${NO_CAPTURE_CLASS}`)).toBe(screen.getByTestId("share-address-check"));

    fireEvent.click(screen.getByRole("button", { name: t("shareEvent.preview.open", "en") }));
    const sheet = await screen.findByTestId("share-preview-sheet");
    expect(sheet).toHaveClass(NO_CAPTURE_CLASS);
  });

  test("a successful send shows the thank-you screen, and the filled form is gone", async () => {
    routes["/events/share/geocode"] = async () => json({ ok: true, matches: [{ lat: 38.2, lng: -104.6, matchedAddress: "1 Main St, Pueblo, CO" }] });
    routes["/events/share/submit"] = async () => json({ ok: true });
    renderForm();
    fillRequired();
    await waitFor(() => expect(sendButton()).toBeEnabled());
    fireEvent.click(sendButton());

    expect(await screen.findByText(t("shareEvent.success.title", "en"))).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Event name/)).toBeNull();
    expect(submitCalls()).toHaveLength(1);
  });

  test("while a flyer is uploading Send is blocked; once it lands the send carries its key", async () => {
    routes["/events/share/geocode"] = async () => json({ ok: true, matches: [{ lat: 38.2, lng: -104.6, matchedAddress: "1 Main St, Pueblo, CO" }] });
    routes["/events/share/submit"] = async () => json({ ok: true });
    const upload = deferred<unknown>();
    routes["/events/share/flyer"] = () => upload.promise;
    renderForm();
    fillRequired();
    await waitFor(() => expect(sendButton()).toBeEnabled());

    fireEvent.change(screen.getByLabelText(/^Flyer/), { target: { files: [new File(["x"], "flyer.png", { type: "image/png" })] } });
    await waitFor(() => expect(sendButton()).toBeDisabled());
    // Even a submit that bypasses the button (Enter in a field) sends nothing.
    await act(async () => {
      fireEvent.submit(sendButton().closest("form")!);
    });
    expect(submitCalls()).toHaveLength(0);

    await act(async () => upload.resolve(json({ ok: true, key: "pending.submissions/k.jpg", width: 40, height: 60 })));
    await waitFor(() => expect(sendButton()).toBeEnabled());
    fireEvent.click(sendButton());
    await waitFor(() => expect(submitCalls()).toHaveLength(1));
    expect(JSON.parse(submitCalls()[0].init!.body as string)).toMatchObject({ flyer_key: "pending.submissions/k.jpg" });
  });

  test("an older address lookup answering last never overwrites the newer address", async () => {
    const answers: Record<string, ReturnType<typeof deferred<unknown>>> = { old: deferred(), new: deferred() };
    routes["/events/share/geocode"] = (url) => answers[url.includes("Old") ? "old" : "new"].promise;
    renderForm();

    change(/Street address/, "1 Old St");
    fireEvent.blur(field(/Street address/));
    change(/Street address/, "2 New St");
    fireEvent.blur(field(/Street address/));

    await act(async () => answers.new.resolve(json({ ok: true, matches: [{ lat: 38.2, lng: -104.6, matchedAddress: "2 New St, Pueblo, CO" }] })));
    await act(async () => answers.old.resolve(json({ ok: true, matches: [{ lat: 38.3, lng: -104.5, matchedAddress: "1 Old St, Pueblo, CO" }] })));

    expect(field(/Street address/).value).toBe("2 New St, Pueblo, CO");
    expect(screen.getByTestId("share-address-check")).toHaveTextContent("2 New St, Pueblo, CO");
    expect(screen.getByTestId("share-address-check")).not.toHaveTextContent("1 Old St");
  });

  test("an edit after a lookup started throws that lookup's answer away", async () => {
    const answer = deferred<unknown>();
    routes["/events/share/geocode"] = () => answer.promise;
    renderForm();
    change(/Street address/, "1 Old St");
    fireEvent.blur(field(/Street address/));
    change(/Street address/, "1 Old St, Apt 2");
    await act(async () => answer.resolve(json({ ok: true, matches: [{ lat: 38.3, lng: -104.5, matchedAddress: "1 Old St, Pueblo, CO" }] })));
    expect(field(/Street address/).value).toBe("1 Old St, Apt 2");
    expect(screen.getByTestId("share-address-check")).toBeEmptyDOMElement();
  });
});
