/**
 * HostAlertsAdminPanel tests (Blessing Boxes slice 6). Mocked-fetch pattern
 * shared with the other admin panels in this app.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HostAlertsAdminPanel from "@/components/HostAlertsAdminPanel";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HostAlertsAdminPanel", () => {
  test("no hosts yet -> shows the empty message", () => {
    render(<HostAlertsAdminPanel venueId="box-1" initialHosts={[]} />);
    expect(screen.getByText("No host emails on file yet.")).toBeInTheDocument();
  });

  test("renders existing hosts with a Remove link each", () => {
    render(
      <HostAlertsAdminPanel
        venueId="box-1"
        initialHosts={[
          { id: 1, email: "a@example.com" },
          { id: 2, email: "b@example.com" },
        ]}
      />,
    );
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
    expect(screen.getByText("b@example.com")).toBeInTheDocument();
    // #926: each Remove is named after its own address (aria-labelledby).
    expect(screen.getByRole("button", { name: "Remove a@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove b@example.com" })).toBeInTheDocument();
  });

  test("adding a host POSTs and replaces the list with the response's refreshed hosts", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: "added", hosts: [{ id: 1, email: "new@example.com" }] }), {
        status: 200,
      }),
    );
    render(<HostAlertsAdminPanel venueId="box-1" initialHosts={[]} />);

    await user.type(screen.getByLabelText("Add a host email"), "new@example.com");
    await user.click(screen.getByRole("button", { name: "Add host" }));

    await waitFor(() => expect(screen.getByText("new@example.com")).toBeInTheDocument());
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/blessing-boxes/box-1/host-alerts");
    expect(init.method).toBe("POST");
    // Single-language alert emails: defaults to "en" when the admin never touches the slider.
    expect(JSON.parse(init.body as string)).toEqual({ email: "new@example.com", lang: "en" });
  });

  test("picking Spanish on the language slider sends lang 'es'", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: "added", hosts: [{ id: 1, email: "new@example.com" }] }), {
        status: 200,
      }),
    );
    render(<HostAlertsAdminPanel venueId="box-1" initialHosts={[]} />);

    await user.type(screen.getByLabelText("Add a host email"), "new@example.com");
    // #926 decision 10: the two-way language choice is a slider of real radios.
    await user.click(screen.getByRole("radio", { name: "Spanish" }));
    await user.click(screen.getByRole("button", { name: "Add host" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string).lang).toBe("es");
  });

  test("a 409 (previously unsubscribed) shows the specific inline message", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: "previously_unsubscribed" }), { status: 409 }));
    render(<HostAlertsAdminPanel venueId="box-1" initialHosts={[]} />);

    await user.type(screen.getByLabelText("Add a host email"), "old@example.com");
    await user.click(screen.getByRole("button", { name: "Add host" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("previously stopped these emails"));
  });

  test("Remove: DELETEs and replaces the list with the response's refreshed hosts", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, hosts: [] }), { status: 200 }));
    render(<HostAlertsAdminPanel venueId="box-1" initialHosts={[{ id: 1, email: "a@example.com" }]} />);

    await user.click(screen.getByRole("button", { name: "Remove a@example.com" }));

    await waitFor(() => expect(screen.queryByText("a@example.com")).not.toBeInTheDocument());
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/blessing-boxes/box-1/host-alerts");
    expect(init.method).toBe("DELETE");
  });
});
