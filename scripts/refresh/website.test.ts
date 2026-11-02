// website.test.ts — the venue website reader's risky paths (Venue Data Rebuild step 3): only what our own fetched text backs up is proposed.
import { describe, expect, test } from "vitest";
import type { CurrentVenueRow } from "./diffEngine";
import {
  GeminiStop,
  isOwnSite,
  PFP_GARDENS_URL,
  parseHoursQuote,
  runWebsiteReader,
  textFingerprint,
  verifyPlace,
  type PageResult,
  type WebsiteRunParams,
} from "./website";
import { buildProposalWriteStatements, isSwitchApplicable } from "./proposalSql";
import { computeSwitchStates, type SwitchHistoryRow, type SwitchState } from "@/lib/sourceSwitch";

function venue(over: Partial<CurrentVenueRow> = {}): CurrentVenueRow {
  return {
    id: "v-1", name: "Hope Church", category: "pantry", lat: 38.25, lng: -104.6, address: "123 Main St, Pueblo, CO 81003",
    hours_weekly: null, hours_irregular: null, phone: null, url: "https://hopechurch.example/", operator: null, last_verified: "2026-10-12",
    ...over,
  };
}

const PAGE = "Hope Church 123 Main St Pueblo. Food Pantry: Tuesdays 10am-12pm. Office hours Monday - Friday 9 AM - 5 PM. Call 719-555-0100.";
const page = (text: string): PageResult => ({ ok: true, text, finalUrl: "x", via: "fetch" });

/** A Gemini reading of PAGE; override per test. */
function reading(over: Record<string, unknown> = {}) {
  return {
    status: { value: "open", quote: "" },
    address: { value: "", quote: "" },
    phone: { value: "719-555-0100", quote: "Call 719-555-0100" },
    hours: { about: "food_service", quote: "Food Pantry: Tuesdays 10am-12pm", entries: [{ weekday: "tue", ordinal: "every", opens: "10:00", closes: "12:00" }] },
    eligibility: { value: "", quote: "" },
    ...over,
  };
}

function harness(opts: { pages?: Record<string, PageResult>; gemini?: (prompt: string, search: boolean) => unknown; over?: Partial<WebsiteRunParams> } = {}) {
  const fetched: string[] = [];
  const geminiCalls: { prompt: string; search: boolean }[] = [];
  const params: WebsiteRunParams = {
    venues: [venue()],
    casLinkedIds: new Set(),
    pendingUrlByVenue: new Map(),
    decidedUrlVenueIds: new Set(),
    recentlySearchedIds: new Set(),
    fingerprints: new Map(),
    rejected: new Set(),
    runId: "run-1",
    today: "2026-10-26",
    deps: {
      fetchPage: async (url) => {
        fetched.push(url);
        return opts.pages?.[url] ?? (url === PFP_GARDENS_URL ? { ok: false, reason: "HTTP 404" } : page(PAGE));
      },
      gemini: async (prompt, _schema, { search }) => {
        geminiCalls.push({ prompt, search });
        return opts.gemini ? opts.gemini(prompt, search) : reading();
      },
      sleep: async () => {},
      log: () => {},
    },
    ...opts.over,
  };
  return { params, fetched, geminiCalls };
}

describe("quotes must be on our fetched page", () => {
  test("a field whose quote isn't in the page text is dropped, the rest stay", async () => {
    const h = harness({ gemini: () => reading({ phone: { value: "719-555-0199", quote: "Call 719-555-0199" } }) });
    const r = await runWebsiteReader(h.params);
    if (!r.ok) throw new Error(r.reason);
    expect(r.stats.fieldsDropped).toBe(1);
    const [p] = r.proposals;
    expect(p.proposedDiff.fields_changed).toEqual(["hours_weekly", "last_verified"]);
    expect(p.proposedDiff.after).not.toHaveProperty("phone");
  });

  test("a phone whose quote is on the page but shows other digits is dropped", () => {
    const v = verifyPlace(reading({ phone: { value: "719-555-0199", quote: "Call 719-555-0100" } }), PAGE);
    expect(v.phone).toBeUndefined();
    expect(v.dropped).toContain("phone");
  });

  test("the same address written with other commas or no zip is not a change (trial run: Agape, New Heights)", async () => {
    const text = "Hope Church 123 Main St. Pueblo, CO 81003";
    const h = harness({
      pages: { "https://hopechurch.example/": page(text) },
      gemini: () => ({ address: { value: "123 Main St. Pueblo, CO 81003", quote: "123 Main St. Pueblo, CO 81003" } }),
    });
    const r = await runWebsiteReader(h.params);
    if (!r.ok) throw new Error(r.reason);
    expect(r.stats.fieldsConfirmed).toBe(1);
    expect(r.proposals.map((p) => p.proposedDiff.fields_changed)).toEqual([["last_verified"]]);
  });

  test("an address whose quote has the same house number but another street is dropped", () => {
    const text = "Our office is at 623 E 4th St, Pueblo.";
    const v = verifyPlace({ address: { value: "623 Elm St, Pueblo, CO", quote: "623 E 4th St, Pueblo" } }, text);
    expect(v.address).toBeUndefined();
    expect(v.dropped).toContain("address");
    expect(verifyPlace({ address: { value: "623 E 4th St, Pueblo, CO", quote: "623 E 4th St, Pueblo" } }, text).address).toBeDefined();
  });

  test("an address without a house number never replaces ours", () => {
    const text = "La Familia Community Garden, 5th and Hudson";
    const v = verifyPlace({ address: { value: "5th and Hudson", quote: "La Familia Community Garden, 5th and Hudson" } }, text);
    expect(v.address).toBeUndefined();
  });
});

describe("whose website", () => {
  test.each([
    "http://localhost:8090/", "http://127.0.0.1/", "http://2130706433/", "http://10.0.0.5/", "http://192.168.1.1/", "http://172.20.0.1/",
    "http://169.254.169.254/latest/", "http://100.104.48.90:8443/", "http://[::1]/", "http://[fe80::1]/", "http://kyles-macbook-air/",
    "http://family-office.tail1234.ts.net/", "file:///etc/passwd", "ftp://example.org/", "javascript:alert(1)", "https://user:pw@example.org/",
  ])("%s is never treated as a venue's own site", (url) => {
    expect(isOwnSite(url)).toBe(false);
  });

  test("an ordinary public site is", () => {
    expect(isOwnSite("https://www.agapepueblo.com/")).toBe(true);
  });

  test("a directory url (Plentiful) is never read as the venue's own site; discovery searches instead", async () => {
    const plentiful = "https://directory.plentiful.org/colorado/pueblo/hope-church-1234";
    const h = harness({ over: { venues: [venue({ url: plentiful })] }, gemini: (_p, search) => (search ? { candidates: [] } : reading()) });
    const r = await runWebsiteReader(h.params);
    expect(h.fetched).not.toContain(plentiful);
    expect(h.geminiCalls.filter((c) => c.search)).toHaveLength(1);
    if (!r.ok) throw new Error(r.reason);
    expect(r.proposals).toEqual([]);
    expect(r.searchedNone).toEqual(["v-1"]);
  });

  test("discovery never proposes a candidate whose page lacks the venue's name and street number", async () => {
    const sameName = "https://hope-church-denver.example/";
    const sameStreet = "https://grace-temple.example/";
    const social = "https://www.facebook.com/hopechurch";
    const h = harness({
      over: { venues: [venue({ url: null })] },
      pages: {
        [sameName]: page("Hope Church Denver, 123 Colfax Ave. Food Pantry: Tuesdays 10am-12pm."), // our number, not our street
        [sameStreet]: page("Grace Temple, 123 Main St, Pueblo. Food Pantry: Tuesdays 10am-12pm."),
      },
      gemini: (_p, search) => (search ? { candidates: [social, sameName, sameStreet] } : reading()),
    });
    const r = await runWebsiteReader(h.params);
    if (!r.ok) throw new Error(r.reason);
    expect(h.fetched).not.toContain(social); // login walls are never read
    expect(r.proposals).toEqual([]);
    expect(r.stats.discovered).toEqual([]);
    expect(r.searchedNone).toEqual(["v-1"]);
  });

  test("a confirmed candidate is proposed as the url (with the page's findings), and url never switches on", async () => {
    const own = "https://hopechurch.example/food";
    const h = harness({ over: { venues: [venue({ url: null })] }, gemini: (_p, search) => (search ? { candidates: [own] } : reading()) });
    const r = await runWebsiteReader(h.params);
    if (!r.ok) throw new Error(r.reason);
    const [p] = r.proposals;
    expect(p.proposedDiff.after).toMatchObject({ url: own });
    const allOn = computeSwitchStates(approvals(["url", "phone", "hours_weekly"]), []);
    expect(allOn.find((s) => s.source === "website" && s.field === "url")).toBeUndefined();
    expect(isSwitchApplicable(p, allOn)).toBe(false);
  });

  test("a venue searched recently, or whose found url Kyle decided, is not searched again", async () => {
    const h = harness({
      over: { venues: [venue({ id: "a", url: null }), venue({ id: "b", url: null })], recentlySearchedIds: new Set(["a"]), decidedUrlVenueIds: new Set(["b"]) },
    });
    const r = await runWebsiteReader(h.params);
    expect(h.geminiCalls).toHaveLength(0);
    expect(r.ok && r.proposals).toEqual([]);
  });
});

/** Five unedited human approvals of website updates touching `fields` — enough to switch every listed pair on. */
function approvals(fields: string[]): SwitchHistoryRow[] {
  return Array.from({ length: 5 }, (_, i) => ({
    source: "website", change_type: "update", proposed_diff: JSON.stringify({ fields_changed: [...fields, "last_verified"] }),
    status: "approved", reviewed_by: "kyle@example.com", reviewed_at: `2026-11-0${i + 1}T00:00:00Z`, applied_at: `2026-11-0${i + 1}T00:00:00Z`,
  }));
}

describe("office and worship hours never auto-apply", () => {
  test("hours whose quote doesn't name the food service become a review card, even with the switch on", async () => {
    const text = "Hope Church 123 Main St. Open Monday - Friday 9 AM - 5 PM.";
    const h = harness({
      pages: { "https://hopechurch.example/": page(text) },
      gemini: () => reading({ phone: { value: "", quote: "" }, hours: { about: "food_service", quote: "Open Monday - Friday 9 AM - 5 PM", entries: ["mon", "tue", "wed", "thu", "fri"].map((d) => ({ weekday: d, ordinal: "every", opens: "09:00", closes: "17:00" })) } }),
    });
    const r = await runWebsiteReader(h.params);
    if (!r.ok) throw new Error(r.reason);
    const [p] = r.proposals;
    expect(p.proposedDiff.fields_changed).toEqual(["last_verified"]);
    expect(p.proposedDiff.meta?.needs_review).toBeTruthy();
    const on = computeSwitchStates(approvals(["hours_weekly"]), []);
    expect(buildProposalWriteStatements(p, "2026-10-26T09:00:00Z", (v) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`), { switchStates: on }).autoApplied).toBe(false);
  });

  test("Gemini calling them office or worship hours yields no hours at all", () => {
    const v = verifyPlace(reading({ hours: { about: "worship", quote: "Food Pantry: Tuesdays 10am-12pm", entries: [] } }), PAGE);
    expect(v.hours).toBeUndefined();
  });

  test.each([
    ["Food pantry Tuesdays 10am-12pm except holidays", false],
    ["Food pantry by appointment Tuesdays 10am-12pm", false],
    ["Food pantry Tuesdays 9-12", false], // no am/pm: ambiguous
    ["Food pantry: last Friday of the month, 1-3 PM", true],
    ["Food Pantry Monday, Wednesday and Friday 9:00 AM - 11:30 AM", true],
    ["Food pantry 2nd and 4th Tuesday 11 AM - 1 PM", true],
  ])("our own reading of %j converts: %s", (quote, ok) => {
    expect(parseHoursQuote(quote).ok).toBe(ok);
  });

  // Review of PR #845: "alternating" slipped past a whole-word "alternat".
  test.each([
    "Food pantry alternating Tuesdays 10am-12pm",
    "Food pantry alternate Tuesdays 10am-12pm",
    "Food pantry every other Tuesday 10am-12pm",
    "Food pantry bi-weekly on Tuesdays 10am-12pm",
    "Food pantry biweekly Tuesdays 10am-12pm",
    "Seasonal food pantry Tuesdays 10am-12pm",
    "Food pantry Tuesdays 10am-12pm, weather permitting",
    "Food pantry Tuesdays 10am-12pm while supplies last",
    "Food pantry Tuesdays 10am-12pm by appointment",
    "Food pantry Tuesdays 10am-12pm, call ahead",
    "Food pantry monthly on Tuesday 10am-12pm",
    "Food pantry Tuesday of the 2nd week, 10am-12pm",
  ])("%j is never exact hours: it goes to review", (quote) => {
    expect(parseHoursQuote(quote).ok).toBe(false);
    const v = verifyPlace(
      { hours: { about: "food_service", quote, entries: [{ weekday: "tue", ordinal: "every", opens: "10:00", closes: "12:00" }] } },
      `Hope Church. ${quote}.`,
    );
    expect(v.hours?.exact).toBeUndefined();
    expect(v.hours?.reviewReason).toBeTruthy();
  });

  test("when our reading and Gemini's disagree, it goes to review", () => {
    const v = verifyPlace(reading({ hours: { about: "food_service", quote: "Food Pantry: Tuesdays 10am-12pm", entries: [{ weekday: "tue", ordinal: "every", opens: "10:00", closes: "13:00" }] } }), PAGE);
    expect(v.hours?.exact).toBeUndefined();
    expect(v.hours?.reviewReason).toMatch(/disagree/);
  });
});

describe("a failure says nothing about the venue", () => {
  test("a failed fetch writes nothing for that venue, and every page failing fails the run", async () => {
    const h = harness({ pages: { "https://hopechurch.example/": { ok: false, reason: "HTTP 503" } } });
    const r = await runWebsiteReader(h.params);
    expect(r.ok).toBe(false);
    expect(h.geminiCalls).toHaveLength(0);
  });

  test("one failed page among good ones: that venue gets nothing, the others are read", async () => {
    const h = harness({
      over: { venues: [venue(), venue({ id: "v-2", url: "https://down.example/" })] },
      pages: { "https://down.example/": { ok: false, reason: "timeout" } },
    });
    const r = await runWebsiteReader(h.params);
    if (!r.ok) throw new Error(r.reason);
    expect(r.proposals.map((p) => p.targetVenueId)).toEqual(["v-1"]);
    expect(r.stats.venuesFailed).toBe(1);
  });

  test("a page that says nothing about hours or status proposes no closure and no clearing", async () => {
    const h = harness({ over: { venues: [venue({ hours_weekly: JSON.stringify({ tue: ["10:00-12:00"] }), phone: "719-555-0100" })] }, gemini: () => ({}) });
    const r = await runWebsiteReader(h.params);
    if (!r.ok) throw new Error(r.reason);
    expect(r.proposals.map((p) => [p.changeType, p.proposedDiff.fields_changed])).toEqual([["update", ["last_verified"]]]);
  });

  test("Gemini answering nothing costs only that venue; three in a row stops the source", async () => {
    const one = harness({
      over: { venues: [venue({ id: "quiet", url: "https://quiet.example/" }), venue()] },
      gemini: (prompt) => (prompt.includes("quiet.example") ? null : reading()),
    });
    const r1 = await runWebsiteReader(one.params);
    if (!r1.ok) throw new Error(r1.reason);
    expect(r1.proposals.map((p) => p.targetVenueId)).toEqual(["v-1"]);

    const three = harness({ over: { venues: ["a", "b", "c", "d"].map((id) => venue({ id })) }, gemini: () => null });
    expect((await runWebsiteReader(three.params)).ok).toBe(false);
  });

  test("a Gemini failure stops the whole source", async () => {
    const h = harness({
      gemini: () => {
        throw new GeminiStop("quota");
      },
    });
    const r = await runWebsiteReader(h.params);
    expect(r.ok).toBe(false);
  });
});

describe("what the reader never touches", () => {
  test("blessing boxes and Care and Share partners are never fetched", async () => {
    const h = harness({
      over: {
        venues: [venue({ id: "box", category: "blessing_box", url: "https://box.example/" }), venue({ id: "cas", url: "https://cas.example/" }), venue()],
        casLinkedIds: new Set(["cas"]),
      },
    });
    const r = await runWebsiteReader(h.params);
    expect(h.fetched).not.toContain("https://box.example/");
    expect(h.fetched).not.toContain("https://cas.example/");
    expect(r.ok && r.proposals.map((p) => p.targetVenueId)).toEqual(["v-1"]);
  });

  test("a pinned field never auto-applies, even with the website switch on", async () => {
    const r = await runWebsiteReader(harness().params);
    if (!r.ok) throw new Error(r.reason);
    const [p] = r.proposals;
    const on: SwitchState[] = computeSwitchStates(approvals(["hours_weekly", "phone"]), []);
    const sql = (v: string | null | undefined) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
    expect(buildProposalWriteStatements(p, "2026-10-26T09:00:00Z", sql, { switchStates: on }).autoApplied).toBe(true);
    const pinned = buildProposalWriteStatements(p, "2026-10-26T09:00:00Z", sql, {
      switchStates: on,
      pins: [{ venue_id: "v-1", field: "hours_weekly", fetched_at: "2026-10-12T00:00:00Z", pinned_by: "admin", pin_note: "by phone" }],
    });
    expect(pinned.autoApplied).toBe(false);
    expect(pinned.statements.join("\n")).not.toMatch(/UPDATE venues/);
  });
});

describe("Pueblo Food Project page", () => {
  const garden = venue({ id: "garden-la-familia", name: "La Familia Community Garden", category: "garden", address: "814 E 5th St, Pueblo, CO 81001", url: PFP_GARDENS_URL });
  const gardensText = "Community Gardens La Familia Community Garden, 5th and Hudson RMSER Community Garden, 330 Lake Ave";

  test("an unchanged page fingerprint means no Gemini call", async () => {
    const h = harness({
      over: { venues: [garden], fingerprints: new Map([[PFP_GARDENS_URL, textFingerprint(gardensText)]]) },
      pages: { [PFP_GARDENS_URL]: page(gardensText) },
    });
    const r = await runWebsiteReader(h.params);
    expect(h.geminiCalls).toHaveLength(0);
    expect(r.ok && r.fingerprintWrites).toEqual([]);
  });

  test("a changed page is read once, a vaguer address is not proposed, and the new fingerprint is stored", async () => {
    const h = harness({
      over: { venues: [garden] },
      pages: { [PFP_GARDENS_URL]: page(gardensText) },
      gemini: () => ({ places: [{ name: "La Familia Community Garden", address: { value: "5th and Hudson", quote: "La Familia Community Garden, 5th and Hudson" } }] }),
    });
    const r = await runWebsiteReader(h.params);
    if (!r.ok) throw new Error(r.reason);
    expect(h.geminiCalls).toHaveLength(1);
    expect(r.proposals.every((p) => p.proposedDiff.fields_changed.join() === "last_verified")).toBe(true);
    expect(r.fingerprintWrites).toEqual([{ url: PFP_GARDENS_URL, sha256: textFingerprint(gardensText) }]);
  });
});
