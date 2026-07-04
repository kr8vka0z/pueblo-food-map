/**
 * Tests for src/lib/adminVenueForm.ts (#255).
 *
 * Covers the D1 row -> AddVenueForm initialValues mapping used by the edit
 * page (src/app/admin/venues/[id]/edit/page.tsx): tri-state accepts_snap/wic
 * round-tripping, hours_weekly JSON -> per-day comma-joined draft text,
 * null-to-empty-string coercion on optional fields, and malformed-JSON
 * defensiveness.
 */

import { describe, test, expect } from "vitest";
import { mapVenueRowToFormValues, mapSubmissionPayloadToFormValues } from "@/lib/adminVenueForm";
import type { AdminVenueRow } from "@/types/venue";
import type { NewVenuePayload } from "@/lib/publicSubmissions";

function makeRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "manual-abc",
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "Manual entry",
    last_verified: "2026-07-03",
    status: "draft",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    created_by: "admin@pueblofoodmap.com",
    updated_at: "2026-07-01T00:00:00.000Z",
    updated_by: "admin@pueblofoodmap.com",
    published_at: null,
    published_by: null,
    ...overrides,
  };
}

describe("mapVenueRowToFormValues", () => {
  test("maps required scalar fields directly, coercing lat/lng to strings", () => {
    const values = mapVenueRowToFormValues(makeRow());
    expect(values.name).toBe("Eastside Pantry");
    expect(values.category).toBe("pantry");
    expect(values.address).toBe("123 Test St, Pueblo, CO");
    expect(values.lastVerified).toBe("2026-07-03");
    expect(values.lat).toBe("38.25");
    expect(values.lng).toBe("-104.6");
    expect(values.source).toBe("Manual entry");
  });

  test("null optional text fields map to empty strings, not null/undefined", () => {
    const values = mapVenueRowToFormValues(makeRow());
    expect(values.phone).toBe("");
    expect(values.email).toBe("");
    expect(values.url).toBe("");
    expect(values.operator).toBe("");
    expect(values.notes).toBe("");
  });

  test("populated optional text fields pass through unchanged", () => {
    const values = mapVenueRowToFormValues(
      makeRow({ phone: "719-555-0100", email: "a@b.com", url: "https://a.com", operator: "Op", notes: "Note" }),
    );
    expect(values.phone).toBe("719-555-0100");
    expect(values.email).toBe("a@b.com");
    expect(values.url).toBe("https://a.com");
    expect(values.operator).toBe("Op");
    expect(values.notes).toBe("Note");
  });

  test("tri-state accepts_snap/accepts_wic: 1 -> '1', 0 -> '0', null -> ''", () => {
    expect(mapVenueRowToFormValues(makeRow({ accepts_snap: 1, accepts_wic: 0 })).acceptsSnap).toBe("1");
    expect(mapVenueRowToFormValues(makeRow({ accepts_snap: 1, accepts_wic: 0 })).acceptsWic).toBe("0");
    expect(mapVenueRowToFormValues(makeRow({ accepts_snap: null, accepts_wic: null })).acceptsSnap).toBe("");
    expect(mapVenueRowToFormValues(makeRow({ accepts_snap: null, accepts_wic: null })).acceptsWic).toBe("");
  });

  test("outside_county: 1 -> true, 0 -> false", () => {
    expect(mapVenueRowToFormValues(makeRow({ outside_county: 1 })).outsideCounty).toBe(true);
    expect(mapVenueRowToFormValues(makeRow({ outside_county: 0 })).outsideCounty).toBe(false);
  });

  test("null hours_weekly maps to every day blank", () => {
    const values = mapVenueRowToFormValues(makeRow({ hours_weekly: null }));
    expect(values.hours).toEqual({
      mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "",
    });
  });

  test("hours_weekly JSON maps to comma-joined per-day text, untouched days blank", () => {
    const values = mapVenueRowToFormValues(
      makeRow({ hours_weekly: JSON.stringify({ mon: ["09:00-17:00"], wed: ["09:00-12:00", "13:00-17:00"] }) }),
    );
    expect(values.hours).toEqual({
      mon: "09:00-17:00",
      tue: "",
      wed: "09:00-12:00, 13:00-17:00",
      thu: "",
      fri: "",
      sat: "",
      sun: "",
    });
  });

  test("malformed hours_weekly JSON degrades to every day blank instead of throwing", () => {
    const values = mapVenueRowToFormValues(makeRow({ hours_weekly: "{not valid json" }));
    expect(values.hours).toEqual({
      mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "",
    });
  });
});

// ─── mapSubmissionPayloadToFormValues (#259) ────────────────────────────────

function makePayload(overrides: Partial<NewVenuePayload> = {}): NewVenuePayload {
  return {
    venueName: "Eastside Pantry",
    address: "123 Test St, Pueblo, CO",
    category: "pantry",
    hours: "Mon-Fri 9-5",
    contact: "719-555-0100",
    acceptsSnap: true,
    acceptsWic: false,
    notes: "Enter through the side door.",
    submitterEmail: "suggester@example.com",
    ...overrides,
  };
}

describe("mapSubmissionPayloadToFormValues", () => {
  test("maps name/address directly", () => {
    const values = mapSubmissionPayloadToFormValues(makePayload());
    expect(values.name).toBe("Eastside Pantry");
    expect(values.address).toBe("123 Test St, Pueblo, CO");
  });

  test("a category that matches a real VenueCategory passes through unchanged", () => {
    for (const category of ["pantry", "grocery", "convenience", "farm", "garden", "edible_landscape", "meal_site"]) {
      expect(mapSubmissionPayloadToFormValues(makePayload({ category })).category).toBe(category);
    }
  });

  test("an unrecognized category falls back to '' (admin picks it) rather than emitting an invalid value", () => {
    const values = mapSubmissionPayloadToFormValues(makePayload({ category: "not-a-real-category" }));
    expect(values.category).toBe("");
  });

  test("acceptsSnap/acceptsWic booleans map to the tri-state '1'/'0' strings", () => {
    expect(mapSubmissionPayloadToFormValues(makePayload({ acceptsSnap: true, acceptsWic: false })).acceptsSnap).toBe("1");
    expect(mapSubmissionPayloadToFormValues(makePayload({ acceptsSnap: true, acceptsWic: false })).acceptsWic).toBe("0");
    expect(mapSubmissionPayloadToFormValues(makePayload({ acceptsSnap: false, acceptsWic: true })).acceptsSnap).toBe("0");
    expect(mapSubmissionPayloadToFormValues(makePayload({ acceptsSnap: false, acceptsWic: true })).acceptsWic).toBe("1");
  });

  test("notes prefill carries the submitter's notes plus hours/contact/submitterEmail so nothing submitted is lost", () => {
    const values = mapSubmissionPayloadToFormValues(makePayload());
    expect(values.notes).toContain("Enter through the side door.");
    expect(values.notes).toContain("Mon-Fri 9-5");
    expect(values.notes).toContain("719-555-0100");
    expect(values.notes).toContain("suggester@example.com");
  });

  test("notes prefill still includes hours/contact/submitterEmail even when the submitter left notes blank", () => {
    const values = mapSubmissionPayloadToFormValues(makePayload({ notes: undefined }));
    expect(values.notes).toContain("Mon-Fri 9-5");
    expect(values.notes).toContain("719-555-0100");
    expect(values.notes).toContain("suggester@example.com");
  });

  test("notes prefill omits hours/contact lines entirely when the submitter didn't provide them", () => {
    const values = mapSubmissionPayloadToFormValues(makePayload({ hours: undefined, contact: undefined, notes: undefined }));
    expect(values.notes).not.toContain("Hours:");
    expect(values.notes).not.toContain("Contact:");
    expect(values.notes).toContain("suggester@example.com");
  });

  test("lat/lng are left blank for the admin to geocode", () => {
    const values = mapSubmissionPayloadToFormValues(makePayload());
    expect(values.lat).toBeUndefined();
    expect(values.lng).toBeUndefined();
  });
});
