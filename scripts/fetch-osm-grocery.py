#!/usr/bin/env python3
"""Fetch fresh grocery/convenience/farm data from the Overpass API and write
data/raw/pueblo-grocery.json — the exact input scripts/ingest-osm-grocery.py
already expects (see that script's own header comment).

WHY this script exists (a real gap, found while wiring the automated refresh
pipeline): scripts/ingest-osm-grocery.py has never itself talked to
Overpass — it only CONVERTS an already-downloaded dump. Its header comment
points at "scripts/README.md for the query used," but no such file exists in
this repo; the original data/raw/pueblo-grocery.json was fetched by hand,
once, and the query was never committed. Automating "re-run the OSM
scraper" needed an actual fetcher, so this is new, narrowly-scoped work —
NOT a rewrite of ingest-osm-grocery.py, which is reused completely as-is.

Run from the repo root: `python3 scripts/fetch-osm-grocery.py`.
Then: `python3 scripts/ingest-osm-grocery.py` (unmodified) to convert the
freshly-written data/raw/pueblo-grocery.json into src/data/grocery-osm.ts.

The query mirrors ingest-osm-grocery.py's own tag mapping exactly (shop=
supermarket/convenience/farm) so every element that script's CATEGORY dict
would keep is actually present in the fetch.
"""

from __future__ import annotations

import json
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

REPO = pathlib.Path(__file__).resolve().parents[1]
DST = REPO / "data" / "raw" / "pueblo-grocery.json"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Bounding box: must match src/data/pueblo-bbox.ts's PUEBLO_COUNTY_BBOX.
# Duplicated here (TS constant, Python fetcher) rather than shared, since
# there is no cross-language config file in this repo and the county
# boundary changes essentially never — flagged so a future PUEBLO_COUNTY_BBOX
# edit remembers to update this literal too.
# PUEBLO_COUNTY_BBOX = [[lngWest, latSouth], [lngEast, latNorth]]
#                     = [[-105.1107, 37.6747], [-103.9939, 38.5824]]
# Overpass bbox filter order is (south,west,north,east).
BBOX = "37.6747,-105.1107,38.5824,-103.9939"

# Same three shop= tags scripts/ingest-osm-grocery.py's CATEGORY dict maps —
# any element Overpass returns outside this set would just be dropped by
# that script's `dropped_unknown_shop` counter, so there's no reason to ask
# Overpass for anything wider.
SHOP_TAGS = ["supermarket", "convenience", "farm"]

USER_AGENT = "pueblo-food-map/osm-grocery-fetch (kysboyd@gmail.com)"


def build_query() -> str:
    clauses = []
    for tag in SHOP_TAGS:
        clauses.append(f'  node["shop"="{tag}"]({BBOX});')
        clauses.append(f'  way["shop"="{tag}"]({BBOX});')
    body = "\n".join(clauses)
    return f"[out:json][timeout:60];\n(\n{body}\n);\nout center;\n"


def fetch_overpass(query: str) -> dict:
    data = f"data={urllib.parse.quote(query)}".encode("ascii")  # type: ignore[name-defined]
    req = urllib.request.Request(
        OVERPASS_URL,
        data=data,
        headers={"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    query = build_query()
    print("Querying Overpass API for Pueblo County grocery/convenience/farm nodes+ways...")
    try:
        payload = fetch_overpass(query)
    except urllib.error.URLError as exc:
        print(f"FATAL: Overpass request failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"FATAL: Overpass request failed: {exc}", file=sys.stderr)
        return 1

    elements = payload.get("elements", [])
    print(f"  Received {len(elements)} elements")
    if not elements:
        # Not fatal here — scripts/refresh-ingest.ts's own zero-record
        # guardrail is what decides whether an empty scrape is safe to act
        # on. This fetcher's job is just "get what Overpass has right now,"
        # honestly, even if that's nothing.
        print("  WARNING: Overpass returned zero elements for this query.", file=sys.stderr)

    DST.parent.mkdir(parents=True, exist_ok=True)
    DST.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {DST.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
