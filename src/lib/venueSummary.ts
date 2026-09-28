/**
 * Answer-first content for a venue page — SEO/AEO plan Phase 2 (#704).
 *
 * WHY a separate file from venueSchema.ts: this module is pure text/data
 * assembly (summary sentences, the <title> ladder, the nearest-N-same-
 * category list) with its own truth rules and length budgets, all unit
 * tested independently of JSON-LD shape. venueSchema.ts imports from here
 * (buildVenueSummary → JSON-LD `description`; buildVenueTitle/
 * buildVenueMetaDescription → `venuePageMetadataFields`) rather than the
 * reverse, so this file has no dependency on schema.org concerns.
 *
 * Truth rules (Kyle, issue #704 "Decisions" — each is a test in
 * venueSummary.test.ts):
 *   - "Free" wording appears ONLY for the 4 categories in FREE_CATEGORIES.
 *   - SNAP/WIC are mentioned only when accepts_snap/accepts_wic === true —
 *     false or undefined is silent, never "does not accept".
 *   - No eligibility, ID, income, or immigration claims, ever.
 *   - Hours come only from hours_weekly/hours_irregular; no hours data means
 *     no hours sentence (never "hours unknown" in the summary — the page's
 *     own Hours section already covers that case).
 *   - hours_irregular's free-text `note` field is admin-written, unverified
 *     prose — deliberately never read here (see buildHoursSentence below).
 *
 * Everything here is build-time only (no `new Date()`, no client-only
 * Intl month names — see formatLastVerifiedMonth) so a venue's summary is
 * identical on the server-rendered page and JSON-LD, and reproducible in a
 * test.
 */

import type { DayKey, Venue, WeeklyHours } from "@/types/venue";
import { DISPLAY_DAY_KEYS, describeIrregularSchedule, formatSlot } from "@/lib/hours";
import { haversineMiles } from "@/lib/distance";
import { t, type Locale } from "@/lib/i18n";
import { SITE_NAME } from "@/lib/site";

/**
 * Categories the summary and JSON-LD's `isAccessibleForFree` both call
 * "free" (issue #704 Decisions). Single source of truth shared by
 * buildVenueSummary (via summary.what.* keys, below) and venueSchema.ts.
 */
export const FREE_CATEGORIES: ReadonlySet<Venue["category"]> = new Set([
  "pantry",
  "meal_site",
  "garden",
  "edible_landscape",
]);

// ─── City parsing (title's "{City}, CO") ───────────────────────────────────

/**
 * Parses the city out of a free-text venue address. Handles the real shapes
 * seen in published data (venueSummary.test.ts pins each one to a synthetic
 * fixture, never a real venue):
 *   "215 Canal St, Pueblo, CO 81004"       → "Pueblo"
 *   "136 S Purcell Blvd, Pueblo West, CO"  → "Pueblo West"
 *   "1242 S Prairie Ave, Pueblo 81004"     → "Pueblo" (no comma before "CO")
 *   "410 Main Street, Boone"               → "Boone" (no state/zip at all)
 *   "West Carrizo Springs Avenue, CO"      → fallback (no city segment — the
 *                                             lone non-street part IS "CO")
 *   "Mineral Palace Park"                  → fallback (a landmark name, not
 *                                             a "street, city" address)
 * Falls back to `summary.cityFallback` ("Pueblo County") whenever the city
 * can't be confidently separated from the street or from "CO" itself.
 */
export function parseVenueCity(address: string, locale: Locale = "en"): string {
  const parts = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // "CO" or "CO 81004" as its own segment — the city is the segment right
  // before it, but only when there's also a street segment before THAT
  // (stateIdx > 1), so "West Carrizo Springs Avenue, CO" (no city at all)
  // doesn't misread its own street name as the city.
  const stateIdx = parts.findIndex((p) => /^CO(\s+\d{5}(-\d{4})?)?$/.test(p));
  if (stateIdx > 1) {
    const city = parts[stateIdx - 1];
    if (city) return city;
  }

  // No "CO" segment at all — the last segment is either "City zip" or a
  // bare city name, but only when there's a street segment before it
  // (parts.length >= 2); a single-segment address is a landmark name, not
  // "street, city".
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const cityZip = last.match(/^([A-Za-z][A-Za-z .]*?)\s+\d{5}(-\d{4})?$/);
    if (cityZip) return cityZip[1].trim();
    if (/^[A-Za-z][A-Za-z .]*$/.test(last) && last.toUpperCase() !== "CO") {
      return last;
    }
  }

  return t("summary.cityFallback", locale);
}

// ─── Title: "{Name} – {category phrase} in {City}, CO" ─────────────────────

const MAX_TITLE_LENGTH = 70;
/** Matches layout.tsx's `title.template` ("%s · Pueblo Food Map") — the
 * suffix Next.js appends to whatever this function returns. */
const BRAND_SUFFIX = ` · ${SITE_NAME}`;

/**
 * Builds the short title venuePageMetadataFields hands to buildPageMetadata
 * (which the root layout's title.template then appends " · Pueblo Food Map"
 * to). Shortens the category phrase, in order, before ever touching the
 * venue's own name (issue #704 Decisions: "never truncate the name") —
 * venueSummary.test.ts checks this ladder holds (full rendered <title> ≤ 70
 * chars) over every published venue.
 */
export function buildVenueTitle(venue: Venue, locale: Locale = "en"): string {
  const city = parseVenueCity(venue.address, locale);
  const connector = t("summary.title.in", locale);
  const categoryFull = t(`category.full.${venue.category}`, locale);
  const categoryShort = t(`category.${venue.category}`, locale);

  const candidates = [
    `${venue.name} – ${categoryFull} ${connector} ${city}, CO`,
    `${venue.name} – ${categoryShort} ${connector} ${city}, CO`,
    `${venue.name} ${connector} ${city}, CO`,
    venue.name,
  ];

  for (const candidate of candidates) {
    if (candidate.length + BRAND_SUFFIX.length <= MAX_TITLE_LENGTH) return candidate;
  }
  return venue.name; // last resort — never truncated
}

// ─── Weekly hours → grouped prose ("Mon–Fri, 9am – 5pm") ───────────────────

/** hours.ts has no day-range grouper (its HoursList components render one
 * row per day) — this is a minimal one, scoped to the summary sentence. */
function groupWeeklyHours(hours: WeeklyHours, locale: Locale): string[] {
  const dayLabels: { day: DayKey; label: string }[] = [];
  for (const day of DISPLAY_DAY_KEYS) {
    const slots = hours[day];
    if (!slots || slots.length === 0) continue;
    const label = slots.map((s) => localizedSlot(s, locale)).join(", ");
    dayLabels.push({ day, label });
  }

  const groups: { days: DayKey[]; label: string }[] = [];
  for (const entry of dayLabels) {
    const last = groups[groups.length - 1];
    const prevDay = last?.days[last.days.length - 1];
    const isConsecutive =
      prevDay !== undefined &&
      DISPLAY_DAY_KEYS.indexOf(entry.day) === DISPLAY_DAY_KEYS.indexOf(prevDay) + 1;
    if (last && last.label === entry.label && isConsecutive) {
      last.days.push(entry.day);
    } else {
      groups.push({ days: [entry.day], label: entry.label });
    }
  }

  return groups.map((group) => {
    const first = t(`day.${group.days[0]}`, locale);
    const dayLabel =
      group.days.length > 1
        ? `${first}–${t(`day.${group.days[group.days.length - 1]}`, locale)}`
        : first;
    return `${dayLabel}, ${group.label}`;
  });
}

/** formatSlot() (hours.ts) deliberately returns the English literal "Open
 * 24 hours" regardless of page locale (see that function's own comment) —
 * fine for the always-English day/hours panel, but this build-time summary
 * sentence must not leak English into a Spanish page. Swaps only that one
 * literal for a locale-aware key; every other formatSlot output (times) is
 * already locale-agnostic digits/am/pm. */
function localizedSlot(slot: string, locale: Locale): string {
  const formatted = formatSlot(slot);
  return formatted === "Open 24 hours" ? t("hours.open24", locale) : formatted;
}

function joinWithAnd(parts: string[], locale: Locale): string {
  if (parts.length <= 1) return parts.join("");
  const and = t("summary.and", locale);
  return `${parts.slice(0, -1).join(", ")} ${and} ${parts[parts.length - 1]}`;
}

/**
 * Hours sentence(s) — weekly (grouped) and/or irregular (rule prose, never
 * the resolved "next occurrence" date, since this is a static build-time
 * page — same constraint VenueContent's own hours section already
 * documents). A venue can have both (e.g. Lynn Gardens Baptist Church,
 * #400) — both sentences render, one after the other.
 */
function buildHoursSentence(venue: Venue, locale: Locale): string | null {
  const parts: string[] = [];

  if (venue.hours_weekly) {
    const groups = groupWeeklyHours(venue.hours_weekly, locale);
    if (groups.length > 0) {
      parts.push(t("summary.hoursWeekly", locale, { schedule: joinWithAnd(groups, locale) }));
    }
  }

  if (venue.hours_irregular && venue.hours_irregular.length > 0) {
    // `note` is free admin text, never verified for this build-time summary
    // (truth rule) — stripped before describeIrregularSchedule can append it.
    const described = venue.hours_irregular
      .map((entry) => describeIrregularSchedule({ ...entry, note: undefined }, locale, t))
      .filter((s) => s.length > 0)
      .join("; ");
    if (described) {
      parts.push(t("summary.hoursIrregular", locale, { schedule: described }));
    }
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

/** SNAP/WIC sentence — issue #704 truth rule: `=== true` only, never a
 * "does not accept" claim when the field is false or missing. */
function buildSnapWicSentence(venue: Venue, locale: Locale): string | null {
  if (venue.accepts_snap === true && venue.accepts_wic === true) {
    return t("summary.snapAndWic", locale);
  }
  if (venue.accepts_snap === true) return t("summary.snap", locale);
  if (venue.accepts_wic === true) return t("summary.wic", locale);
  return null;
}

/** Parses "YYYY-MM-DD" (the only shape last_verified is stored in) into a
 * "Month YYYY" string via 12 `month.N` i18n keys — never Intl, so the
 * client-rendered body (VenueContent) and the server-rendered JSON-LD
 * description can never hydration-mismatch on locale-dependent month names
 * (issue #704 Decisions, item 4). Falls back to null (sentence omitted) on
 * any unexpected shape rather than guessing. */
function formatLastVerifiedMonth(raw: string, locale: Locale): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(raw);
  if (!match) return null;
  const monthNum = Number(match[2]);
  if (monthNum < 1 || monthNum > 12) return null;
  return `${t(`month.${monthNum}`, locale)} ${match[1]}`;
}

function buildLastVerifiedSentence(venue: Venue, locale: Locale): string | null {
  const month = formatLastVerifiedMonth(venue.last_verified, locale);
  return month ? t("summary.lastVerified", locale, { month }) : null;
}

/**
 * The answer-first summary — an ordered array of complete sentences
 * (main fact, hours, SNAP/WIC, last verified — any of the latter three
 * omitted when there's nothing verified to say). Callers join with " " for
 * the full on-page paragraph, or use buildVenueMetaDescription for a
 * length-budgeted subset.
 */
export function buildVenueSummary(venue: Venue, locale: Locale = "en"): string[] {
  const sentences: string[] = [];

  const what = t(`summary.what.${venue.category}`, locale);
  sentences.push(
    t("summary.mainSentence", locale, { name: venue.name, what, address: venue.address }),
  );

  const hoursSentence = buildHoursSentence(venue, locale);
  if (hoursSentence) sentences.push(hoursSentence);

  const snapWicSentence = buildSnapWicSentence(venue, locale);
  if (snapWicSentence) sentences.push(snapWicSentence);

  const lastVerifiedSentence = buildLastVerifiedSentence(venue, locale);
  if (lastVerifiedSentence) sentences.push(lastVerifiedSentence);

  return sentences;
}

/**
 * The meta description / JSON-LD description budget: whole sentences only,
 * accumulated while the running total stays ≤ maxLen (issue #704: "cut at a
 * sentence boundary" — never mid-sentence). The on-page summary (full
 * buildVenueSummary join) may run longer; only this budgeted form feeds
 * <meta description> and JSON-LD `description`.
 */
export function buildVenueMetaDescription(
  venue: Venue,
  locale: Locale = "en",
  maxLen = 160,
): string {
  const sentences = buildVenueSummary(venue, locale);
  let result = "";
  for (const sentence of sentences) {
    const candidate = result ? `${result} ${sentence}` : sentence;
    if (candidate.length > maxLen) break;
    result = candidate;
  }
  if (result) return result;

  // Only reachable if the FIRST sentence alone exceeds maxLen — never
  // observed in real venue data (covered by a synthetic fixture test, not a
  // real venue's name/address per this repo's test convention). Trims at
  // the last whole word within budget rather than mid-word.
  const first = sentences[0] ?? "";
  return first.length <= maxLen ? first : first.slice(0, maxLen).replace(/\s+\S*$/, "");
}

// ─── Nearby (same-category, nearest N) ──────────────────────────────────────

export interface NearbyVenue {
  id: string;
  name: string;
  distanceMiles: number;
}

/**
 * The 3–5 nearest published venues in the SAME category (issue #704
 * Decisions) — computed on the server page (needs the whole venue list) and
 * passed down as a prop, never fetched or computed client-side, so the
 * feature adds zero client JS. Returns fewer than 5 (down to 0) when fewer
 * same-category venues exist; callers omit the "Nearby" block entirely on 0.
 */
export function nearbyVenues(venue: Venue, all: Venue[], max = 5): NearbyVenue[] {
  return all
    .filter((v) => v.id !== venue.id && v.category === venue.category)
    .map((v) => ({ id: v.id, name: v.name, distanceMiles: haversineMiles(venue, v) }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, max);
}
