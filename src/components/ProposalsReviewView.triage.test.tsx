// ProposalsReviewView.triage.test.tsx — the #543 triage lanes at /admin/flags: badge, filter, sort, rename card.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChangeProposalRow, ParsedProposal, ProposedDiff } from "@/lib/adminProposals";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import ProposalsReviewView, { triageSummary } from "@/components/ProposalsReviewView";

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => vi.unstubAllGlobals());

function proposal(id: number, row: Partial<ChangeProposalRow>, diff: ProposedDiff, created_at: string): ParsedProposal {
  return {
    row: {
      id,
      source: "osm",
      target_venue_id: `venue-${id}`,
      change_type: "update",
      proposed_diff: "",
      diff_hash: `h${id}`,
      run_id: "run-1",
      anomaly: 0,
      status: "pending",
      created_at,
      reviewed_by: null,
      reviewed_at: null,
      applied_at: null,
      ...row,
    },
    parseError: false,
    diff,
  };
}

const phoneDiff: ProposedDiff = {
  before: { name: "Noise Market", phone: "719-555-0100", last_verified: "2026-08-01" },
  after: { name: "Noise Market", phone: "(719) 555-0100", last_verified: "2026-09-28" },
  fields_changed: ["phone", "last_verified"],
};
const realDiff: ProposedDiff = {
  before: { name: "Real Change Cafe", phone: "719-555-0100", last_verified: "2026-08-01" },
  after: { name: "Real Change Cafe", phone: "719-555-0199", last_verified: "2026-09-28" },
  fields_changed: ["phone", "last_verified"],
};
const renameDiff: ProposedDiff = {
  before: { name: "Old Name Pantry", last_verified: "2026-08-01" },
  after: { name: "New Name Pantry", last_verified: "2026-09-28" },
  fields_changed: ["name", "last_verified"],
  meta: { rename: { from_id: "plentiful-old-name", to_id: "plentiful-new-name", matched_by: "coordinates", distance_m: 12 } },
};

// Newest first, as the page's SELECT orders them: noise, then real, then rename.
const queue = [
  proposal(
    1,
    { triage_lane: "likely_noise", triage_json: JSON.stringify({ answers: { same_value: { noul: 0.96 } } }) },
    phoneDiff,
    "2026-09-28T06:03:00.000Z",
  ),
  proposal(2, { triage_lane: "needs_human", triage_json: JSON.stringify({ answers: { same_value: { noul: 0.04 } } }) }, realDiff, "2026-09-28T06:02:00.000Z"),
  proposal(3, { source: "plentiful", target_venue_id: "plentiful-old-name" }, renameDiff, "2026-09-28T06:01:00.000Z"),
];

const cardNames = () => screen.getAllByTestId("proposal-detail").map((el) => el.querySelector("p")?.textContent);

describe("ProposalsReviewView triage lanes", () => {
  test("each card shows its lane badge and Jev's reading", () => {
    render(<ProposalsReviewView proposals={queue} venueLookup={{}} />);
    const [noise, real] = screen.getAllByRole("listitem");
    expect(within(noise).getByText("Likely noise")).toBeTruthy();
    expect(within(noise).getByText(/96% likely the same value/)).toBeTruthy();
    expect(within(real).getByText("Needs a human")).toBeTruthy();
  });

  test("filter by lane", async () => {
    render(<ProposalsReviewView proposals={queue} venueLookup={{}} />);
    await userEvent.click(screen.getByRole("button", { name: "Likely rename" }));
    expect(cardNames()).toEqual(["New Name Pantry"]);
    await userEvent.click(screen.getByRole("button", { name: "Likely noise" }));
    expect(cardNames()).toEqual(["Noise Market"]);
  });

  test("'Needs a human first' sorts by lane: human, rename, noise", async () => {
    render(<ProposalsReviewView proposals={queue} venueLookup={{}} />);
    expect(cardNames()).toEqual(["Noise Market", "Real Change Cafe", "New Name Pantry"]);
    await userEvent.click(screen.getByRole("button", { name: "Needs a human first" }));
    expect(cardNames()).toEqual(["Real Change Cafe", "New Name Pantry", "Noise Market"]);
  });

  test("a rename card names the new listing and says Approve rename", () => {
    render(<ProposalsReviewView proposals={queue} venueLookup={{}} />);
    const card = screen.getAllByRole("listitem")[2];
    expect(within(card).getByText("Rename / move")).toBeTruthy();
    expect(within(card).getByText("plentiful-new-name")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Approve rename" })).toBeTruthy();
  });

  test("an all-untriaged queue shows no lane controls (looks as it did before triage)", () => {
    render(<ProposalsReviewView proposals={[proposal(9, {}, realDiff, "2026-09-28T06:00:00.000Z")]} venueLookup={{}} />);
    expect(screen.queryByRole("button", { name: "Needs a human first" })).toBeNull();
  });
});

describe("triageSummary", () => {
  test("remove verdict reads in plain words", () => {
    const json = JSON.stringify({ answers: { remove_reason: { choice: "temporarily_missing", probabilities: { temporarily_missing: 0.71 } } } });
    expect(triageSummary({ triage_json: json })).toBe("Jev's best guess: a scrape gap, still open (71%).");
  });
  test("null or malformed json → no line", () => {
    expect(triageSummary({ triage_json: null })).toBeNull();
    expect(triageSummary({ triage_json: "{" })).toBeNull();
  });
});
