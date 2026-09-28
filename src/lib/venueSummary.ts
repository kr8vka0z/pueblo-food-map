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
 * buildVenueSummary is called from BOTH sides of the render: the server
 * (JSON-LD description, meta description) AND the client (VenueContent's
 * on-page paragraph, at the page's own current locale). No `new Date()` or
 * client-only Intl anywhere in this file (see formatLastVerifiedMonth) so
 * both call sites — and a test — always produce the identical string for
 * the same venue/locale/options.
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
 *   - The OSM placeholder address ("Address not in OpenStreetMap") never
 *     reaches a summary/title/description — see PLACEHOLDER_ADDRESS below.
 */

import type { DayKey, IrregularSchedule, Venue, WeeklyHours } from "@/types/venue";
import { DISPLAY_DAY_KEYS, formatSlot, slotToIsoTimes } from "@/lib/hours";
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

/**
 * The OSM-import placeholder venue.address stores when OpenStreetMap had no
 * address data. Same literal BottomSheet.tsx and DesktopVenueWindow.tsx
 * already guard against (their own inline `venue.address === "Address not
 * in OpenStreetMap"` checks — no shared exported constant exists yet in
 * this repo to import, so this mirrors their literal rather than inventing
 * a cross-file dependency those two map-card components don't otherwise
 * need). Unlike those two (which fall back to raw lat/lng), a summary
 * sentence drops the address entirely and falls back to the parsed city —
 * "at 38.27, -104.61" reads like a bug in a sentence meant for a human.
 */
export const PLACEHOLDER_ADDRESS = "Address not in OpenStreetMap";

// ─── City parsing (title's "{City}, CO", and the no-address sentence) ──────

/**
 * Parses the city out of a free-text venue address, or null when it can't
 * be confidently separated from the street (or there's no city segment at
 * all). Pure parsing, no locale — a city name is a proper noun, identical
 * in EN and ES. Handles the real shapes seen in published data
 * (venueSummary.test.ts pins each one to a synthetic fixture, never a real
 * venue):
 *   "215 Canal St, Pueblo, CO 81004"       → "Pueblo"
 *   "136 S Purcell Blvd, Pueblo West, CO"  → "Pueblo West"
 *   "1242 S Prairie Ave, Pueblo 81004"     → "Pueblo" (no comma before "CO")
 *   "410 Main Street, Boone"               → "Boone" (no state/zip at all)
 *   "West Carrizo Springs Avenue, CO"      → null (no city segment — the
 *                                             lone non-street part IS "CO")
 *   "Mineral Palace Park"                  → null (a landmark name, not a
 *                                             "street, city" address)
 * `parseVenueCity` (below) wraps this with the `summary.cityFallback`
 * ("Pueblo County") text; venueSchema.ts's JSON-LD `addressLocality` uses
 * this core directly and OMITS the field entirely on null, rather than
 * emitting the fallback prose as if it were a real city name.
 */
export function parseVenueCityCore(address: string): string | null {
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

  return null;
}

/** parseVenueCityCore + the `summary.cityFallback` ("Pueblo County") text
 * for display contexts (title, summary sentence) where SOME city text must
 * always render. JSON-LD's addressLocality uses the core directly instead
 * (see that function's own comment) — a fallback string isn't a real
 * addressLocality value. */
export function parseVenueCity(address: string, locale: Locale = "en"): string {
  return parseVenueCityCore(address) ?? t("summary.cityFallback", locale);
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
 * chars) over every published venue. The second rung uses
 * `summary.title.category.*` (short, natural NOUN phrases written for a
 * title, e.g. "Store" not the filter-chip label "Convenience") rather than
 * the existing `category.*` short labels, which read awkwardly stripped of
 * their filter-chip context ("Corner Store – Convenience in...").
 */
export function buildVenueTitle(venue: Venue, locale: Locale = "en"): string {
  const city = parseVenueCity(venue.address, locale);
  const connector = t("summary.title.in", locale);
  const categoryFull = t(`category.full.${venue.category}`, locale);
  const categoryShort = t(`summary.title.category.${venue.category}`, locale);

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

// ─── Weekly + irregular hours → grouped prose ──────────────────────────────
//
// "Hours: Thursdays, 11am – 2pm." / "Horario: Lun–Vie, 9am – 5pm; Sáb, 10am
// – 2pm." Every day's own slots are sorted by start time and joined with
// "and"/"y" (a venue can have two slots in one day, e.g. a lunch/dinner
// split); day-GROUPS (Mon–Fri vs. a different Saturday schedule) are joined
// with "; ", not a comma — commas inside a single day's slot list and
// commas separating whole days used to read as one ambiguous list.

/** hours.ts has no day-range grouper (its HoursList components render one
 * row per day) — this is a minimal one, scoped to the summary sentence. */
function groupWeeklyHours(
  hours: WeeklyHours,
  locale: Locale,
): { days: DayKey[]; label: string }[] {
  const dayLabels: { day: DayKey; label: string }[] = [];
  for (const day of DISPLAY_DAY_KEYS) {
    const slots = hours[day];
    if (!slots || slots.length === 0) continue;
    // Sort by actual start time (ISO "HH:MM" sorts correctly as a plain
    // string) — Plentiful data sometimes lists a day's slots out of order
    // (e.g. a lunch slot after a breakfast slot), which read as nonsense
    // prose ("10:30am – 12pm, 8:30am – 9:30am") before this sort.
    const sorted = [...slots].sort(
      (a, b) => (slotToIsoTimes(a)?.opens ?? "") .localeCompare(slotToIsoTimes(b)?.opens ?? ""),
    );
    const label = sorted.map((s) => localizedSlot(s, locale)).join(` ${t("summary.and", locale)} `);
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
  return groups;
}

/** formatSlot() (hours.ts) deliberately returns the English literal "Open
 * 24 hours" regardless of page locale (see that function's own comment) —
 * fine for the always-English day/hours panel, but this build-time summary
 * sentence must not leak English into a Spanish page. Swaps only that one
 * literal for a locale-aware key; every other formatSlot output (times) is
 * already locale-agnostic digits/am/pm. Used for BOTH weekly and irregular
 * (monthly) slots. */
function localizedSlot(slot: string, locale: Locale): string {
  const formatted = formatSlot(slot);
  return formatted === "Open 24 hours" ? t("hours.open24", locale) : formatted;
}

/** "{dayPhrase}, {timesLabel}" for one weekly group — e.g. "Thursdays, 11am
 * – 2pm" (1 day), "Monday to Friday, 9am – 5pm" (a range), "every day,
 * 9am – 9pm" (all 7 days). The literal-24-hours + all-7-days combination
 * gets its own fixed phrase ("Open 24 hours, every day") rather than the
 * general template, matching how a person would actually say it. */
function formatWeeklyGroup(group: { days: DayKey[]; label: string }, locale: Locale): string {
  const open24Label = t("hours.open24", locale);
  if (group.days.length === 7 && group.label === open24Label) {
    return t("summary.hours.open24EveryDay", locale);
  }

  let dayPhrase: string;
  if (group.days.length === 7) {
    dayPhrase = t("summary.day.everyDay", locale);
  } else if (group.days.length === 1) {
    dayPhrase = t(`summary.day.${group.days[0]}`, locale);
  } else {
    dayPhrase = t("summary.day.range", locale, {
      start: t(`summary.day.full.${group.days[0]}`, locale),
      end: t(`summary.day.full.${group.days[group.days.length - 1]}`, locale),
    });
  }
  return `${dayPhrase}, ${group.label}`;
}

/** Ordinal word for a monthly_ordinal irregular entry — 1st-5th reuse
 * hours.ts's shared `hours.irregular.ordinal.*` keys (same values, no
 * reason to duplicate them); "last" gets its own SUMMARY-ONLY lowercase key
 * ("last"/"último") since hours.ts's own `hours.irregular.ordinal.last`
 * ("Last"/"Último") is capitalized for its own mid-UI usage (the venue
 * page's separate Hours section, HoursList) — this sentence uses it
 * mid-clause ("...the last Friday of each month"), where a capital reads
 * as a typo. */
function ordinalWord(ordinal: 1 | 2 | 3 | 4 | 5 | "last", locale: Locale): string {
  return ordinal === "last" ? t("summary.ordinal.last", locale) : t(`hours.irregular.ordinal.${ordinal}`, locale);
}

/**
 * One irregular (monthly) schedule entry as summary prose — "the 2nd Friday
 * of each month, 10am – 3:45pm" — using SUMMARY-ONLY keys
 * (`summary.hours.monthlyOrdinal`/`monthlyDate`), never hours.ts's
 * `describeIrregularSchedule` (its `note` field is untrusted admin text —
 * see this file's truth rules — and its own key set is shared with the
 * page's separate Hours section, which this summary sentence deliberately
 * doesn't reuse verbatim). Returns "" for `recurrence: "other"` — no
 * computable date and the only other content (`note`) is untrusted, so
 * there's nothing verified left to say.
 */
function describeIrregularEntry(entry: IrregularSchedule, locale: Locale): string {
  const timesLabel = entry.slots.map((s) => localizedSlot(s, locale)).join(` ${t("summary.and", locale)} `);

  if (entry.recurrence === "monthly_ordinal" && entry.weekday && entry.ordinal) {
    const phrase = t("summary.hours.monthlyOrdinal", locale, {
      ordinal: ordinalWord(entry.ordinal, locale),
      weekdayFull: t(`summary.day.full.${entry.weekday}`, locale),
    });
    return timesLabel ? `${phrase}, ${timesLabel}` : phrase;
  }
  if (entry.recurrence === "monthly_date" && entry.day_of_month) {
    const phrase = t("summary.hours.monthlyDate", locale, { day: String(entry.day_of_month) });
    return timesLabel ? `${phrase}, ${timesLabel}` : phrase;
  }
  return "";
}

/**
 * Hours sentence — weekly and/or irregular groups, all joined with "; " into
 * ONE "Hours: ..."/"Horario: ..." sentence (issue #704 Decisions, item 4—
 * a single gender-neutral prefix works for every category, unlike the old
 * "It's open"/"Está abierto" wording, which had to agree with the "what"
 * phrase's gender). A venue can have both weekly and irregular schedules at
 * once (e.g. Lynn Gardens Baptist Church, #400) — both sets of groups render
 * in the same sentence.
 */
function buildHoursSentence(venue: Venue, locale: Locale): string | null {
  const segments: string[] = [];

  if (venue.hours_weekly) {
    for (const group of groupWeeklyHours(venue.hours_weekly, locale)) {
      segments.push(formatWeeklyGroup(group, locale));
    }
  }

  if (venue.hours_irregular) {
    for (const entry of venue.hours_irregular) {
      const described = describeIrregularEntry(entry, locale);
      if (described) segments.push(described);
    }
  }

  return segments.length > 0 ? t("summary.hours", locale, { schedule: segments.join("; ") }) : null;
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

/** The main "{name} is {what} at {address}."/"...in {city}, CO." sentence —
 * drops the street address (falls back to the parsed city) whenever
 * `includeAddress` is false OR the address is the OSM placeholder (this
 * second case is NOT an option — it's a truth-rule guard, always applied
 * regardless of what the caller asked for). */
function buildMainSentence(venue: Venue, locale: Locale, includeAddress: boolean): string {
  const what = t(`summary.what.${venue.category}`, locale);
  const isPlaceholder = venue.address === PLACEHOLDER_ADDRESS;

  if (!includeAddress || isPlaceholder) {
    const city = parseVenueCity(venue.address, locale);
    return t("summary.mainSentenceNoAddress", locale, { name: venue.name, what, city });
  }
  return t("summary.mainSentence", locale, { name: venue.name, what, address: venue.address });
}

export interface VenueSummaryOptions {
  /** false on the venue page's own on-page paragraph — the street address
   * is already shown in the header just above it (issue #704 review, "the
   * address shown twice at 360px"). Meta description and JSON-LD
   * `description` (the defaults) keep the full address — those are read out
   * of page context (a search result, a JSON-LD consumer), so they need the
   * complete fact. Ignored (address always omitted) when the venue's
   * address is the OSM placeholder — see PLACEHOLDER_ADDRESS. */
  includeAddress?: boolean;
}

/**
 * The answer-first summary — an ordered array of complete sentences
 * (main fact, hours, SNAP/WIC, last verified — any of the latter three
 * omitted when there's nothing verified to say). Callers join with " " for
 * the full on-page paragraph, or use buildVenueMetaDescription for a
 * length-budgeted subset.
 */
export function buildVenueSummary(
  venue: Venue,
  locale: Locale = "en",
  options: VenueSummaryOptions = {},
): string[] {
  const sentences: string[] = [];

  sentences.push(buildMainSentence(venue, locale, options.includeAddress ?? true));

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
 * sentence boundary" — never mid-sentence). A sentence that doesn't fit is
 * SKIPPED, not a hard stop (`continue`, not `break`) — a long hours
 * sentence shouldn't crowd out a short, valuable SNAP/WIC sentence that
 * comes after it and would otherwise still fit. The on-page summary (full
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
    if (candidate.length > maxLen) continue;
    result = candidate;
  }
  if (result) return result;

  // Only reachable if EVERY sentence individually exceeds maxLen — never
  // observed in real venue data (covered by a synthetic fixture test, not a
  // real venue's name/address per this repo's test convention). Trims the
  // first sentence at the last whole word within budget rather than
  // mid-word.
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
