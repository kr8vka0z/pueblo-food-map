#!/usr/bin/env python3
"""Geocode the 10 Pueblo Food Project venues against Nominatim.

Run from the repo root: `python3 scripts/geocode-pfp.py`.

Reads the hardcoded venue list below (id + display address + ordered query
fallbacks) and writes a structured result file to
`data/raw/pfp-geocodes.json`. A human-readable diff vs the current placeholder
coordinates in `src/data/venues.ts` is printed to stdout so the operator can
sanity-check before applying the new lat/lng values.

Nominatim usage policy compliance:
  * Custom User-Agent with a contact email (required).
  * 1.1s sleep between requests (cap is 1 req/sec absolute max).
  * `viewbox` + `bounded=1` to bias results inside Pueblo County, which is
    essential for fuzzy queries like "1st & Main" that match many cities.
"""

from __future__ import annotations

import json
import math
import pathlib
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from typing import Optional

REPO = pathlib.Path(__file__).resolve().parents[1]
DST = REPO / "data" / "raw" / "pfp-geocodes.json"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "pueblo-food-map/0.1 (kysboyd@gmail.com)"

# Manual overrides for venues Nominatim cannot resolve to a single node. Each
# value is (lat, lng, source_note). The script bypasses the Nominatim call
# entirely for any id in this map and records the override in the output JSON.
MANUAL_OVERRIDES: dict[str, tuple[float, float, str]] = {
    # Ray Aguilera Community Garden is co-located with Ray Aguilera Park but
    # sits at the south end, not at the OSM park centroid (which would be the
    # default Nominatim hit). These coords were supplied by PFP / local
    # knowledge and point to the specific garden plot.
    "garden-ray-aguilera": (
        38.231170,
        -104.625036,
        "Supplied by PFP — specific garden plot location, south of Ray Aguilera Park centroid",
    ),
}

# Pueblo, CO bounding box (~10 mi square around downtown). Nominatim's viewbox
# takes (left, top, right, bottom) = (west_lon, north_lat, east_lon, south_lat).
VIEWBOX = (-104.75, 38.35, -104.48, 38.18)

# Each entry: (id, display_address from venues.ts, [query strings to try in order])
# Where the display address is already a clean street address, the query list
# starts with the address itself. Fuzzy entries (intersections, named places,
# "near X" descriptions) get tailored fallback queries.
ENTRIES: list[tuple[str, str, list[str]]] = [
    (
        "garden-rmser",
        "330 Lake Ave, Pueblo, CO 81004",
        ["330 Lake Avenue, Pueblo, CO 81004", "330 Lake Ave, Pueblo, CO"],
    ),
    (
        "garden-la-familia",
        "814 E 5th St, Pueblo, CO 81001",
        ["814 East 5th Street, Pueblo, CO 81001", "814 E 5th St, Pueblo, CO 81001"],
    ),
    (
        "garden-ray-aguilera",
        "Lake Ave near the Fire Station, Pueblo, CO",
        # PFP's address ("Lake Ave near the Fire Station") is fuzzy, but the
        # garden is co-located with Ray Aguilera Park, which OSM has as a
        # named place node.
        [
            "Ray Aguilera Park, Pueblo, CO",
            "Ray Aguilera, Pueblo, CO",
            "Lake Avenue, Pueblo, CO",
        ],
    ),
    (
        "garden-midway",
        "110 Midway Dr, Pueblo, CO",
        # PFP's CGSP page says "Midway Dr" but OSM (and the street sign on
        # the ground) has it as Midway Avenue, Mesa Junction.
        ["110 Midway Avenue, Pueblo, CO", "Midway Avenue, Mesa Junction, Pueblo, CO"],
    ),
    (
        "garden-steelworks",
        "215 Canal St, Pueblo, CO 81004",
        [
            "215 Canal Street, Pueblo, CO 81004",
            "Steelworks Center of the West, Pueblo, CO",
            "215 Canal St, Pueblo, CO",
        ],
    ),
    (
        "garden-bethany-lutheran",
        "1802 Sheridan Rd, Pueblo, CO 81001",
        [
            "1802 Sheridan Road, Pueblo, CO 81001",
            "Bethany Lutheran Church, Pueblo, CO",
            "1802 Sheridan Rd, Pueblo, CO",
        ],
    ),
    (
        "landscape-mineral-palace",
        "Mineral Palace Park, Pueblo, CO",
        ["Mineral Palace Park, Pueblo, CO", "Mineral Palace Park, Pueblo County, CO"],
    ),
    (
        "landscape-central-plaza",
        "1st & Main, Pueblo, CO",
        [
            "East 1st Street and North Main Street, Pueblo, CO",
            "1st Street and Main Street, Pueblo, CO",
            "Central Plaza, Pueblo, CO",
        ],
    ),
    (
        "landscape-jj-raigoza",
        "600 Maryland Ave, Pueblo, CO",
        [
            "600 Maryland Avenue, Pueblo, CO",
            "JJ Raigoza Park, Pueblo, CO",
            "Maryland Avenue, Pueblo, CO",
        ],
    ),
    (
        "landscape-fuel-iron",
        "400 S Union Ave, Pueblo, CO 81003",
        [
            "400 South Union Avenue, Pueblo, CO 81003",
            "Fuel and Iron Food Hall, Pueblo, CO",
            "400 S Union Ave, Pueblo, CO",
        ],
    ),
]

# Current placeholder coordinates from src/data/venues.ts as of 2026-05-14.
# Used only to print a diff vs the new geocoded values.
CURRENT: dict[str, tuple[float, float]] = {
    "garden-rmser": (38.2790, -104.6068),
    "garden-la-familia": (38.2742, -104.6160),
    # Original placeholder for ray-aguilera kept here for shift_miles diff
    # purposes only; the live override coordinate is in MANUAL_OVERRIDES above.
    "garden-ray-aguilera": (38.2779, -104.6080),
    "garden-midway": (38.2563, -104.6398),
    "garden-steelworks": (38.2614, -104.6125),
    "garden-bethany-lutheran": (38.2459, -104.6354),
    "landscape-mineral-palace": (38.2885, -104.6094),
    "landscape-central-plaza": (38.2722, -104.6105),
    "landscape-jj-raigoza": (38.2697, -104.6309),
    "landscape-fuel-iron": (38.2702, -104.6093),
}


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 3958.7613  # mean Earth radius in miles
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


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
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload[0] if payload else None


def main() -> int:
    results: list[dict] = []
    print(f"Geocoding {len(ENTRIES)} PFP venues against Nominatim (Pueblo viewbox)...")
    print()

    for idx, (vid, display_addr, queries) in enumerate(ENTRIES, start=1):
        cur_lat, cur_lng = CURRENT[vid]

        if vid in MANUAL_OVERRIDES:
            ov_lat, ov_lng, ov_note = MANUAL_OVERRIDES[vid]
            shift = haversine_miles(cur_lat, cur_lng, ov_lat, ov_lng)
            print(
                f"  [{idx:2d}/{len(ENTRIES)}] {vid:30s} "
                f"shift={shift:5.2f}mi  ({ov_lat:.6f}, {ov_lng:.6f}) :: MANUAL OVERRIDE"
            )
            print(f"        note: {ov_note}")
            results.append(
                {
                    "id": vid,
                    "display_address": display_addr,
                    "queries_tried": [],
                    "matched_query": None,
                    "new_lat": round(ov_lat, 6),
                    "new_lng": round(ov_lng, 6),
                    "nominatim_display_name": None,
                    "nominatim_type": "manual_override",
                    "nominatim_importance": None,
                    "nominatim_osm_id": None,
                    "current_lat": cur_lat,
                    "current_lng": cur_lng,
                    "shift_miles": round(shift, 3),
                    "override_note": ov_note,
                }
            )
            continue

        match: Optional[dict] = None
        matched_query: Optional[str] = None
        for q in queries:
            if idx > 1 or q != queries[0]:
                time.sleep(1.1)
            try:
                hit = nominatim_search(q)
            except Exception as e:  # network or parse failure — record and move on
                print(f"  [{vid}] query={q!r} ERROR: {e}", file=sys.stderr)
                continue
            if hit:
                match = hit
                matched_query = q
                break

        if match is None:
            print(f"  [{idx:2d}/{len(ENTRIES)}] {vid}: NO MATCH for any of {queries}")
            results.append(
                {
                    "id": vid,
                    "display_address": display_addr,
                    "queries_tried": queries,
                    "matched_query": None,
                    "new_lat": None,
                    "new_lng": None,
                    "nominatim_display_name": None,
                    "nominatim_type": None,
                    "nominatim_importance": None,
                    "nominatim_osm_id": None,
                    "current_lat": cur_lat,
                    "current_lng": cur_lng,
                    "shift_miles": None,
                }
            )
            continue

        new_lat = round(float(match["lat"]), 6)
        new_lng = round(float(match["lon"]), 6)
        shift = haversine_miles(cur_lat, cur_lng, new_lat, new_lng)
        print(
            f"  [{idx:2d}/{len(ENTRIES)}] {vid:30s} "
            f"shift={shift:5.2f}mi  ({new_lat:.6f}, {new_lng:.6f}) :: "
            f"{match.get('display_name','?')[:80]}"
        )
        print(f"        matched_query: {matched_query!r}")
        results.append(
            {
                "id": vid,
                "display_address": display_addr,
                "queries_tried": queries,
                "matched_query": matched_query,
                "new_lat": new_lat,
                "new_lng": new_lng,
                "nominatim_display_name": match.get("display_name"),
                "nominatim_type": match.get("type"),
                "nominatim_importance": match.get("importance"),
                "nominatim_osm_id": f"{match.get('osm_type')}/{match.get('osm_id')}",
                "current_lat": cur_lat,
                "current_lng": cur_lng,
                "shift_miles": round(shift, 3),
            }
        )

    DST.parent.mkdir(parents=True, exist_ok=True)
    DST.write_text(
        json.dumps(
            {
                "generated_at": str(date.today()),
                "source": "Nominatim (https://nominatim.openstreetmap.org)",
                "viewbox": list(VIEWBOX),
                "results": results,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print()
    print(f"Wrote {DST.relative_to(REPO)}")
    print()
    missing = [r["id"] for r in results if r["new_lat"] is None]
    if missing:
        print(f"WARNING — no match for: {', '.join(missing)}")
    big_shifts = [r for r in results if r["shift_miles"] is not None and r["shift_miles"] > 0.5]
    if big_shifts:
        print(f"NOTE — shifts > 0.5 mi (worth eyeballing on a map):")
        for r in big_shifts:
            print(f"  {r['id']}: {r['shift_miles']} mi  ->  {r['nominatim_display_name']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
