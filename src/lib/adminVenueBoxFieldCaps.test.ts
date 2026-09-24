/**
 * Tests for src/lib/adminVenueValidation.ts's validateBoxFields length caps
 * (#297 follow-up — flagged by the Claude CI reviewer on PR #622: the same
 * threat model as the venue-level caps applies to blessing-box fields, and
 * arguably worse, since boxes are LIVE (AGENTS.md "Boxes are LIVE, not
 * published" — loadLiveBoxes() reads D1 straight through at request time,
 * with no publish gate an oversized value could be caught behind).
 *
 * New file, not an addition to adminVenueValidation.test.ts or
 * adminVenueFieldCaps.test.ts — this worktree's write-guard blocks editing
 * an existing test file on a fix/* branch.
 */

import { describe, test, expect } from "vitest";
import { validateCreateVenuePayload } from "@/lib/adminVenueValidation";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

function boxPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Elm Street Blessing Box",
    category: "blessing_box",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    source: "Manual entry",
    last_verified: "2026-07-03",
    ...overrides,
  };
}

describe("validateCreateVenuePayload — blessing-box field length caps (#297 follow-up)", () => {
  test("rejects an over-cap host_name", () => {
    const result = validateCreateVenuePayload(
      boxPayload({ host_name: "a".repeat(FIELD_LIMITS.SUGGEST_VENUE_NAME + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.host_name).toBeTruthy();
  });

  test("accepts host_name at exactly the cap", () => {
    const result = validateCreateVenuePayload(
      boxPayload({ host_name: "a".repeat(FIELD_LIMITS.SUGGEST_VENUE_NAME) }),
    );
    expect(result.ok).toBe(true);
  });

  test("rejects an over-cap host_note", () => {
    const result = validateCreateVenuePayload(
      boxPayload({ host_note: "a".repeat(FIELD_LIMITS.BOX_ADOPTER_NOTE + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.host_note).toBeTruthy();
  });

  test("accepts host_note at exactly the cap", () => {
    const result = validateCreateVenuePayload(
      boxPayload({ host_note: "a".repeat(FIELD_LIMITS.BOX_ADOPTER_NOTE) }),
    );
    expect(result.ok).toBe(true);
  });

  test("rejects an over-cap host_contact (PRIVATE field — still capped, same threat model)", () => {
    const result = validateCreateVenuePayload(
      boxPayload({ host_contact: "a".repeat(FIELD_LIMITS.SUGGEST_CONTACT + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.host_contact).toBeTruthy();
  });

  test("accepts host_contact at exactly the cap", () => {
    const result = validateCreateVenuePayload(
      boxPayload({ host_contact: "a".repeat(FIELD_LIMITS.SUGGEST_CONTACT) }),
    );
    expect(result.ok).toBe(true);
  });

  test("rejects an over-cap most_needed", () => {
    const result = validateCreateVenuePayload(
      boxPayload({ most_needed: "a".repeat(FIELD_LIMITS.BOX_CHECKIN_NOTE + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.most_needed).toBeTruthy();
  });

  test("accepts most_needed at exactly the cap", () => {
    const result = validateCreateVenuePayload(
      boxPayload({ most_needed: "a".repeat(FIELD_LIMITS.BOX_CHECKIN_NOTE) }),
    );
    expect(result.ok).toBe(true);
  });

  test("non-blessing_box categories never see these caps (box fields aren't validated at all)", () => {
    const result = validateCreateVenuePayload({
      name: "Eastside Pantry",
      category: "pantry",
      lat: 38.25,
      lng: -104.6,
      address: "123 Test St, Pueblo, CO",
      source: "Manual entry",
      last_verified: "2026-07-03",
      host_name: "a".repeat(FIELD_LIMITS.SUGGEST_VENUE_NAME + 1),
    });
    expect(result.ok).toBe(true);
  });
});
