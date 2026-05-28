#!/usr/bin/env python3
"""Reverse-geocode venues with "Address not in OpenStreetMap" in grocery-osm.ts.

Run:  python3 scripts/geocode-osm-missing.py

Nominatim policy: 1 req/sec + descriptive User-Agent.
Fallback: Mapbox Geocoding API (sk token from 1Password).
Last resort: "<lat>, <lng>" coordinate string.

Prints JSON results to stdout:
  { "id": "osm-node-...", "lat": ..., "lng": ..., "address": "...", "source": "nominatim|mapbox|coords" }
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

REPO = Path(__file__).resolve().parents[1]
DATA_FILE = REPO / "src" / "data" / "grocery-osm.ts"

NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse"
MAPBOX_REVERSE = "https://api.mapbox.com/geocoding/v5/mapbox.places"
USER_AGENT = "pueblo-food-map/scrub-osm (kysboyd@gmail.com)"
SLEEP_S = 1.1  # Nominatim: strictly < 1 req/sec


def get_mapbox_token() -> Optional[str]:
    try:
        result = subprocess.run(
            ["op", "read", "op://VPS/Mapbox Access Token - Full Scope/credential"],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except Exception as e:
        print(f"  [warn] Could not get Mapbox token: {e}", file=sys.stderr)
        return None


def nominatim_reverse(lat: float, lng: float) -> Optional[str]:
    params = urllib.parse.urlencode({
        "lat": lat,
        "lon": lng,
        "format": "jsonv2",
        "addressdetails": "1",
    })
    url = f"{NOMINATIM_REVERSE}?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"    [nominatim error] {e}", file=sys.stderr)
        return None

    addr = data.get("address", {})
    if not addr:
        return None

    parts = []
    house = addr.get("house_number", "")
    road = addr.get("road", "")
    if house and road:
        parts.append(f"{house} {road}")
    elif road:
        parts.append(road)

    city = (addr.get("city") or addr.get("town") or addr.get("village")
            or addr.get("suburb") or addr.get("hamlet") or "")
    if city:
        parts.append(city)

    state = addr.get("state", "")
    postcode = addr.get("postcode", "")
    if state:
        parts.append(f"{state} {postcode}".strip() if postcode else state)

    if len(parts) < 2:
        return None
    return ", ".join(parts)


def mapbox_reverse(lat: float, lng: float, token: str) -> Optional[str]:
    url = (
        f"{MAPBOX_REVERSE}/{lng},{lat}.json"
        f"?access_token={token}&types=address&limit=1"
    )
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"    [mapbox error] {e}", file=sys.stderr)
        return None

    features = data.get("features", [])
    if not features:
        return None
    place_name = features[0].get("place_name", "")
    if not place_name:
        return None
    # Strip country suffix
    return re.sub(r",\s*United States$", "", place_name).strip()


def extract_missing_venues(src: str) -> list[dict]:
    """Find all venue blocks with "Address not in OpenStreetMap"."""
    results = []
    # Split into venue blocks by "  }," boundary lines
    # Each block: from "  {" to "  },"
    pattern = re.compile(
        r'\{\s*\n'
        r'(?:[^\{\}]*\n)*?'
        r'[^\{\}]*address:\s*"Address not in OpenStreetMap"'
        r'[^\{\}]*\n(?:[^\{\}]*\n)*?'
        r'\s*\}',
        re.MULTILINE
    )
    for m in pattern.finditer(src):
        block = m.group(0)
        id_m = re.search(r'id:\s*"([^"]+)"', block)
        lat_m = re.search(r'lat:\s*([\d.\-]+)', block)
        lng_m = re.search(r'lng:\s*([\d.\-]+)', block)
        if id_m and lat_m and lng_m:
            results.append({
                "id": id_m.group(1),
                "lat": float(lat_m.group(1)),
                "lng": float(lng_m.group(1)),
            })
    return results


def main():
    src = DATA_FILE.read_text(encoding="utf-8")
    missing = extract_missing_venues(src)
    print(f"Found {len(missing)} venues with missing addresses", file=sys.stderr)

    mapbox_token: Optional[str] = None

    results = []
    for v in missing:
        print(f"  [{v['id']}] ({v['lat']}, {v['lng']}) ...", file=sys.stderr, end=" ")
        time.sleep(SLEEP_S)
        addr = nominatim_reverse(v["lat"], v["lng"])
        source = "nominatim"
        if addr:
            print(f"nominatim: {addr!r}", file=sys.stderr)
        else:
            print("nominatim failed, trying mapbox ...", file=sys.stderr, end=" ")
            if mapbox_token is None:
                mapbox_token = get_mapbox_token()
            if mapbox_token:
                addr = mapbox_reverse(v["lat"], v["lng"], mapbox_token)
                source = "mapbox"
            if addr:
                print(f"mapbox: {addr!r}", file=sys.stderr)
            else:
                addr = f"{v['lat']}, {v['lng']}"
                source = "coords"
                print(f"coord fallback: {addr!r}", file=sys.stderr)

        results.append({
            "id": v["id"],
            "lat": v["lat"],
            "lng": v["lng"],
            "address": addr,
            "source": source,
        })

    print(json.dumps(results, indent=2))

    counts = {"nominatim": 0, "mapbox": 0, "coords": 0}
    for r in results:
        counts[r["source"]] += 1
    print(
        f"\nSummary: Nominatim={counts['nominatim']} Mapbox={counts['mapbox']} CoordFallback={counts['coords']}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
