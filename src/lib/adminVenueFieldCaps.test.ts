/**
 * Tests for src/lib/adminVenueValidation.ts's field length caps (#297,
 * rescoped: the rate-limiter eviction half of the original issue shipped
 * separately as #587 — this covers only the remaining "admin field length
 * caps" half).
 *
 * New file rather than an addition to adminVenueValidation.test.ts: this
 * worktree's write-guard blocks editing an existing test file on a fix/*
 * branch (bug fixes are proven by a test that predates the fix and stays
 * untouched) — a new file is the sanctioned way to add coverage.
 *
 * WHY these caps at all: admin write routes previously capped only email
 * (a ReDoS guard). name/address/notes/source/operator/url/phone were
 * uncapped, letting an authenticated admin write (or approved-submission
 * text folded into notes) store an arbitrarily long string that ships into
 * the public published-venues.ts bundle. Every cap below is imported from
 * FIELD_LIMITS (src/lib/fieldLimits.ts) — shared with, not copied from,
 * the public forms' own limits (see that module for which constant maps to
 * which field and why).
 */

import { describe, test, expect } from "vitest";
import { validateCreateVenuePayload } from "@/lib/adminVenueValidation";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    source: "Manual entry",
    last_verified: "2026-07-03",
    ...overrides,
  };
}

describe("validateCreateVenuePayload — field length caps (#297)", () => {
  test("rejects an over-cap name", () => {
    const result = validateCreateVenuePayload(
      validPayload({ name: "a".repeat(FIELD_LIMITS.SUGGEST_VENUE_NAME + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeTruthy();
  });

  test("accepts a name at exactly the cap", () => {
    const result = validateCreateVenuePayload(
      validPayload({ name: "a".repeat(FIELD_LIMITS.SUGGEST_VENUE_NAME) }),
    );
    expect(result.ok).toBe(true);
  });

  test("rejects an over-cap address", () => {
    const result = validateCreateVenuePayload(
      validPayload({ address: "a".repeat(FIELD_LIMITS.SUGGEST_ADDRESS + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.address).toBeTruthy();
  });

  test("accepts an address at exactly the cap", () => {
    const result = validateCreateVenuePayload(
      validPayload({ address: "a".repeat(FIELD_LIMITS.SUGGEST_ADDRESS) }),
    );
    expect(result.ok).toBe(true);
  });

  test("rejects an over-cap source", () => {
    const result = validateCreateVenuePayload(
      validPayload({ source: "a".repeat(FIELD_LIMITS.ADMIN_VENUE_SOURCE + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.source).toBeTruthy();
  });

  test("accepts a source at exactly the cap", () => {
    const result = validateCreateVenuePayload(
      validPayload({ source: "a".repeat(FIELD_LIMITS.ADMIN_VENUE_SOURCE) }),
    );
    expect(result.ok).toBe(true);
  });

  test("rejects over-cap notes", () => {
    const result = validateCreateVenuePayload(
      validPayload({ notes: "a".repeat(FIELD_LIMITS.SUGGEST_NOTES + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.notes).toBeTruthy();
  });

  test("accepts notes at exactly the cap", () => {
    const result = validateCreateVenuePayload(
      validPayload({ notes: "a".repeat(FIELD_LIMITS.SUGGEST_NOTES) }),
    );
    expect(result.ok).toBe(true);
  });

  test("rejects an over-cap operator", () => {
    const result = validateCreateVenuePayload(
      validPayload({ operator: "a".repeat(FIELD_LIMITS.SUGGEST_VENUE_NAME + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.operator).toBeTruthy();
  });

  test("accepts an operator at exactly the cap", () => {
    const result = validateCreateVenuePayload(
      validPayload({ operator: "a".repeat(FIELD_LIMITS.SUGGEST_VENUE_NAME) }),
    );
    expect(result.ok).toBe(true);
  });

  test("rejects an over-cap url", () => {
    const result = validateCreateVenuePayload(
      validPayload({ url: "a".repeat(FIELD_LIMITS.SUGGEST_CONTACT + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.url).toBeTruthy();
  });

  test("accepts a url at exactly the cap", () => {
    const result = validateCreateVenuePayload(
      validPayload({ url: "a".repeat(FIELD_LIMITS.SUGGEST_CONTACT) }),
    );
    expect(result.ok).toBe(true);
  });

  test("rejects an over-cap phone", () => {
    const result = validateCreateVenuePayload(
      validPayload({ phone: "1".repeat(FIELD_LIMITS.SUGGEST_CONTACT + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.phone).toBeTruthy();
  });

  test("accepts phone at exactly the cap", () => {
    const result = validateCreateVenuePayload(
      validPayload({ phone: "1".repeat(FIELD_LIMITS.SUGGEST_CONTACT) }),
    );
    expect(result.ok).toBe(true);
  });
});
