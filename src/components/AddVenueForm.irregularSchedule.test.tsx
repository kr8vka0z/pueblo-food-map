/**
 * AddVenueForm — monthly/irregular schedule fieldset (#400). New, scoped
 * file rather than an addition to AddVenueForm.test.tsx — same "one small
 * file per slice of behavior" convention this repo already uses
 * (AddVenueForm.archivedEdit.test.tsx). Same fetch/router mock setup as
 * that file's own header.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import AddVenueForm from "@/components/AddVenueForm";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockPush.mockReset();
  mockRefresh.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Name/i), "Lynn Gardens Baptist Church");
  await user.selectOptions(screen.getByLabelText(/^Category/i), "pantry");
  await user.type(screen.getByLabelText(/^Address/i), "3804 W. Pueblo Blvd, Pueblo, CO");
  fireEvent.change(screen.getByLabelText(/^Latitude/i), { target: { value: "38.223992" } });
  fireEvent.change(screen.getByLabelText(/^Longitude/i), { target: { value: "-104.656767" } });
}

describe("AddVenueForm — monthly schedule fieldset", () => {
  test("starts with zero rows and an 'Add monthly schedule' button", () => {
    render(<AddVenueForm />);
    expect(screen.getByRole("button", { name: /Add monthly schedule/i })).toBeDefined();
    expect(screen.queryByLabelText(/Schedule 1 ordinal/i)).toBeNull();
  });

  test("'Add monthly schedule' reveals a recurrence-kind picker; picking 'specific weekday' reveals ordinal + weekday selects", async () => {
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await user.click(screen.getByRole("button", { name: /Add monthly schedule/i }));

    const kindSelect = screen.getByLabelText(/^Schedule 1$/i);
    await user.selectOptions(kindSelect, "monthly_ordinal");

    expect(screen.getByLabelText(/Schedule 1 ordinal/i)).toBeDefined();
    expect(screen.getByLabelText(/Schedule 1 weekday/i)).toBeDefined();
    expect(screen.queryByLabelText(/Schedule 1 day of month/i)).toBeNull();
  });

  test("picking 'fixed day of the month' reveals a day-of-month input instead", async () => {
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await user.click(screen.getByRole("button", { name: /Add monthly schedule/i }));
    await user.selectOptions(screen.getByLabelText(/^Schedule 1$/i), "monthly_date");

    expect(screen.getByLabelText(/Schedule 1 day of month/i)).toBeDefined();
    expect(screen.queryByLabelText(/Schedule 1 ordinal/i)).toBeNull();
  });

  test("'Remove' deletes that row only", async () => {
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await user.click(screen.getByRole("button", { name: /Add monthly schedule/i }));
    await user.click(screen.getByRole("button", { name: /Add monthly schedule/i }));
    expect(screen.getAllByText(/^Remove$/i)).toHaveLength(2);

    await user.click(screen.getAllByText(/^Remove$/i)[0]);
    expect(screen.getAllByText(/^Remove$/i)).toHaveLength(1);
  });

  test("a filled monthly_ordinal row submits in the hours_irregular payload", async () => {
    mockFetch.mockResolvedValueOnce({ status: 201, json: async () => ({ id: "manual-abc" }) });
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Add monthly schedule/i }));
    await user.selectOptions(screen.getByLabelText(/^Schedule 1$/i), "monthly_ordinal");
    await user.selectOptions(screen.getByLabelText(/Schedule 1 ordinal/i), "4");
    await user.selectOptions(screen.getByLabelText(/Schedule 1 weekday/i), "tue");
    fireEvent.change(screen.getByLabelText(/Schedule 1 time ranges/i), { target: { value: "11:00 AM - 12:00 PM" } });

    await user.click(screen.getByRole("button", { name: /Add venue/i }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.hours_irregular).toEqual([
      { recurrence: "monthly_ordinal", ordinal: 4, weekday: "tue", slots: ["11:00 AM - 12:00 PM"] },
    ]);
  });

  test("an incomplete row (kind picked, fields left blank) is silently omitted from the payload", async () => {
    mockFetch.mockResolvedValueOnce({ status: 201, json: async () => ({ id: "manual-abc" }) });
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Add monthly schedule/i }));
    await user.selectOptions(screen.getByLabelText(/^Schedule 1$/i), "monthly_ordinal");
    // ordinal/weekday/slots left blank

    await user.click(screen.getByRole("button", { name: /Add venue/i }));

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.hours_irregular).toBeUndefined();
  });

  test("an 'other' row requires only a note", async () => {
    mockFetch.mockResolvedValueOnce({ status: 201, json: async () => ({ id: "manual-abc" }) });
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Add monthly schedule/i }));
    await user.selectOptions(screen.getByLabelText(/^Schedule 1$/i), "other");
    await user.type(screen.getByLabelText(/Schedule 1 note/i), "3rd weekend, call ahead");

    await user.click(screen.getByRole("button", { name: /Add venue/i }));

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.hours_irregular).toEqual([{ recurrence: "other", slots: [], note: "3rd weekend, call ahead" }]);
  });

  test("initialValues pre-fills existing monthly schedule rows (edit mode)", () => {
    render(
      <AddVenueForm
        venueId="manual-abc"
        initialValues={{
          hoursIrregular: [
            { recurrence: "monthly_ordinal", ordinal: "4", weekday: "tue", dayOfMonth: "", slots: "11:00-12:00", note: "" },
          ],
        }}
      />,
    );
    expect(screen.getByLabelText(/^Schedule 1$/i)).toHaveValue("monthly_ordinal");
    expect(screen.getByLabelText(/Schedule 1 ordinal/i)).toHaveValue("4");
    expect(screen.getByLabelText(/Schedule 1 weekday/i)).toHaveValue("tue");
  });

  test("a server 422 renders the returned hours_irregular error inline", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 422,
      json: async () => ({ errors: { hours_irregular: "Irregular schedule entry 1 needs a valid weekday." } }),
    });
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /Add venue/i }));

    expect(await screen.findByText(/needs a valid weekday/i)).toBeDefined();
  });
});
