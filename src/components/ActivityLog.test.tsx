/**
 * ActivityLog (#679) — presentation only: failed sign-ins in red, long runs
 * collapsed behind "Edited N · show all", and a place link per action. The
 * grouping itself is tested in src/lib/activityLog.sql.test.ts.
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import ActivityLog from "@/components/ActivityLog";
import { buildActivityDays, parseActivityFilters, type AuditActionRow, type AuthEventRow } from "@/lib/activityLog";

const filters = parseActivityFilters({}, new Date("2026-09-27T20:00:00.000Z"));

function action(id: number, minute: number): AuditActionRow {
  return {
    id,
    actor_email: "kysboyd@gmail.com",
    entity: "venue",
    entity_id: "v1",
    action: "update",
    before_json: '{"hours":"9-5"}',
    after_json: '{"hours":"9-6"}',
    timestamp: `2026-09-27T15:${String(minute).padStart(2, "0")}:00.000Z`,
    session_id: "s1",
    venue_id: "v1",
    venue_name: "Eastside Pantry",
    from_proposal: 0,
    kind: "edit",
  };
}

const signIn: AuthEventRow = {
  id: 1,
  event: "sign_in",
  email: "kysboyd@gmail.com",
  user_id: "u",
  session_id: "s1",
  method: "email_link",
  ip: "203.0.113.9",
  user_agent: null,
  city: null,
  region: null,
  country: null,
  detail_json: null,
  created_at: "2026-09-27T15:00:00.000Z",
};

const failed: AuthEventRow = {
  ...signIn,
  id: 2,
  event: "sign_in_failed",
  email: "attacker@evil.com",
  session_id: null,
  detail_json: '{"reason":"not_allowlisted"}',
  created_at: "2026-09-27T16:00:00.000Z",
};

describe("ActivityLog", () => {
  test("collapses a run of edits and links each place", () => {
    const days = buildActivityDays({ actions: [action(1, 1), action(2, 2), action(3, 3), action(4, 4)], events: [signIn], sessionHeaders: [] });
    render(<ActivityLog days={days} filters={filters} people={[]} olderHref={null} />);

    expect(screen.getByText("Edited 4 · show all")).toBeDefined();
    expect(screen.getByText(/signed in with sign-in link/)).toBeDefined();
    const links = screen.getAllByRole("link", { name: "Eastside Pantry" });
    expect(links).toHaveLength(4);
    expect(links[0].getAttribute("href")).toBe("/admin/venues/v1/edit");
  });

  test("shows a failed sign-in with its reason", () => {
    const days = buildActivityDays({ actions: [], events: [failed], sessionHeaders: [] });
    render(<ActivityLog days={days} filters={filters} people={[]} olderHref="/admin/activity?until=x" />);

    expect(screen.getByText(/Failed sign-in — attacker@evil\.com/)).toBeDefined();
    expect(screen.getByText(/isn't an admin/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Show older" }).getAttribute("href")).toBe("/admin/activity?until=x");
  });

  test("an empty page says so", () => {
    render(<ActivityLog days={[]} filters={filters} people={[]} olderHref={null} />);
    expect(screen.getByText("No activity matches these filters.")).toBeDefined();
  });

  test("labels both automatic refresh actors readably", () => {
    const auto = (id: number, actor: string) => ({ ...action(id, 1), actor_email: actor, session_id: null });
    const days = buildActivityDays({ actions: [auto(1, "refresh-pipeline"), auto(2, "refresh-pipeline-ai")], events: [], sessionHeaders: [] });
    render(<ActivityLog days={days} filters={filters} people={[]} olderHref={null} />);

    expect(screen.getByText("Automatic — weekly data refresh")).toBeDefined();
    expect(screen.getByText("Automatic — data refresh, AI auto-apply")).toBeDefined();
  });
});
