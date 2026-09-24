// triage.test.ts — Jev triage + the pairing/triage pass, with Jev mocked via an injected fetch.
import { describe, expect, test, vi } from "vitest";
import {
  classifyUpdateLane,
  computeAutoApplyEligibility,
  createTriageSession,
  runTriagePass,
  triageProposal,
  JEV_MODEL,
  TYPESAFE_URL,
  type JevResponse,
} from "./triage";
import { buildRenameProposal, findRenamePairCandidates } from "./renamePairs";
import { rejectionKey, type CurrentVenueRow, type ProposalDraft } from "./diffEngine";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function jsonResponse(body: JevResponse, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** A fetch that answers every question id in the request body from `answers` (by id). */
function jevFetch(answers: Record<string, object>, model = "jev-1.13.0") {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { questions: Record<string, unknown> };
    const out: Record<string, object> = {};
    for (const id of Object.keys(body.questions)) if (answers[id]) out[id] = answers[id];
    return jsonResponse({ model, answers: out, usage: { input_tokens: 100, output_tokens: 10 } });
  });
}

function session(fetchImpl: typeof fetch | ReturnType<typeof vi.fn>, apiKey: string | null = "test-key") {
  return createTriageSession({ apiKey: apiKey ?? undefined, fetchImpl: fetchImpl as typeof fetch, retryDelayMs: 0 });
}

function row(overrides: Partial<CurrentVenueRow> = {}): CurrentVenueRow {
  return {
    id: "plentiful-old-name",
    name: "Old Name Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Main St",
    hours_weekly: null,
    phone: "719-555-0100",
    url: null,
    operator: null,
    last_verified: "2026-08-01",
    ...overrides,
  };
}

function remove(id = "plentiful-old-name"): ProposalDraft {
  return {
    source: "plentiful",
    targetVenueId: id,
    changeType: "remove",
    proposedDiff: { before: { id, name: "Old Name Pantry" }, after: null, fields_changed: [] },
    diffHash: `h-rm-${id}`,
    runId: "run-1",
  };
}

function add(id = "plentiful-new-name", after: Record<string, unknown> = {}): ProposalDraft {
  return {
    source: "plentiful",
    targetVenueId: id,
    changeType: "add",
    proposedDiff: {
      before: null,
      after: {
        id,
        name: "New Name Pantry",
        category: "pantry",
        lat: 38.2545,
        lng: -104.6092,
        address: "123 Main St",
        phone: "719-555-0100",
        last_verified: "2026-09-28",
        ...after,
      },
      fields_changed: ["id", "name", "category", "lat", "lng", "address", "phone", "last_verified"],
    },
    diffHash: `h-add-${id}`,
    runId: "run-1",
  };
}

function update(field: string, before: unknown, after: unknown, overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    source: "osm",
    targetVenueId: "osm-node-1",
    changeType: "update",
    proposedDiff: {
      before: { [field]: before, last_verified: "2026-08-01" },
      after: { [field]: after, last_verified: "2026-09-28" },
      fields_changed: [field, "last_verified"],
    },
    diffHash: "h-up",
    runId: "run-1",
    ...overrides,
  };
}

const dateOnly: ProposalDraft = {
  source: "osm",
  targetVenueId: "osm-node-2",
  changeType: "update",
  proposedDiff: { before: { last_verified: "2026-08-01" }, after: { last_verified: "2026-09-28" }, fields_changed: ["last_verified"] },
  diffHash: "h-date",
  runId: "run-1",
};

// ─── Session: request shape, retry, breaker, degrade ───────────────────────

describe("createTriageSession", () => {
  test("posts {state, model, questions} with a Bearer key to the documented endpoint", async () => {
    const fetchImpl = jevFetch({ q: { type: "noul", noul: 0.5 } });
    const s = session(fetchImpl);
    await s.ask({ a: 1 }, { q: { type: "noul", instructions: "?" } });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TYPESAFE_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(JSON.parse(String(init.body))).toEqual({ state: { a: 1 }, model: JEV_MODEL, questions: { q: { type: "noul", instructions: "?" } } });
  });

  test("no key: unavailable, never calls fetch, returns null", async () => {
    const fetchImpl = vi.fn();
    const s = session(fetchImpl, null);
    expect(s.available()).toBe(false);
    expect(await s.ask({}, {})).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("retries once on 429, then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ answers: {}, usage: { input_tokens: 7 } }));
    const s = session(fetchImpl);
    expect(await s.ask({}, {})).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(s.stats.inputTokens).toBe(7);
  });

  test("three consecutive failures switch Jev off for the rest of the run", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const s = session(fetchImpl);
    for (let i = 0; i < 3; i++) expect(await s.ask({}, {})).toBeNull();
    expect(s.available()).toBe(false);
    await s.ask({}, {});
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test("a thrown fetch (network down / timeout) is a null answer, not an exception", async () => {
    const s = session(vi.fn().mockRejectedValue(new Error("boom")));
    await expect(s.ask({}, {})).resolves.toBeNull();
  });
});

// ─── Lane rules ────────────────────────────────────────────────────────────

describe("computeAutoApplyEligibility", () => {
  test("phone that only changed formatting is eligible", () => {
    expect(computeAutoApplyEligibility(update("phone", "719-555-0100", "(719) 555-0100"))).toBe(true);
    expect(computeAutoApplyEligibility(update("phone", "719-555-0100", "+1 719 555 0100"))).toBe(true);
  });
  test("url scheme/www/trailing-slash change is eligible", () => {
    expect(computeAutoApplyEligibility(update("url", "http://www.example.org/pantry/", "https://example.org/pantry"))).toBe(true);
  });
  test("a real phone or url change is never eligible", () => {
    expect(computeAutoApplyEligibility(update("phone", "719-555-0100", "719-555-0199"))).toBe(false);
    expect(computeAutoApplyEligibility(update("url", "https://a.org", "https://b.org"))).toBe(false);
  });
  test("other fields, multi-field changes and link_health are never eligible", () => {
    expect(computeAutoApplyEligibility(update("name", "A", "A "))).toBe(false);
    expect(computeAutoApplyEligibility(update("url", "http://a.org", "https://a.org", { source: "link_health" }))).toBe(false);
    const multi = update("phone", "719-555-0100", "(719) 555-0100");
    multi.proposedDiff.fields_changed.push("url");
    expect(computeAutoApplyEligibility(multi)).toBe(false);
  });
});

describe("classifyUpdateLane", () => {
  const reformat = update("phone", "719-555-0100", "(719) 555-0100");
  const real = update("phone", "719-555-0100", "719-555-0199");
  // noul = same_value: high means "same value, only formatted differently".
  test("auto_apply_candidate needs BOTH the shape match and near-certain noise", () => {
    expect(classifyUpdateLane(reformat, { noul: 0.95 })).toBe("auto_apply_candidate");
    expect(classifyUpdateLane(real, { noul: 0.95 })).toBe("likely_noise");
    expect(classifyUpdateLane(reformat, { noul: 0.85 })).toBe("likely_noise");
  });
  test("real change or a missing answer → needs_human", () => {
    expect(classifyUpdateLane(real, { noul: 0.05 })).toBe("needs_human");
    expect(classifyUpdateLane(reformat, { noul: 0.7 })).toBe("needs_human");
    expect(classifyUpdateLane(real, undefined)).toBe("needs_human");
  });
});

describe("triageProposal", () => {
  test("remove: sends the venue's full current row (not just {id, name}) and always lands needs_human", async () => {
    const fetchImpl = jevFetch({ remove_reason: { type: "choice", choice: "temporarily_missing", probabilities: { temporarily_missing: 0.8 } } });
    const result = await triageProposal(remove(), session(fetchImpl), row());
    const state = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body)).state;
    expect(state.before).toMatchObject({ name: "Old Name Pantry", address: "123 Main St", phone: "719-555-0100" });
    expect(state.before).not.toHaveProperty("last_verified");
    expect(result?.lane).toBe("needs_human");
    expect(result?.answers.remove_reason.choice).toBe("temporarily_missing");
  });

  test("add: no Jev call, lane needs_human, model null (a rule, not the AI)", async () => {
    const fetchImpl = vi.fn();
    const result = await triageProposal(add(), session(fetchImpl));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ lane: "needs_human", model: null });
  });

  test("stores the model that actually answered, from the response", async () => {
    const result = await triageProposal(update("phone", "1", "2"), session(jevFetch({ same_value: { noul: 0.1 } }, "jev-1.14.0")));
    expect(result?.model).toBe("jev-1.14.0");
  });

  test("Jev failure → null (write untriaged)", async () => {
    const result = await triageProposal(update("phone", "1", "2"), session(vi.fn().mockResolvedValue(new Response("", { status: 503 }))));
    expect(result).toBeNull();
  });
});

// ─── The whole pass ─────────────────────────────────────────────────────────

describe("runTriagePass", () => {
  const base = { currentRows: [row()], rejectedKeys: new Set<string>(), today: "2026-09-28", schemaReady: true };

  test("Jev confirms a pair → ONE rename proposal on the old id, lane renamed_or_moved", async () => {
    const rm = remove();
    const ad = add();
    const out = await runTriagePass({ ...base, proposals: [rm, ad], session: session(jevFetch({ same_place: { noul: 0.93 } })) });
    expect(out.proposals).toHaveLength(1);
    const rename = out.proposals[0];
    expect(rename).toMatchObject({ changeType: "update", targetVenueId: "plentiful-old-name" });
    expect(rename.proposedDiff.meta?.rename).toMatchObject({ from_id: "plentiful-old-name", to_id: "plentiful-new-name" });
    expect(out.triage.get(rename)?.lane).toBe("renamed_or_moved");
    expect(out.renamePairs).toBe(1);
    expect(out.extraSupersedeKeys).toEqual(["plentiful:plentiful-new-name"]);
  });

  test("Jev says two different places → remove and add stay separate and are each triaged", async () => {
    const rm = remove();
    const ad = add();
    const out = await runTriagePass({
      ...base,
      proposals: [rm, ad],
      session: session(jevFetch({ same_place: { noul: 0.2 }, remove_reason: { choice: "gone", probabilities: { gone: 0.7 } } })),
    });
    expect(out.proposals).toEqual([rm, ad]);
    expect(out.triage.get(rm)?.lane).toBe("needs_human");
    expect(out.triage.get(ad)?.lane).toBe("needs_human");
  });

  test("no key → pairs on the plain heuristic alone, nothing triaged", async () => {
    const out = await runTriagePass({ ...base, proposals: [remove(), add()], session: session(vi.fn(), null) });
    expect(out.proposals).toHaveLength(1);
    expect(out.proposals[0].proposedDiff.meta?.rename).toBeDefined();
    expect(out.triage.size).toBe(0);
  });

  test("Jev outage mid-run → heuristic pair, rest untriaged, never throws", async () => {
    const out = await runTriagePass({
      ...base,
      proposals: [remove(), add(), update("phone", "1", "2")],
      session: session(vi.fn().mockRejectedValue(new Error("down"))),
    });
    expect(out.proposals).toHaveLength(2);
    expect(out.triage.size).toBe(0);
  });

  test("a rename a human already rejected is not re-paired", async () => {
    const rm = remove();
    const ad = add();
    const rejected = buildRenameProposal(findRenamePairCandidates([rm, ad], [row()])[0], base.today);
    const out = await runTriagePass({
      ...base,
      rejectedKeys: new Set([rejectionKey(rejected.source, rejected.targetVenueId, rejected.diffHash)]),
      proposals: [rm, ad],
      session: session(vi.fn(), null),
    });
    expect(out.proposals).toEqual([rm, ad]);
  });

  test("date-only and link_health proposals pass straight through with no Jev call", async () => {
    const linkHealth = update("url", "https://dead.example", null, { source: "link_health" });
    const fetchImpl = vi.fn();
    const out = await runTriagePass({ ...base, proposals: [dateOnly, linkHealth], session: session(fetchImpl) });
    expect(out.proposals).toEqual([dateOnly, linkHealth]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(out.triage.size).toBe(0);
  });

  test("migration 0016 missing → untouched passthrough, no pairing, no calls", async () => {
    const fetchImpl = vi.fn();
    const proposals = [remove(), add()];
    const out = await runTriagePass({ ...base, schemaReady: false, proposals, session: session(fetchImpl) });
    expect(out.proposals).toBe(proposals);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
