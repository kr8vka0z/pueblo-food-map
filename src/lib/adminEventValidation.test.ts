// @vitest-environment node
/**
 * Validation rules for the admin events routes (src/lib/adminEventValidation.ts).
 * Only rules that guard stored/public data: required fields, end-after-start,
 * place, link safety, cancel note, length caps, and Pueblo-time conversion.
 */

import { describe, expect, test } from "vitest";
import { validateEventPayload } from "@/lib/adminEventValidation";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

const SAVE = ["save", "publish", "cancel"] as const;

function valid(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: "save",
    name: "Turkey drive",
    starts_at_local: "2026-11-21T10:00",
    ends_at_local: "2026-11-21T14:00",
    address: "123 Main St, Pueblo, CO",
    lat: 38.25,
    lng: -104.6,
    ...over,
  };
}

function errorsOf(body: unknown, actions: readonly string[] = SAVE) {
  const result = validateEventPayload(body, actions);
  if (result.ok) throw new Error("expected validation to fail");
  return result.errors;
}

describe("validateEventPayload", () => {
  test("accepts a minimal event and stores Pueblo times as UTC", () => {
    const result = validateEventPayload(valid(), SAVE);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.fields.startsAt).toBe("2026-11-21T17:00:00.000Z"); // MST
    expect(result.fields.endsAt).toBe("2026-11-21T21:00:00.000Z");
    expect(result.fields.venueId).toBeNull();
    expect(result.action).toBe("save");
  });

  test("missing name is named next to the name field", () => {
    expect(errorsOf(valid({ name: "   " })).name).toBeTruthy();
  });

  test("end before start, and end equal to start, are both rejected on the end field", () => {
    expect(errorsOf(valid({ ends_at_local: "2026-11-21T09:00" })).ends_at).toBeTruthy();
    expect(errorsOf(valid({ ends_at_local: "2026-11-21T10:00" })).ends_at).toBeTruthy();
  });

  test("end-after-start is judged on real instants across a DST change", () => {
    // Spring forward: 01:30 MST -> 03:30 MDT is only one real hour apart but is still a valid, later end.
    const ok = validateEventPayload(valid({ starts_at_local: "2026-03-08T01:30", ends_at_local: "2026-03-08T03:30" }), SAVE);
    if (!ok.ok) throw new Error(JSON.stringify(ok.errors));
    expect(Date.parse(ok.fields.endsAt) - Date.parse(ok.fields.startsAt)).toBe(3_600_000);
  });

  test("a start time inside the skipped spring-forward hour is rejected", () => {
    expect(errorsOf(valid({ starts_at_local: "2026-03-08T02:30", ends_at_local: "2026-03-08T04:00" })).starts_at).toBeTruthy();
  });

  test("missing start or end is rejected", () => {
    expect(errorsOf(valid({ starts_at_local: "" })).starts_at).toBeTruthy();
    expect(errorsOf(valid({ ends_at_local: undefined })).ends_at).toBeTruthy();
  });

  test("missing place: no address and no coordinates", () => {
    expect(errorsOf(valid({ address: "", lat: undefined, lng: undefined })).place).toBeTruthy();
  });

  test("an address that was never located (no coordinates) is a place error, not accepted", () => {
    expect(errorsOf(valid({ lat: undefined, lng: undefined })).place).toBeTruthy();
  });

  test("coordinates must be real numbers in range, never numeric strings", () => {
    expect(errorsOf(valid({ lat: "38.25" })).place).toBeTruthy();
    expect(errorsOf(valid({ lng: -181 })).place).toBeTruthy();
  });

  test("a place picked from an existing venue carries its id through", () => {
    const result = validateEventPayload(valid({ venue_id: "garden-abc" }), SAVE);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.fields.venueId).toBe("garden-abc");
  });

  test("link must be an http(s) URL — a javascript: link would ship into a public href", () => {
    expect(errorsOf(valid({ link_url: "javascript:alert(1)" })).link_url).toBeTruthy();
    expect(errorsOf(valid({ link_url: "not a url" })).link_url).toBeTruthy();
    const ok = validateEventPayload(valid({ link_url: "https://example.org/event" }), SAVE);
    expect(ok.ok).toBe(true);
  });

  test("cancelling requires a note; saving or publishing does not", () => {
    expect(errorsOf(valid({ action: "cancel" })).cancel_note).toBeTruthy();
    expect(errorsOf(valid({ action: "cancel", cancel_note: "  " })).cancel_note).toBeTruthy();
    expect(validateEventPayload(valid({ action: "cancel", cancel_note: "Snowed out" }), SAVE).ok).toBe(true);
    expect(validateEventPayload(valid({ action: "publish" }), SAVE).ok).toBe(true);
  });

  test("an action the route does not allow is rejected", () => {
    expect(errorsOf(valid({ action: "cancel" }), ["save_draft", "publish"] as const)._form).toBeTruthy();
    expect(errorsOf(valid({ action: undefined }))._form).toBeTruthy();
  });

  test("length caps hold, English and Spanish alike", () => {
    expect(errorsOf(valid({ name: "x".repeat(FIELD_LIMITS.SUGGEST_VENUE_NAME + 1) })).name).toBeTruthy();
    expect(errorsOf(valid({ name_es: "x".repeat(FIELD_LIMITS.SUGGEST_VENUE_NAME + 1) })).name_es).toBeTruthy();
    expect(errorsOf(valid({ description: "x".repeat(FIELD_LIMITS.SUGGEST_NOTES + 1) })).description).toBeTruthy();
  });

  test("blank Spanish fields are stored as null so the public layer falls back to English", () => {
    const result = validateEventPayload(valid({ name_es: "  ", host_es: "" }), SAVE);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.fields.nameEs).toBeNull();
    expect(result.fields.hostEs).toBeNull();
  });

  test("a non-object body is rejected", () => {
    expect(errorsOf(null)._form).toBeTruthy();
    expect(errorsOf([])._form).toBeTruthy();
  });
});
