/**
 * EventForm "Suggest Spanish" (#757): the behaviors that guard the admin's
 * own work — Spanish already typed is never overwritten (including text typed
 * while the request was in flight), only the English that has an empty Spanish
 * twin is sent, nothing is requested when there is no English, and a failed
 * request leaves every box untouched. No wording or styling assertions beyond
 * locating the control.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));

import EventForm from "@/components/EventForm";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
const suggestButton = () => screen.getByRole("button", { name: /suggest spanish|suggesting/i });
const ok = (suggestions: Record<string, string>) => ({ status: 200, json: async () => ({ ok: true, suggestions }) });

describe("Suggest Spanish", () => {
  test("fills only empty Spanish boxes and sends only English that has an empty twin", async () => {
    render(
      <EventForm
        venues={[]}
        initialValues={{ name: "Turkey drive", nameEs: "Mi nombre", host: "Pueblo Food Project", description: "Free turkeys" }}
      />,
    );
    fetchMock.mockResolvedValue(
      ok({ name_es: "NO DEBE USARSE", host_es: "Proyecto Alimentario de Pueblo", description_es: "Pavos gratis" }),
    );

    await userEvent.click(suggestButton());

    await waitFor(() => expect(field(/^Host \(Spanish\)/).value).toBe("Proyecto Alimentario de Pueblo"));
    expect(field(/^Name \(Spanish\)/).value).toBe("Mi nombre");
    expect(field(/^Description \(Spanish\)/).value).toBe("Pavos gratis");

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe("/api/admin/events/translate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ host: "Pueblo Food Project", description: "Free turkeys" });
  });

  test("Spanish typed while the request is in flight is kept", async () => {
    render(<EventForm venues={[]} initialValues={{ name: "Turkey drive" }} />);
    let release!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => (release = r)));

    await userEvent.click(suggestButton());
    expect(suggestButton()).toBeDisabled();
    fireEvent.change(field(/^Name \(Spanish\)/), { target: { value: "Escrito a mano" } });
    release(ok({ name_es: "Colecta de pavos" }));

    await waitFor(() => expect(suggestButton()).not.toBeDisabled());
    expect(field(/^Name \(Spanish\)/).value).toBe("Escrito a mano");
  });

  test("English edited while the request is in flight: that field's Spanish is not filled, the others are", async () => {
    render(<EventForm venues={[]} initialValues={{ name: "Turkey drive", host: "Pueblo Food Project" }} />);
    let release!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => (release = r)));

    await userEvent.click(suggestButton());
    fireEvent.change(field(/^Name \(English\)/), { target: { value: "Pie drive" } });
    release(ok({ name_es: "Colecta de pavos", host_es: "Proyecto Alimentario de Pueblo" }));

    await waitFor(() => expect(field(/^Host \(Spanish\)/).value).toBe("Proyecto Alimentario de Pueblo"));
    expect(field(/^Name \(Spanish\)/).value).toBe("");
  });

  test("no English text -> no request", async () => {
    render(<EventForm venues={[]} />);
    await userEvent.click(suggestButton());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("every Spanish box already filled -> no request", async () => {
    render(<EventForm venues={[]} initialValues={{ name: "Drive", nameEs: "Colecta" }} />);
    await userEvent.click(suggestButton());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each([
    ["a 502", () => fetchMock.mockResolvedValue({ status: 502, json: async () => ({ ok: false }) })],
    ["a network error", () => fetchMock.mockRejectedValue(new Error("offline"))],
  ])("%s leaves every box as it was and re-enables the button", async (_name, arrange) => {
    render(<EventForm venues={[]} initialValues={{ name: "Drive" }} />);
    arrange();

    await userEvent.click(suggestButton());

    await waitFor(() => expect(suggestButton()).not.toBeDisabled());
    expect(field(/^Name \(Spanish\)/).value).toBe("");
  });
});
