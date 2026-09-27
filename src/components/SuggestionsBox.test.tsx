/**
 * Tests for SuggestionsBox (#674) — the venue edit page's "Suggestions to
 * review" box. ProposalCard's own behavior (approve/reject/detail
 * rendering) is covered in ProposalCard.test.tsx; this file only proves the
 * box's own contract: nothing renders when there's nothing pending, one
 * card per pending proposal, and every card gets the SAME venue context.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ParsedProposal } from "@/lib/adminProposals";
import type { VenueLookup } from "@/lib/adminVenueLookup";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import SuggestionsBox from "@/components/SuggestionsBox";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeVenue(overrides: Partial<VenueLookup> = {}): VenueLookup {
  return {
    name: "Eastside Grocery",
    category: "grocery",
    lat: 38.27,
    lng: -104.6,
    address: "123 Main St, Pueblo, CO",
    phone: null,
    url: null,
    hours_weekly: null,
    source: "OpenStreetMap",
    last_verified: "2026-09-01",
    status: "published",
    ...overrides,
  };
}

function makeProposal(id: number): ParsedProposal {
  return {
    row: {
      id,
      source: "osm",
      target_venue_id: "osm-node-1",
      change_type: "update",
      proposed_diff: "",
      diff_hash: `h${id}`,
      run_id: "run-1",
      anomaly: 0,
      status: "pending",
      created_at: "2026-09-01T12:00:00.000Z",
      reviewed_by: null,
      reviewed_at: null,
      applied_at: null,
    },
    parseError: false,
    diff: { before: { phone: "1" }, after: { phone: "2" }, fields_changed: ["phone"] },
  } as ParsedProposal;
}

describe("SuggestionsBox", () => {
  test("renders nothing at all when there are no pending proposals", () => {
    const { container } = render(<SuggestionsBox proposals={[]} venue={makeVenue()} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders one card per pending proposal, with a count heading", () => {
    render(<SuggestionsBox proposals={[makeProposal(1), makeProposal(2)]} venue={makeVenue()} />);
    expect(screen.getByText("Suggestions to review (2)")).toBeDefined();
    expect(screen.getAllByTestId("proposal-detail")).toHaveLength(2);
  });

  test("every card receives the same venue context (name shown in each detail column)", () => {
    render(<SuggestionsBox proposals={[makeProposal(1), makeProposal(2)]} venue={makeVenue({ name: "Westside Pantry" })} />);
    for (const detail of screen.getAllByTestId("proposal-detail")) {
      expect(within(detail).getByText("Westside Pantry")).toBeDefined();
    }
  });
});
