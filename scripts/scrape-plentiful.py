#!/usr/bin/env python3
"""Scrape the Plentiful food pantry directory for Pueblo, CO.

Run from the repo root: `python3 scripts/scrape-plentiful.py`.

What it does:
1. Fetches https://directory.plentiful.org/colorado/pueblo (server-rendered HTML).
2. Parses pantry cards: name, address, phone, detail URL.
3. Dedupes by (name + normalised address).
4. For each unique pantry, fetches the detail page (500ms sleep between requests)
   and extracts hours, SNAP/WIC flags, and notes.
5. Geocodes each address via Nominatim with a 1-req/sec rate limit; caches results
   in data/raw/pueblo-pantries-geocode-cache.json for idempotent re-runs.
6. Writes data/raw/pueblo-pantries.json (full audit trail).
7. Generates src/data/pantries-plentiful.ts (TypeScript module).

Nominatim policy compliance:
  * Custom User-Agent with contact email (required).
  * 1.1s sleep between requests (hard cap: 1 req/sec).
  * viewbox + bounded=1 to bias results inside Pueblo County.

Offline self-check (no network, proves the Hours-card parser against real
saved HTML — run this after any change near _parse_hours_card()):
  `python3 scripts/scrape-plentiful.py --self-check`

Hours parsing, 2026-09-02: Plentiful's detail pages changed shape — the old
regex matched dated upcoming-service lines ("2026-05-14 10:00 AM - 12:00
PM") that no longer appear anywhere; the site now renders a recurring
"Every week" / "Once a month" schedule instead. See _parse_hours_card()'s
own docstring for the measured shape breakdown and AGENTS.md's "Automated
venue-refresh pipeline" section for the guardrail this change added.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Optional

try:
    from bs4 import BeautifulSoup, Tag
except ImportError:
    print("ERROR: beautifulsoup4 not installed. Run: pip install beautifulsoup4", file=sys.stderr)
    raise SystemExit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO = pathlib.Path(__file__).resolve().parents[1]
RAW_DIR = REPO / "data" / "raw"
RAW_JSON = RAW_DIR / "pueblo-pantries.json"
GEOCODE_CACHE = RAW_DIR / "pueblo-pantries-geocode-cache.json"
TS_DST = REPO / "src" / "data" / "pantries-plentiful.ts"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DIRECTORY_URL = "https://directory.plentiful.org/colorado/pueblo"
SOURCE_LABEL = "directory.plentiful.org/colorado/pueblo"
LAST_VERIFIED = "2026-05-14"

# Realistic browser User-Agent (Plentiful may block plain python-urllib)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 "
    "pueblo-food-map/plentiful-ingest (kysboyd@gmail.com)"
)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
GEOCODE_UA = "pueblo-food-map plentiful-ingest (kysboyd@gmail.com)"

# Pueblo, CO bounding box: (west_lon, north_lat, east_lon, south_lat)
VIEWBOX = (-104.78, 38.37, -104.45, 38.16)

DETAIL_SLEEP = 0.5   # seconds between detail-page requests
GEOCODE_SLEEP = 1.1  # seconds between Nominatim requests

# Days for WeeklyHours inference
_DOW_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
_PY_DOW_TO_NAME = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}

# Category override rule: names containing this string -> meal_site
MEAL_SITE_SUBSTRING = "Soup Kitchen"


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def fetch_html(url: str, *, retries: int = 2) -> str:
    """Fetch URL, return HTML string. Raises on HTTP error."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise
            if attempt < retries:
                time.sleep(2)
                continue
            raise
        except urllib.error.URLError:
            if attempt < retries:
                time.sleep(2)
                continue
            raise
    raise RuntimeError(f"Failed to fetch {url}")  # unreachable


# ---------------------------------------------------------------------------
# Directory page parsing
# ---------------------------------------------------------------------------

def parse_directory(html: str) -> list[dict]:
    """Return list of raw card dicts: name, address, phone, url."""
    soup = BeautifulSoup(html, "html.parser")
    entries: list[dict] = []

    # Each pantry appears as an <h3><a href="...">Name</a></h3> followed by
    # sibling elements for address and phone. We iterate all h3 > a links
    # whose href matches the Plentiful pantry URL pattern.
    pattern = re.compile(r"^https://directory\.plentiful\.org/colorado/pueblo/[^/]+$")

    for a_tag in soup.find_all("a", href=pattern):
        name = a_tag.get_text(strip=True)
        if not name:
            continue

        detail_url = a_tag["href"].strip()

        # Walk the parent/siblings to find address and phone. The structure is
        # typically: h3 > a (name), then sibling text nodes or <p> tags with
        # the organisation entity, address, and optional tel: link.
        parent = a_tag.parent  # usually <h3> or <li>
        container = parent.parent if parent else None

        address = ""
        phone = ""

        if container:
            # Collect all text after the h3 within its container
            text_chunks: list[str] = []
            tel_link: Optional[str] = None
            found_header = False
            for child in container.children:
                child_text = child.get_text(strip=True) if hasattr(child, "get_text") else str(child).strip()
                if not found_header:
                    if a_tag in getattr(child, "descendants", []) or child == parent:
                        found_header = True
                    continue
                # After finding the h3, collect sibling content
                if isinstance(child, Tag):
                    tel_anchor = child.find("a", href=re.compile(r"^tel:"))
                    if tel_anchor:
                        tel_link = tel_anchor.get_text(strip=True)
                if child_text and child_text != name:
                    text_chunks.append(child_text)

            # Heuristic: first chunk is often the org entity (repeated name),
            # second chunk is address, tel link is phone.
            filtered = [c for c in text_chunks if c and c != name]
            # Identify address by presence of ", CO "
            addr_candidates = [c for c in filtered if ", CO " in c or "Pueblo" in c]
            if addr_candidates:
                address = addr_candidates[0]
            elif filtered:
                address = filtered[-1]

            if tel_link:
                phone = tel_link

        # Fallback: try to find tel: link anywhere in the immediate block
        if not phone and container and isinstance(container, Tag):
            tel_a = container.find("a", href=re.compile(r"^tel:"))
            if tel_a:
                phone = tel_a.get_text(strip=True)

        entries.append({
            "name": name,
            "address": address,
            "phone": phone,
            "url": detail_url,
        })

    return entries


def normalise_address(addr: str) -> str:
    """Normalise address for deduplication: lowercase, strip punctuation/spaces."""
    addr = addr.lower().strip()
    addr = re.sub(r"[.,#]", "", addr)
    addr = re.sub(r"\s+", " ", addr)
    return addr


def dedupe(entries: list[dict]) -> tuple[list[dict], int]:
    """Dedupe by (name + normalised address). Returns (unique, n_dropped)."""
    seen: set[tuple[str, str]] = set()
    unique: list[dict] = []
    dropped = 0
    for e in entries:
        key = (e["name"].lower().strip(), normalise_address(e["address"]))
        if key in seen:
            dropped += 1
            print(f"  DEDUPE drop: {e['name']!r} @ {e['address']!r}")
            continue
        seen.add(key)
        unique.append(e)
    return unique, dropped


# ---------------------------------------------------------------------------
# Detail page parsing
# ---------------------------------------------------------------------------

# Full weekday name -> WeeklyHours day key, for "Every week" recurrence
# rows (e.g. "Monday", "Monday - Friday"). Only the seven real weekday
# names Plentiful renders — see _expand_weekday_spec()'s own note on why a
# wraparound range ("Friday - Monday") is deliberately not guessed at.
_WEEKDAY_NAME_TO_KEY = {
    "Monday": "mon",
    "Tuesday": "tue",
    "Wednesday": "wed",
    "Thursday": "thu",
    "Friday": "fri",
    "Saturday": "sat",
    "Sunday": "sun",
}


def _expand_weekday_spec(day_spec: str) -> list[str]:
    """
    Expands an "Every week" day-cell into WeeklyHours day keys. Plentiful's
    own two observed shapes (measured 2026-09-02 against every live Pueblo
    detail page): a single day name ("Monday") or a hyphen-separated range
    ("Monday - Friday").

    ponytail: only a forward Mon->Sun range is expanded. A wraparound range
    (e.g. "Friday - Monday") has never been observed live; if Plentiful ever
    renders one, this returns [] (the pair is silently dropped) rather than
    guessing which days it means — a wrong guess here would ship wrong hours
    to a person deciding when to show up. Upgrade path if it ever appears:
    wrap the slice through _DOW_NAMES with modulo indexing.
    """
    parts = [p.strip() for p in day_spec.split("-")]
    if len(parts) == 1:
        key = _WEEKDAY_NAME_TO_KEY.get(parts[0])
        return [key] if key else []
    if len(parts) == 2:
        start_key = _WEEKDAY_NAME_TO_KEY.get(parts[0])
        end_key = _WEEKDAY_NAME_TO_KEY.get(parts[1])
        if not start_key or not end_key:
            return []
        start_i = _DOW_NAMES.index(start_key)
        end_i = _DOW_NAMES.index(end_key)
        if start_i <= end_i:
            return _DOW_NAMES[start_i : end_i + 1]
        return []  # wraparound — not seen live, don't guess (see docstring)
    return []


def _render_recurrence_note(freq: Optional[str], day_spec: str, time_range: str) -> str:
    """
    Renders a NON-weekly recurrence (e.g. "Once a month" / "4th Tuesday") as
    an English sentence for the `notes` field. hours_weekly only models a
    Monday-Sunday weekly grid (src/lib/hours.ts's WeeklyHours shape) — a
    monthly/ordinal recurrence has no structured home there, so it must
    survive in prose instead of being silently dropped (task requirement,
    2026-09-02 Plentiful format-change fix).

    ponytail: a multi-day cell ("2nd Thursday, 4th Thursday") is rendered as
    a literal comma list, not "2nd and 4th Thursday" — correct English
    list-joining is more code than this note's one reader (a human
    reviewing an admin change-proposal) needs.
    """
    # En dash between times to match this app's other hand-written notes
    # prose (e.g. AGENTS.md's own examples) — hours_weekly's stored slot
    # strings keep the plain hyphen Plentiful renders (src/lib/hours.ts's
    # parseSlot() expects that exact " - " separator); this en-dash version
    # is prose-only and never round-trips back into hours_weekly.
    pretty_time = time_range.replace(" - ", " – ")
    if freq == "Once a month":
        return f"Open the {day_spec} of each month, {pretty_time}."
    freq_label = freq or "On a recurring schedule"
    return f"{freq_label}: {day_spec}, {pretty_time}."


def _parse_hours_card(soup: BeautifulSoup) -> tuple[Optional[dict], list[str]]:
    """
    Parses the detail page's "Hours" card, current as of 2026-09-02.

    Superseded design: this function used to regex-match dated upcoming-
    service lines like "2026-05-14 10:00 AM - 12:00 PM" off the page's flat
    text. Measured 2026-09-02 against all 35 live Pueblo detail pages: that
    form appears on ZERO of them (see .git log for the removed regex).
    Plentiful now renders a recurring schedule instead, as real markup:

        <div class="card card--mt">
          <h2>Hours</h2>
          <p class="schedule-freq">Every week</p>
          <table class="hours-table">
            <tr><td>Monday</td><td>4:00 PM - 6:00 PM</td></tr>
          </table>
          <!-- a card can repeat the (freq, table) pair, e.g. a venue with
               BOTH a monthly special AND a weekly recurrence -->
        </div>

    Of the 35 pages measured: 27 have no "Hours" card at all (a real fact,
    not a parse failure — those venues just haven't told Plentiful their
    hours), 4 are "Every week" (this function's `hours_weekly` return), 3
    are "Once a month" + an ordinal weekday ("4th Tuesday") — captured as a
    `recurrence_notes` sentence instead, since WeeklyHours has no slot for
    "the 4th Tuesday" — and 1 has an empty `<table class="hours-table">`
    with no rows at all (the card exists but carries nothing, same as "no
    hours" for parsing purposes). See scripts/fixtures/plentiful/*.html for
    real captured samples of every shape and --self-check below, which
    proves this function against them without a live fetch.

    Returns (hours_weekly, recurrence_notes) — hours_weekly is None when no
    "Every week" row was found (matches _infer_weekly_hours's old contract);
    recurrence_notes is a list of English sentences for every non-weekly row
    found (empty list when there are none).
    """
    hours_h2 = next((h2 for h2 in soup.find_all("h2") if h2.get_text(strip=True) == "Hours"), None)
    if hours_h2 is None:
        return None, []
    card = hours_h2.parent
    if card is None:
        return None, []

    dow_times: dict[str, set[str]] = defaultdict(set)
    recurrence_notes: list[str] = []
    current_freq: Optional[str] = None

    for child in card.find_all(["p", "table"], recursive=False):
        classes = child.get("class") or []
        if child.name == "p" and "schedule-freq" in classes:
            current_freq = child.get_text(strip=True)
            continue
        if child.name == "table" and "hours-table" in classes:
            for tr in child.find_all("tr"):
                cells = tr.find_all("td")
                if len(cells) < 2:
                    continue
                day_spec = cells[0].get_text(strip=True)
                time_range = cells[1].get_text(strip=True)
                if not day_spec or not time_range:
                    continue
                if current_freq == "Every week":
                    for day_key in _expand_weekday_spec(day_spec):
                        dow_times[day_key].add(time_range)
                else:
                    recurrence_notes.append(_render_recurrence_note(current_freq, day_spec, time_range))

    hours_weekly: Optional[dict] = None
    if dow_times:
        hours_weekly = {day: sorted(dow_times[day]) for day in _DOW_NAMES if day in dow_times}

    return hours_weekly, recurrence_notes


def _infer_weekly_hours(html: str) -> Optional[dict]:
    """Thin wrapper over _parse_hours_card() for callers that only need the
    WeeklyHours half — kept as its own function so the name stays stable for
    anything reasoning about this module's history."""
    soup = BeautifulSoup(html, "html.parser")
    hours_weekly, _ = _parse_hours_card(soup)
    return hours_weekly


def parse_detail(html: str) -> dict:
    """Extract hours, SNAP/WIC, notes from a detail page."""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ").lower()

    hours_weekly, recurrence_notes = _parse_hours_card(soup)
    # Whether THIS page's Hours card actually yielded any schedule data —
    # weekly or non-weekly. Distinct from hours_weekly being None: most
    # Pueblo venues (27/35, measured 2026-09-02) legitimately have no Hours
    # card at all, which is real data, not a parse failure. main()'s FATAL
    # guard below tallies this signal, not hours_weekly alone, so it can
    # tell "this venue hasn't told Plentiful its hours" apart from "the
    # parser stopped understanding Plentiful's markup."
    schedule_found = hours_weekly is not None or len(recurrence_notes) > 0

    # SNAP / WIC: look for mentions in page text
    accepts_snap: Optional[bool] = None
    accepts_wic: Optional[bool] = None
    if "snap" in text or "ebt" in text or "food stamp" in text:
        accepts_snap = True
    if "wic" in text:
        accepts_wic = True

    # Notes: pull description meta or first paragraph that looks substantive
    notes: Optional[str] = None
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        candidate = meta_desc["content"].strip()
        if len(candidate) > 20:
            notes = candidate

    # Eligibility keywords
    elig_keywords = ["eligib", "requirement", "must bring", "income", "documentation", "id required"]
    for kw in elig_keywords:
        if kw in text and not notes:
            # Find the surrounding sentence
            sentences = re.split(r"[.!?]", soup.get_text(separator=" "))
            for s in sentences:
                if kw in s.lower() and len(s.strip()) > 10:
                    notes = (notes or "") + s.strip() + "."
                    break

    # A non-weekly recurrence (e.g. "Once a month") has no home in
    # hours_weekly's Monday-Sunday grid — fold it into notes instead of
    # dropping it, so a human reviewing this venue's admin change-proposal
    # still sees when it's actually open. Appended, never replacing the
    # meta-description text above, so both survive.
    if recurrence_notes:
        extra = " ".join(recurrence_notes)
        notes = f"{notes} {extra}".strip() if notes else extra

    return {
        "hours_weekly": hours_weekly,
        "accepts_snap": accepts_snap,
        "accepts_wic": accepts_wic,
        "notes": notes,
        "schedule_found": schedule_found,
    }


# ---------------------------------------------------------------------------
# Geocoding
# ---------------------------------------------------------------------------

def load_geocode_cache() -> dict:
    if GEOCODE_CACHE.exists():
        try:
            return json.loads(GEOCODE_CACHE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_geocode_cache(cache: dict) -> None:
    GEOCODE_CACHE.parent.mkdir(parents=True, exist_ok=True)
    GEOCODE_CACHE.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def nominatim_search(query: str) -> Optional[dict]:
    params = {
        "q": query,
        "format": "jsonv2",
        "limit": 1,
        "viewbox": f"{VIEWBOX[0]},{VIEWBOX[1]},{VIEWBOX[2]},{VIEWBOX[3]}",
        "bounded": 1,
        "addressdetails": 1,
    }
    url = f"{NOMINATIM_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": GEOCODE_UA, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload[0] if payload else None


def geocode_address(address: str, cache: dict, *, first_call: bool = False) -> dict:
    """
    Geocode address via Nominatim; consult cache first.
    Returns dict with lat, lng, matched_query, display_name, osm_id.
    lat/lng are None on failure.
    """
    cache_key = address.strip().lower()
    if cache_key in cache:
        return cache[cache_key]

    # Build query fallbacks: try address as-is, then strip suite (#NNN), then city-biased
    queries = [address]
    # Strip suite/unit suffix (e.g. "#100") which Nominatim can't handle
    clean = re.sub(r"\s*#\s*\w+", "", address).strip()
    if clean != address:
        queries.append(clean)
    if "pueblo" not in address.lower():
        queries.append(address + ", Pueblo, CO")
        if clean != address:
            queries.append(clean + ", Pueblo, CO")

    if not first_call:
        time.sleep(GEOCODE_SLEEP)

    result: dict = {
        "address": address,
        "lat": None,
        "lng": None,
        "matched_query": None,
        "nominatim_display_name": None,
        "nominatim_osm_id": None,
    }

    for i, q in enumerate(queries):
        if i > 0:
            time.sleep(GEOCODE_SLEEP)
        try:
            hit = nominatim_search(q)
        except Exception as exc:
            print(f"    GEOCODE ERROR: {q!r}: {exc}", file=sys.stderr)
            continue
        if hit:
            result["lat"] = round(float(hit["lat"]), 6)
            result["lng"] = round(float(hit["lon"]), 6)
            result["matched_query"] = q
            result["nominatim_display_name"] = hit.get("display_name")
            result["nominatim_osm_id"] = f"{hit.get('osm_type')}/{hit.get('osm_id')}"
            break

    cache[cache_key] = result
    return result


# ---------------------------------------------------------------------------
# ID / slug helpers
# ---------------------------------------------------------------------------

def url_to_id(detail_url: str) -> str:
    """plentiful-<last-url-segment>"""
    slug = detail_url.rstrip("/").rsplit("/", 1)[-1]
    return f"plentiful-{slug}"


# ---------------------------------------------------------------------------
# TypeScript codegen
# ---------------------------------------------------------------------------

def ts_str(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    return f'"{escaped}"'


def ts_literal(value) -> str:
    if value is None:
        return "undefined"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    return ts_str(str(value))


def emit_hours_weekly(hw: dict) -> str:
    """Render a WeeklyHours object as a TS literal."""
    lines = ["{ "]
    parts = []
    for day in _DOW_NAMES:
        if day not in hw:
            continue
        times_ts = ", ".join(ts_str(t) for t in hw[day])
        parts.append(f"{day}: [{times_ts}]")
    lines.append(", ".join(parts))
    lines.append(" }")
    return "".join(lines)


def generate_ts(kept: list[dict], dropped_count: int, geocode_null_count: int) -> str:
    today = LAST_VERIFIED
    lines: list[str] = []
    lines.append(
        "// Auto-generated from data/raw/pueblo-pantries.json by"
        " scripts/scrape-plentiful.py."
    )
    lines.append("// Do not edit by hand — re-run the script and commit the diff.")
    lines.append("//")
    lines.append(f"// Source:  {DIRECTORY_URL}")
    lines.append(f"// Scraped: {today}")
    lines.append(f"// Kept:    {len(kept)}")
    lines.append(f"// Dropped (dedupe): {dropped_count}")
    lines.append(f"// Dropped (geocode null): {geocode_null_count}")
    lines.append("")
    lines.append('import type { Venue } from "@/types/venue";')
    lines.append("")
    lines.append("export const plentifulPantries: Venue[] = [")

    for v in kept:
        lines.append("  {")
        lines.append(f"    id: {ts_str(v['id'])},")
        lines.append(f"    name: {ts_str(v['name'])},")
        lines.append(f'    category: "{v["category"]}",')
        lines.append(f"    lat: {v['lat']},")
        lines.append(f"    lng: {v['lng']},")
        lines.append(f"    address: {ts_str(v['address'])},")
        if v.get("hours_weekly"):
            lines.append(f"    hours_weekly: {emit_hours_weekly(v['hours_weekly'])},")
        if v.get("accepts_snap") is True:
            lines.append("    accepts_snap: true,")
        if v.get("accepts_wic") is True:
            lines.append("    accepts_wic: true,")
        if v.get("phone"):
            lines.append(f"    phone: {ts_str(v['phone'])},")
        if v.get("notes"):
            lines.append(f"    notes: {ts_str(v['notes'])},")
        lines.append(f"    url: {ts_str(v['url'])},")
        lines.append(f"    source: {ts_str(SOURCE_LABEL)},")
        lines.append(f"    last_verified: {ts_str(LAST_VERIFIED)},")
        lines.append("  },")

    lines.append("];")
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Self-check
# ---------------------------------------------------------------------------

FIXTURES_DIR = REPO / "scripts" / "fixtures" / "plentiful"


def _load_fixture(name: str) -> BeautifulSoup:
    html = (FIXTURES_DIR / name).read_text(encoding="utf-8")
    return BeautifulSoup(html, "html.parser")


def _self_check() -> int:
    """
    Offline, assert-based proof that the Hours-card parser above still
    matches Plentiful's real markup. Run via:

        python scripts/scrape-plentiful.py --self-check

    This repo has no Python test runner configured and deliberately doesn't
    get one for one script (ponytail: no new framework/dependency for a
    single file) — this is the ONE runnable command that fails the moment
    Plentiful's Hours-card markup changes again, without needing a live
    fetch or touching D1. Fixtures in scripts/fixtures/plentiful/*.html are
    real HTML captured from live Pueblo detail pages on 2026-09-02 (trimmed
    to <div class="detail-grid">, otherwise byte-for-byte), one per shape
    found when every live page was measured that day — see
    _parse_hours_card()'s own docstring for the full shape breakdown.
    """
    checked = 0

    def check(label: str, fixture: str, expect_hours: Optional[dict], expect_notes: list[str]) -> None:
        nonlocal checked
        soup = _load_fixture(fixture)
        hours, notes = _parse_hours_card(soup)
        assert hours == expect_hours, f"{label}: expected hours_weekly={expect_hours!r}, got {hours!r}"
        assert notes == expect_notes, f"{label}: expected recurrence_notes={expect_notes!r}, got {notes!r}"
        checked += 1
        print(f"  OK  {label}")

    check("weekly (single day)", "weekly.html", {"mon": ["4:00 PM - 6:00 PM"]}, [])
    check(
        "weekday range (Monday - Friday)",
        "weekday_range.html",
        {d: ["8:00 AM - 4:30 PM"] for d in ("mon", "tue", "wed", "thu", "fri")},
        [],
    )
    check(
        "monthly (ordinal weekday, no weekly row)",
        "monthly.html",
        None,
        ["Open the 4th Tuesday of each month, 11:00 AM – 12:00 PM."],
    )
    check(
        "monthly special + weekly recurrence together",
        "weekly_and_monthly.html",
        {"thu": ["11:00 AM - 12:45 PM"]},
        ["Open the 2nd Thursday, 4th Thursday of each month, 11:00 AM – 12:45 PM."],
    )
    check("no Hours card at all", "no_hours_section.html", None, [])
    check("Hours card present but empty (no schedule-freq/table rows)", "empty_hours_heading.html", None, [])

    # _infer_weekly_hours() is a thin wrapper kept for any future caller
    # that only needs the WeeklyHours half — prove it isn't dead code by
    # exercising it against the same fixture bytes _parse_hours_card() uses.
    weekly_html = (FIXTURES_DIR / "weekly.html").read_text(encoding="utf-8")
    wrapper_result = _infer_weekly_hours(weekly_html)
    assert wrapper_result == {"mon": ["4:00 PM - 6:00 PM"]}, f"_infer_weekly_hours wrapper: got {wrapper_result!r}"
    checked += 1
    print("  OK  _infer_weekly_hours() wrapper")

    print(f"\nOK: {checked}/{checked} self-checks passed.")
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape Plentiful pantry directory for Pueblo, CO")
    parser.add_argument(
        "--skip-details",
        action="store_true",
        help="Skip fetching detail pages (faster, no hours/SNAP/WIC data)",
    )
    parser.add_argument(
        "--skip-geocode",
        action="store_true",
        help="Skip Nominatim geocoding (uses cached values only)",
    )
    parser.add_argument(
        "--self-check",
        action="store_true",
        help="Run the offline parser self-check against scripts/fixtures/plentiful/*.html and exit (no network).",
    )
    args = parser.parse_args()

    if args.self_check:
        return _self_check()

    # ---- Step 1: fetch directory listing ----
    print(f"Fetching directory: {DIRECTORY_URL}")
    try:
        dir_html = fetch_html(DIRECTORY_URL)
    except Exception as exc:
        print(f"FATAL: Could not fetch directory page: {exc}", file=sys.stderr)
        return 1

    raw_entries = parse_directory(dir_html)
    print(f"  Parsed {len(raw_entries)} raw cards from directory")

    if not raw_entries:
        print("FATAL: No pantry cards parsed — page structure may have changed.", file=sys.stderr)
        return 1

    # ---- Step 2: dedupe ----
    unique_entries, n_dropped_dedupe = dedupe(raw_entries)
    print(f"  After dedupe: {len(unique_entries)} unique ({n_dropped_dedupe} dropped)")

    # ---- Step 3: fetch detail pages ----
    scrape_timestamp = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    enriched: list[dict] = []
    # Guard tally (see the FATAL check right after this loop): how many
    # detail pages we actually fetched vs. how many yielded ANY schedule
    # data (weekly or non-weekly). A page with no Hours card at all is real
    # data, not a failure (27/35 Pueblo venues, measured 2026-09-02) — this
    # counts only pages whose Hours card, if present, was actually parsed.
    detail_pages_fetched = 0
    detail_pages_with_schedule = 0

    for i, entry in enumerate(unique_entries):
        detail_data: dict = {"hours_weekly": None, "accepts_snap": None, "accepts_wic": None, "notes": None}

        if not args.skip_details:
            if i > 0:
                time.sleep(DETAIL_SLEEP)
            try:
                detail_html = fetch_html(entry["url"])
                detail_pages_fetched += 1
                detail_data = parse_detail(detail_html)
                if detail_data.get("schedule_found"):
                    detail_pages_with_schedule += 1
                hw = detail_data.get("hours_weekly")
                snap = detail_data.get("accepts_snap")
                wic = detail_data.get("accepts_wic")
                print(
                    f"  [{i+1:2d}/{len(unique_entries)}] {entry['name'][:50]:<50s} "
                    f"hours={'yes' if hw else 'no':3s} snap={'Y' if snap else '-'} wic={'Y' if wic else '-'}"
                )
            except urllib.error.HTTPError as exc:
                print(f"  [{i+1:2d}] WARN: detail page HTTP {exc.code} for {entry['url']}", file=sys.stderr)
            except Exception as exc:
                print(f"  [{i+1:2d}] WARN: detail page error for {entry['url']}: {exc}", file=sys.stderr)
        else:
            print(f"  [{i+1:2d}/{len(unique_entries)}] {entry['name'][:60]} (skip details)")

        # Determine category. WHY this is weak (Fix 4 review note): the only
        # signal is "does the directory's own NAME string contain the exact
        # substring 'Soup Kitchen'?" — an admin's hand-corrected category
        # for anything that doesn't literally spell that out (e.g. a combo
        # pantry+meal site, or an org whose real name doesn't say "Soup
        # Kitchen") gets silently proposed back to "pantry" every single
        # run. Fix 3's diff_hash change (scripts/refresh/diffEngine.ts) at
        # least makes an explicit rejection of that proposal STICK now —
        # but the heuristic itself is unchanged and is the real underlying
        # weakness; a durable fix needs a better category signal from
        # Plentiful, not just better rejection memory.
        category = "meal_site" if MEAL_SITE_SUBSTRING in entry["name"] else "pantry"

        enriched.append({
            "id": url_to_id(entry["url"]),
            **entry,
            "category": category,
            "hours_weekly": detail_data.get("hours_weekly"),
            "accepts_snap": detail_data.get("accepts_snap"),
            "accepts_wic": detail_data.get("accepts_wic"),
            "notes": detail_data.get("notes"),
            "scrape_timestamp": scrape_timestamp,
        })

    # Guardrail — same "abort before writing anything, exit non-zero" shape
    # as the directory-page "FATAL: No pantry cards parsed" guard above
    # (AGENTS.md "Automated venue-refresh pipeline" documents this as a
    # scraper PROCESS failure, distinct from the diff-engine's own
    # zero-record/abnormal-drop guardrails — a non-zero exit here throws
    # BEFORE either source reaches the diff engine).
    #
    # WHY this is a proportion (0 successes / N attempts, N >= a floor),
    # not "hours_weekly is ever None" or a raw removal-style percentage:
    # most Pueblo venues legitimately have NO Hours card (27/35 measured
    # 2026-09-02) — a working parser is EXPECTED to return no schedule for
    # most pages, so "some Nones" can never be the signal. The only thing
    # that means "the site's markup changed under us again" is a fetched
    # detail page NEVER ONCE yielding schedule data, across enough pages
    # that coincidence is implausible. The floor exists so a deliberately
    # small run (`--skip-details`, or a future filtered run touching only a
    # couple of venues) can't trip this on sample-size noise alone — with
    # only 7/35 (20%) of real venues carrying any schedule at all, a run of
    # a handful of venues can easily see zero by chance even when parsing
    # works fine.
    HOURS_GUARDRAIL_FLOOR = 5
    if detail_pages_fetched >= HOURS_GUARDRAIL_FLOOR and detail_pages_with_schedule == 0:
        print(
            f"FATAL: 0/{detail_pages_fetched} fetched detail pages yielded any parseable "
            f"Hours data — Plentiful's page format has likely changed again. Refusing to "
            f"write output (would silently ship every venue with hours_weekly=None). Run "
            f"`python {pathlib.Path(__file__).name} --self-check` to confirm the parser "
            f"itself still matches scripts/fixtures/plentiful/*.html; if that still passes, "
            f"capture a fresh detail-page HTML sample and update this parser and its fixtures.",
            file=sys.stderr,
        )
        return 1

    # ---- Step 4: geocode ----
    print(f"\nGeocoding {len(enriched)} addresses via Nominatim...")
    geocache = load_geocode_cache()
    n_geocode_ok = 0
    n_geocode_null = 0

    for i, entry in enumerate(enriched):
        is_first = i == 0
        geo = geocode_address(entry["address"], geocache, first_call=is_first)
        entry["lat"] = geo["lat"]
        entry["lng"] = geo["lng"]
        entry["geocode_matched_query"] = geo["matched_query"]
        entry["geocode_display_name"] = geo["nominatim_display_name"]
        entry["geocode_osm_id"] = geo["nominatim_osm_id"]

        status = "OK" if geo["lat"] is not None else "NULL"
        if geo["lat"] is not None:
            n_geocode_ok += 1
        else:
            n_geocode_null += 1
        print(
            f"  [{i+1:2d}/{len(enriched)}] {status} {entry['name'][:45]:<45s} "
            f"({entry['lat']}, {entry['lng']})"
        )

    if not args.skip_geocode:
        save_geocode_cache(geocache)
        print(f"  Geocode cache saved to {GEOCODE_CACHE.relative_to(REPO)}")

    # ---- Step 5: write raw JSON audit trail ----
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    audit = {
        "generated_at": scrape_timestamp,
        "source": DIRECTORY_URL,
        "total_raw": len(raw_entries),
        "total_unique": len(enriched),
        "dropped_dedupe": n_dropped_dedupe,
        "geocode_ok": n_geocode_ok,
        "geocode_null": n_geocode_null,
        "entries": enriched,
    }
    RAW_JSON.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print(f"\nWrote {RAW_JSON.relative_to(REPO)}")

    # ---- Step 6: codegen ----
    # Only emit entries that have valid coordinates
    ts_entries = [e for e in enriched if e["lat"] is not None and e["lng"] is not None]
    n_ts_dropped = len(enriched) - len(ts_entries)

    if n_ts_dropped > 0:
        dropped_names = [e["name"] for e in enriched if e["lat"] is None]
        print(f"\nSKIPPED from TS (no geocode): {', '.join(dropped_names)}")

    # Sort: category then name
    ts_entries.sort(key=lambda v: (v["category"], v["name"].lower()))

    ts_content = generate_ts(ts_entries, n_dropped_dedupe + n_ts_dropped, n_ts_dropped)
    TS_DST.parent.mkdir(parents=True, exist_ok=True)
    TS_DST.write_text(ts_content, encoding="utf-8")
    print(f"Wrote {TS_DST.relative_to(REPO)}")

    # ---- Summary ----
    meal_sites = sum(1 for e in ts_entries if e["category"] == "meal_site")
    pantries = sum(1 for e in ts_entries if e["category"] == "pantry")
    print(f"\nSummary:")
    print(f"  Raw cards parsed:     {len(raw_entries)}")
    print(f"  Dropped (dedupe):     {n_dropped_dedupe}")
    print(f"  Unique after dedupe:  {len(enriched)}")
    print(f"  Geocode OK:           {n_geocode_ok}")
    print(f"  Geocode NULL:         {n_geocode_null}")
    print(f"  Dropped (null geo):   {n_ts_dropped}")
    print(f"  Emitted to TS:        {len(ts_entries)}")
    print(f"    pantry:             {pantries}")
    print(f"    meal_site:          {meal_sites}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
