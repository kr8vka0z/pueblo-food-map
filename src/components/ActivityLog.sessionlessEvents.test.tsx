/**
 * Sign-out and passkey records with no session (#894 item 11) must sit
 * inside their own card in the server HTML. The card used to wrap an <li>
 * directly in an <li>, which the browser's HTML parser splits apart, so the
 * row showed outside the frame until React took over. Parsed through
 * innerHTML (the browser's parser), not React DOM, which doesn't split it.
 */

import { expect, test } from "vitest";
import { renderToString } from "react-dom/server";
import ActivityLog from "@/components/ActivityLog";
import { buildActivityDays, parseActivityFilters, type AuthEventRow } from "@/lib/activityLog";

const base: AuthEventRow = {
  id: 1,
  event: "sign_out",
  email: "kysboyd@gmail.com",
  user_id: "u",
  session_id: null,
  method: null,
  ip: null,
  user_agent: null,
  city: null,
  region: null,
  country: null,
  detail_json: null,
  created_at: "2026-09-27T15:00:00.000Z",
};

test("sessionless sign-out and passkey rows each stay inside one card", () => {
  const events: AuthEventRow[] = [
    base,
    { ...base, id: 2, event: "passkey_added", created_at: "2026-09-27T16:00:00.000Z" },
  ];
  const days = buildActivityDays({ actions: [], events, sessionHeaders: [] });
  const filters = parseActivityFilters({}, new Date("2026-09-27T20:00:00.000Z"));

  document.body.innerHTML = renderToString(<ActivityLog days={days} filters={filters} people={[]} olderHref={null} />);

  const dayList = document.querySelector("section ul")!;
  const cards = [...dayList.children];
  expect(cards).toHaveLength(2);
  expect(cards.map((c) => c.textContent).sort()).toEqual([
    expect.stringContaining("Added a passkey"),
    expect.stringContaining("Signed out"),
  ]);
});
