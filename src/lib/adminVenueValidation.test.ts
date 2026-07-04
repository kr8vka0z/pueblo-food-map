/**
 * Tests for src/lib/adminVenueValidation.ts (#254).
 *
 * Covers every field rule the POST /api/admin/venues route depends on:
 * required-field checks, the category enum, lat/lng bounds, the tri-state
 * accepts_snap/accepts_wic mapping, the hours_weekly shape guard, and the
 * optional free-text fields. Route-level wiring (auth, db.batch(), the
 * 201/403/422 responses) is proved separately in
 * src/app/api/admin/venues/route.test.ts — this file proves the validation
 * rules themselves in isolation, same split as publishVenues.test.ts vs.
 * publishVenues.ts's validateAndMapRow.
 */

import { describe, test, expect } from "vitest";
import { validateCreateVenuePayload } from "@/lib/adminVenueValidation";

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

describe("validateCreateVenuePayload — happy path", () => {
  test("a minimal valid payload (required fields only) validates, optional fields default to null", () => {
    const result = validateCreateVenuePayload(validPayload());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields).toEqual({
      name: "Eastside Pantry",
      category: "pantry",
      lat: 38.25,
      lng: -104.6,
      address: "123 Test St, Pueblo, CO",
      hoursWeeklyJson: null,
      acceptsSnap: null,
      acceptsWic: null,
      phone: null,
      email: null,
      url: null,
      notes: null,
      operator: null,
      source: "Manual entry",
      lastVerified: "2026-07-03",
      outsideCounty: 0,
    });
  });

  test("trims whitespace on string fields", () => {
    const result = validateCreateVenuePayload(
      validPayload({ name: "  Eastside Pantry  ", address: "  123 Test St  " }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.name).toBe("Eastside Pantry");
    expect(result.fields.address).toBe("123 Test St");
  });

  test("accepts every optional field when present", () => {
    const result = validateCreateVenuePayload(
      validPayload({
        hours_weekly: { mon: ["09:00-17:00"], tue: ["09:00-17:00", "18:00-20:00"] },
        accepts_snap: 1,
        accepts_wic: 0,
        phone: "719-555-0100",
        email: "info@example.org",
        url: "https://example.org",
        notes: "Bring ID",
        operator: "Example Org",
        outside_county: true,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.hoursWeeklyJson).toBe(
      JSON.stringify({ mon: ["09:00-17:00"], tue: ["09:00-17:00", "18:00-20:00"] }),
    );
    expect(result.fields.acceptsSnap).toBe(1);
    expect(result.fields.acceptsWic).toBe(0);
    expect(result.fields.phone).toBe("719-555-0100");
    expect(result.fields.email).toBe("info@example.org");
    expect(result.fields.url).toBe("https://example.org");
    expect(result.fields.notes).toBe("Bring ID");
    expect(result.fields.operator).toBe("Example Org");
    expect(result.fields.outsideCounty).toBe(1);
  });

  test("an empty hours_weekly object (every day left blank) maps to null, not '{}'", () => {
    const result = validateCreateVenuePayload(validPayload({ hours_weekly: {} }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.hoursWeeklyJson).toBeNull();
  });

  test("outside_county false / 0 / omitted all normalize to 0", () => {
    for (const value of [false, 0, undefined]) {
      const result = validateCreateVenuePayload(validPayload({ outside_county: value }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.fields.outsideCounty).toBe(0);
    }
  });

  test("boundary lat/lng values (±90 / ±180) are valid, not just interior points", () => {
    for (const [lat, lng] of [
      [90, 180],
      [-90, -180],
    ]) {
      const result = validateCreateVenuePayload(validPayload({ lat, lng }));
      expect(result.ok).toBe(true);
    }
  });
});

describe("validateCreateVenuePayload — required-field errors", () => {
  test("missing name", () => {
    const result = validateCreateVenuePayload(validPayload({ name: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeTruthy();
  });

  test("whitespace-only name is still missing", () => {
    const result = validateCreateVenuePayload(validPayload({ name: "   " }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeTruthy();
  });

  test("invalid category", () => {
    const result = validateCreateVenuePayload(validPayload({ category: "not-a-real-category" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.category).toBeTruthy();
  });

  test("missing address", () => {
    const result = validateCreateVenuePayload(validPayload({ address: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.address).toBeTruthy();
  });

  test("missing source", () => {
    const result = validateCreateVenuePayload(validPayload({ source: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.source).toBeTruthy();
  });

  test("missing/unparsable last_verified", () => {
    const result = validateCreateVenuePayload(validPayload({ last_verified: "not-a-date" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.last_verified).toBeTruthy();
  });

  test("collects every error in one pass — a form with 3 problems reports all 3, not just the first", () => {
    const result = validateCreateVenuePayload(
      validPayload({ name: "", category: "not-a-real-category", lat: "abc" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeTruthy();
    expect(result.errors.category).toBeTruthy();
    expect(result.errors.lat).toBeTruthy();
  });
});

describe("validateCreateVenuePayload — lat/lng", () => {
  test("non-numeric (string) lat is rejected even if it looks numeric", () => {
    const result = validateCreateVenuePayload(validPayload({ lat: "38.25" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.lat).toBeTruthy();
  });

  test("NaN / Infinity lat and lng are rejected", () => {
    const result = validateCreateVenuePayload(validPayload({ lat: NaN, lng: Infinity }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.lat).toBeTruthy();
    expect(result.errors.lng).toBeTruthy();
  });

  test("out-of-range lat/lng are rejected", () => {
    const result = validateCreateVenuePayload(validPayload({ lat: 91, lng: -181 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.lat).toBeTruthy();
    expect(result.errors.lng).toBeTruthy();
  });
});

describe("validateCreateVenuePayload — tri-state accepts_snap/accepts_wic", () => {
  test("accepts null, 0, or 1", () => {
    for (const value of [null, 0, 1]) {
      const result = validateCreateVenuePayload(
        validPayload({ accepts_snap: value, accepts_wic: value }),
      );
      expect(result.ok).toBe(true);
    }
  });

  test("rejects a boolean or any other value", () => {
    const result = validateCreateVenuePayload(validPayload({ accepts_snap: true }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.accepts_snap).toBeTruthy();
  });
});

describe("validateCreateVenuePayload — hours_weekly shape", () => {
  test("rejects a non-object value", () => {
    const result = validateCreateVenuePayload(validPayload({ hours_weekly: "Mon-Fri 9-5" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.hours_weekly).toBeTruthy();
  });

  test("rejects an unknown day key", () => {
    const result = validateCreateVenuePayload(
      validPayload({ hours_weekly: { someday: ["09:00-17:00"] } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.hours_weekly).toBeTruthy();
  });

  test("rejects a day value that isn't an array of strings", () => {
    const result = validateCreateVenuePayload(validPayload({ hours_weekly: { mon: "09:00-17:00" } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.hours_weekly).toBeTruthy();
  });
});

describe("validateCreateVenuePayload — optional email format", () => {
  test("rejects a malformed email when provided", () => {
    const result = validateCreateVenuePayload(validPayload({ email: "not-an-email" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.email).toBeTruthy();
  });

  test("rejects an over-length email — bounds the regex against pathological input", () => {
    const result = validateCreateVenuePayload(
      validPayload({ email: "a".repeat(255) + "@example.org" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.email).toBeTruthy();
  });

  test("omitted email is valid (optional field)", () => {
    const result = validateCreateVenuePayload(validPayload());
    expect(result.ok).toBe(true);
  });
});
