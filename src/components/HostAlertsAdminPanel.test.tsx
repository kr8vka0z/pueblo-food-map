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

  // #926: Add host keeps keyboard focus while it adds (a natively disabled
  // button would drop it to the top of the page), a second press sends
  // nothing, and after the add focus is back in the empty box for the next host.
  test("Add host keeps focus while adding, ignores a second press, then puts focus back in the box", async () => {
    let resolve: (v: Response) => void = () => {};
    mockFetch.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<HostAlertsAdminPanel venueId="box-1" initialHosts={[]} />);

    const box = screen.getByLabelText("Add a host email");
    await user.type(box, "new@example.com");
    const add = screen.getByRole("button", { name: "Add host" });
    add.focus();
    await user.keyboard("{Enter}");
    expect(add).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    resolve(new Response(JSON.stringify({ ok: true, result: "added", hosts: [{ id: 1, email: "new@example.com" }] }), { status: 200 }));
    await waitFor(() => expect(screen.getByText("new@example.com")).toBeInTheDocument());
    expect(box).toHaveValue("");
    expect(box).toHaveFocus();
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

  // #926: no browser bubble; the box itself says what is wrong and takes focus, and nothing is sent.
  test.each([
    ["empty", ""],
    ["not an email", "not-an-email"],
  ])("Add host with an %s box sends nothing, marks the box and puts focus in it", async (_label, typed) => {
    const user = userEvent.setup();
    render(<HostAlertsAdminPanel venueId="box-1" initialHosts={[]} />);
    const box = screen.getByLabelText("Add a host email");
    if (typed) await user.type(box, typed);

    await user.click(screen.getByRole("button", { name: "Add host" }));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription(/email address/);
    expect(box).toHaveFocus();
  });

  // #926: focus never falls to the top of the page after a Remove.
  test.each([
    ["the next host's Remove", 0, "Remove b@example.com"],
    ["the add box when no host follows", 1, null],
  ])("after a Remove, focus goes to %s", async (_label, index, nextName) => {
    const hosts = [
      { id: 1, email: "a@example.com" },
      { id: 2, email: "b@example.com" },
    ];
    const user = userEvent.setup();
    const left = hosts.filter((_, i) => i !== index);
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, hosts: left }), { status: 200 }));
    render(<HostAlertsAdminPanel venueId="box-1" initialHosts={hosts} />);

    await user.click(screen.getByRole("button", { name: `Remove ${hosts[index].email}` }));

    await waitFor(() => expect(screen.queryByText(hosts[index].email)).not.toBeInTheDocument());
    await waitFor(() =>
      expect(nextName ? screen.getByRole("button", { name: nextName }) : screen.getByLabelText("Add a host email")).toHaveFocus(),
    );
  });
});
