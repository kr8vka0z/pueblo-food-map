/**
 * ShareEventForm — Send while the address lookup is still running (#894 item 4).
 *
 * On a phone, tapping Send blurs the address field, which starts the lookup;
 * a "several matches" answer that lands during that send must stop it and
 * show the choices. Only a second Send, with the choices already showing,
 * goes through unpicked.
 */

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import ShareEventForm from "@/components/ShareEventForm";

const json = (body: unknown) => ({ ok: true, json: async () => body });
let resolveGeocode!: (v: unknown) => void;
let calls: string[];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      calls.push(url);
      if (url.startsWith("/events/share/geocode")) return new Promise((r) => (resolveGeocode = r));
      if (url === "/events/share/submit") return Promise.resolve(json({ ok: true }));
      return Promise.resolve(json({ ok: false }));
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

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const change = (label: RegExp, value: string) => fireEvent.change(field(label), { target: { value } });
const sendButton = () => screen.getByRole("button", { name: t("shareEvent.submit", "en") });
const submits = () => calls.filter((u) => u === "/events/share/submit");

test("a 'several matches' answer arriving after Send stops the send and shows the choices; Send again goes through", async () => {
  render(
    <LocaleProvider initialLocale="en">
      <ShareEventForm />
    </LocaleProvider>,
  );
  change(/^Event name/, "Turkey Giveaway");
  change(/Who's hosting it/, "Pueblo Food Project");
  change(/^Date/, "2099-11-22");
  change(/^Starts/, "10:00");
  change(/^Ends/, "13:00");
  change(/What is it/, "Free turkeys.");
  change(/Your name/, "Pat");
  change(/Your email/, "pat@example.com");
  change(/Street address/, "1 Main St");
  await waitFor(() => expect(sendButton()).toBeEnabled());

  // The tap on Send blurs the address first, starting the lookup.
  fireEvent.blur(field(/Street address/));
  fireEvent.click(sendButton());
  await act(async () =>
    resolveGeocode(
      json({
        ok: true,
        matches: [
          { lat: 38.2, lng: -104.6, matchedAddress: "1 Main St, Pueblo, CO" },
          { lat: 38.3, lng: -104.5, matchedAddress: "1 Main St, Pueblo West, CO" },
        ],
      }),
    ),
  );

  expect(await screen.findByRole("button", { name: "1 Main St, Pueblo West, CO" })).toBeInTheDocument();
  expect(submits()).toHaveLength(0);

  fireEvent.click(sendButton());
  await waitFor(() => expect(submits()).toHaveLength(1));
});
