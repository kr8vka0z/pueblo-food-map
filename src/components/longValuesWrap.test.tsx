/**
 * Long values wrap (#926 review): a schedule note can run 280 characters and
 * a phone field is free text (several numbers, extensions), so neither may be
 * forced onto one line, or the page scrolls sideways on a 320-360 px phone.
 *
 * jsdom cannot measure layout, so this checks the one thing that forces the
 * overflow: no `whitespace-nowrap` on the value or any box around it.
 */

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import WaitingToPublishBox from "@/components/WaitingToPublishBox";
import ProposalCard from "@/components/ProposalCard";
import ActivityLog from "@/components/ActivityLog";
import { buildActivityDays, parseActivityFilters } from "@/lib/activityLog";
import type { ParsedProposal } from "@/lib/adminProposals";

const LONG_NOTE = (
  "Open the third Saturday of every month from nine until noon in the church hall behind the main building, " +
  "bring a bag or box if you can, and call ahead if you need a delivery because volunteers drive routes on Fridays only."
).padEnd(280, " and more");
const PHONES = "719-555-0100, 719-555-0101 ext 22, 719-555-0102";

function expectWraps(text: string | RegExp) {
  for (const el of screen.getAllByText(text)) expect(el.closest('[class*="whitespace-nowrap"]')).toBeNull();
}

describe("long values wrap instead of overflowing", () => {
  test("Waiting to publish box: a 280-character schedule note and three phone numbers", () => {
    render(
      <WaitingToPublishBox
        changes={[
          {
            field: "hours_irregular",
            label: "Monthly hours",
            onMapNow: "(not set)",
            afterPublish: JSON.stringify([{ recurrence: "other", slots: [], note: LONG_NOTE }]),
            who: "You",
          },
          { field: "phone", label: "Phone", onMapNow: "(not set)", afterPublish: PHONES, who: "You" },
        ]}
      />,
    );
    expectWraps(new RegExp(LONG_NOTE.slice(0, 40)));
    expectWraps(PHONES);
  });

  test("change card: a new place's three phone numbers", () => {
    const proposal = {
      row: {
        id: 10, source: "osm", target_venue_id: "osm-node-new", change_type: "add", proposed_diff: "", diff_hash: "h",
        run_id: "r", anomaly: 0, status: "pending", created_at: "2026-09-01T12:00:00.000Z",
        reviewed_by: null, reviewed_at: null, applied_at: null,
      },
      parseError: false,
      diff: {
        before: null,
        after: { id: "osm-node-new", name: "Northside Pantry", category: "pantry", lat: 38.27, lng: -104.6, address: "900 Elm St", phone: PHONES },
        fields_changed: ["id", "name", "category", "lat", "lng", "address", "phone"],
      },
    } as unknown as ParsedProposal;
    render(<ProposalCard proposal={proposal} />);
    expectWraps(PHONES);
  });

  test("Activity line: a long schedule value and three phone numbers", () => {
    const days = buildActivityDays({
      actions: [
        {
          id: 1, actor_email: "kysboyd@gmail.com", entity: "venue", entity_id: "v1", action: "update",
          before_json: JSON.stringify({ notes: "short", phone: "719-555-0100" }),
          after_json: JSON.stringify({ notes: LONG_NOTE, phone: PHONES }),
          timestamp: "2026-09-27T15:01:00.000Z", session_id: null, venue_id: "v1", venue_name: "Eastside Pantry",
          from_proposal: 0, kind: "edit",
        },
      ],
      events: [],
      sessionHeaders: [],
    });
    render(<ActivityLog days={days} filters={parseActivityFilters({}, new Date("2026-09-27T20:00:00.000Z"))} people={[]} olderHref={null} />);
    expectWraps(new RegExp(LONG_NOTE.slice(0, 40)));
    expectWraps(PHONES);
  });
});
