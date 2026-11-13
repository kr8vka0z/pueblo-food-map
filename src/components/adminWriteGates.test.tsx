/**
 * adminWriteGates.test.tsx — while one admin write runs, no second one can
 * start, by any path (#926). Working buttons are aria-disabled now, not
 * disabled (so focus stays), which makes each handler the real gate: these
 * tests press Enter, press the same or a sibling button, and fire the form's
 * submit directly (what no button can stop), all with the first request
 * still hanging, and count the requests.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseProposalRow } from "@/lib/adminProposals";
import { parseSubmissionRow } from "@/lib/publicSubmissions";

const router = { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import AddVenueForm from "@/components/AddVenueForm";
import EventForm from "@/components/EventForm";
import HostAlertsAdminPanel from "@/components/HostAlertsAdminPanel";
import ProposalCard from "@/components/ProposalCard";
import SubmissionCard from "@/components/SubmissionCard";
import ArchiveVenueButton from "@/components/ArchiveVenueButton";
import BoxCheckinsAdminPanel from "@/components/BoxCheckinsAdminPanel";

// The first request never answers, so the form stays mid-write for the test.
const fetchMock = vi.fn(() => new Promise<Response>(() => {}));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const formOf = (el: HTMLElement) => el.closest("form") as HTMLFormElement;

describe("a form mid-save refuses a second write", () => {
  test("Add venue: Enter twice and a direct submit create one place", async () => {
    const user = userEvent.setup();
    render(<AddVenueForm />);
    const name = screen.getByLabelText(/^Name/i);
    await user.type(name, "Eastside Pantry");
    await user.selectOptions(screen.getByLabelText(/^Category/i), "pantry");
    await user.type(screen.getByLabelText(/^Address/i), "123 Test St, Pueblo, CO");
    fireEvent.change(screen.getByLabelText(/^Latitude/i), { target: { value: "38.25" } });
    fireEvent.change(screen.getByLabelText(/^Longitude/i), { target: { value: "-104.6" } });

    await user.type(name, "{Enter}");
    await user.type(name, "{Enter}");
    fireEvent.submit(formOf(name));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("event form: Enter, the Publish button beside Save draft, and a direct submit send one save", async () => {
    const user = userEvent.setup();
    render(
      <EventForm
        venues={[]}
        eventId="e1"
        status="draft"
        expectedUpdatedAt="2026-10-01T00:00:00.000Z"
        initialValues={{ name: "Turkey drive", startsLocal: "2026-11-21T10:00", endsLocal: "2026-11-21T14:00", address: "1 Main", lat: "38.2", lng: "-104.6" }}
      />,
    );
    const name = screen.getByLabelText(/^Name \(English\)/);

    await user.type(name, "{Enter}");
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await user.type(name, "{Enter}");
    fireEvent.submit(formOf(name));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("Add host: Enter twice and a direct submit add the host once", async () => {
    const user = userEvent.setup();
    render(<HostAlertsAdminPanel venueId="box-1" initialHosts={[]} />);
    const box = screen.getByLabelText("Add a host email");

    await user.type(box, "host@example.com{Enter}");
    await user.type(box, "{Enter}");
    fireEvent.submit(formOf(box));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("a card mid-decision refuses a second one", () => {
  const proposal = parseProposalRow({
    id: 1,
    source: "osm",
    target_venue_id: "osm-node-1",
    change_type: "update",
    proposed_diff: JSON.stringify({
      before: { phone: "719-555-0100" },
      after: { phone: "719-555-0199" },
      fields_changed: ["phone"],
    }),
    diff_hash: "h1",
    run_id: "run-1",
    anomaly: 0,
    status: "pending",
    created_at: "2026-09-01T12:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    applied_at: null,
  });

  test("a change card's Approve pressed twice sends one approve", async () => {
    const user = userEvent.setup();
    render(<ProposalCard proposal={proposal} />);
    const approve = screen.getByRole("button", { name: "Approve" });
    await user.click(approve);
    await user.click(screen.getByRole("button", { name: "Applying…" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // The two decisions on one card keep separate busy flags, so neither
  // button looks busy while the other runs: only the handler can refuse.
  test("a change card: Confirm reject while Approve runs sends nothing more", async () => {
    const user = userEvent.setup();
    render(<ProposalCard proposal={proposal} />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(screen.getByRole("button", { name: "Confirm reject" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a closure report: Confirm reject while Mark done runs sends nothing more", async () => {
    const user = userEvent.setup();
    const submission = parseSubmissionRow({
      id: 9,
      kind: "closure",
      payload: JSON.stringify({ venueId: "v1", venueName: "Main Street Grocery", venueAddress: "456 Main Ave", issueType: "closed", description: "Shut." }),
      submitter_email: null,
      target_venue_id: "v1",
      status: "pending",
      created_at: "2026-07-02T09:00:00.000Z",
      reviewed_by: null,
      reviewed_at: null,
      review_reason: null,
    });
    render(<SubmissionCard submission={submission} />);
    await user.click(screen.getByRole("button", { name: "Mark done" }));
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Confirm reject" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("the confirm's action pressed twice removes the place once", async () => {
    const user = userEvent.setup();
    render(<ArchiveVenueButton venueId="v1" venueName="Eastside Pantry" alreadyArchived={false} />);
    await user.click(screen.getByRole("button", { name: "Remove from map" }));
    const action = screen.getByRole("button", { name: "Remove from map" });
    await user.click(action);
    await user.click(action);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a check-in's Hide while another row's Hide runs sends nothing more", async () => {
    const user = userEvent.setup();
    const row = (id: number) => ({
      id,
      venue_id: "box-1",
      kind: "filled" as const,
      note: null,
      visibility: "visible" as const,
      hidden_by: null,
      hidden_at: null,
      created_at: "2026-09-01T12:00:00.000Z",
    });
    render(<BoxCheckinsAdminPanel checkins={[row(1), row(2)]} />);
    const [first, second] = screen.getAllByRole("button", { name: /^Hide/ });
    await user.click(first);
    await user.click(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
