#!/usr/bin/env python3
"""Convert the Overpass grocery dump into src/data/grocery-osm.ts.

Input:  data/raw/pueblo-grocery.json (Overpass `out center` payload — see
        scripts/README.md for the query used)
Output: src/data/grocery-osm.ts

Run from the repo root: `python3 scripts/ingest-osm-grocery.py`.

Filtering rules:
  * Element must have a `name` tag (unnamed nodes are dropped).
  * Element must have coordinates (`lat`/`lon` for nodes, `center.lat`/`center.lon`
    for ways).

Tag mapping:
  shop=supermarket -> category "grocery"
  shop=convenience -> category "convenience"
  shop=farm        -> category "farm"
"""

from __future__ import annotations

import json
import pathlib
import re
from datetime import date

REPO = pathlib.Path(__file__).resolve().parents[1]
SRC = REPO / "data" / "raw" / "pueblo-grocery.json"
DST = REPO / "src" / "data" / "grocery-osm.ts"

CATEGORY = {
    "supermarket": "grocery",
    "convenience": "convenience",
    "farm": "farm",
}


def coords(element: dict) -> tuple[float, float] | None:
    if "lat" in element and "lon" in element:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center")
    if center and "lat" in center and "lon" in center:
        return float(center["lat"]), float(center["lon"])
    return None


def build_address(tags: dict) -> str:
    parts: list[str] = []
    housenumber = tags.get("addr:housenumber")
    street = tags.get("addr:street")
    if housenumber and street:
        parts.append(f"{housenumber} {street}")
    elif street:
        parts.append(street)
    city = tags.get("addr:city")
    state = tags.get("addr:state")
    postcode = tags.get("addr:postcode")
    # Only include locality if we actually know the city; state alone is noise.
    if city:
        locality = f"{city}, {state}" if state else city
        if postcode:
            locality = f"{locality} {postcode}"
        parts.append(locality)
    elif parts and state:
        # Street known, city missing — at least add the state.
        parts.append(state)
    return ", ".join(parts) if parts else "Address not in OpenStreetMap"


def ts_literal(value):
    if value is None:
        return "undefined"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    # string
    escaped = value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    return f'"{escaped}"'


def emit_field(key: str, value, *, optional: bool) -> str | None:
    if optional and value is None:
        return None
    return f"    {key}: {ts_literal(value)},"


_NAME_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    return _NAME_SLUG_RE.sub("-", name.lower()).strip("-")[:40] or "venue"


def main() -> int:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    elements = data.get("elements", [])

    kept: list[dict] = []
    dropped_no_name = 0
    dropped_no_coords = 0
    dropped_unknown_shop = 0

    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            dropped_no_name += 1
            continue
        latlon = coords(el)
        if latlon is None:
            dropped_no_coords += 1
            continue
        shop = tags.get("shop")
        category = CATEGORY.get(shop)
        if category is None:
            dropped_unknown_shop += 1
            continue

        lat, lon = latlon
        osm_id = f"osm-{el['type']}-{el['id']}"
        notes_bits: list[str] = []
        if (oh := tags.get("opening_hours")):
            notes_bits.append(f"Hours (OSM opening_hours): {oh}")
        if (op := tags.get("operator")):
            notes_bits.append(f"Operated by {op}")
        if (note := tags.get("note")):
            notes_bits.append(note)
        notes = " · ".join(notes_bits) if notes_bits else None

        accepts_snap: bool | None = None
        snap_tag = tags.get("payment:snap_ebt")
        if snap_tag == "yes":
            accepts_snap = True
        elif snap_tag == "no":
            accepts_snap = False

        kept.append(
            {
                "id": osm_id,
                "name": name,
                "category": category,
                "lat": round(lat, 6),
                "lng": round(lon, 6),
                "address": build_address(tags),
                "accepts_snap": accepts_snap,
                "phone": tags.get("phone"),
                "url": tags.get("website"),
                "notes": notes,
                "source": f"OpenStreetMap ({el['type']}/{el['id']})",
                "last_verified": str(date.today()),
            }
        )

    # Deterministic order: category then name
    kept.sort(key=lambda v: (v["category"], v["name"].lower()))

    lines: list[str] = []
    lines.append(
        "// Auto-generated from data/raw/pueblo-grocery.json by"
        " scripts/ingest-osm-grocery.py."
    )
    lines.append("// Do not edit by hand — re-run the script and commit the diff.")
    lines.append("//")
    lines.append(f"// Source elements: {len(elements)}")
    lines.append(f"// Kept:            {len(kept)}")
    lines.append(f"// Dropped (no name): {dropped_no_name}")
    lines.append(f"// Dropped (no coords): {dropped_no_coords}")
    lines.append(f"// Dropped (unknown shop tag): {dropped_unknown_shop}")
    lines.append("")
    lines.append('import type { Venue } from "@/types/venue";')
    lines.append("")
    lines.append("export const groceryOsmVenues: Venue[] = [")

    for v in kept:
        lines.append("  {")
        lines.append(f"    id: {ts_literal(v['id'])},")
        lines.append(f"    name: {ts_literal(v['name'])},")
        lines.append(f'    category: "{v["category"]}",')
        lines.append(f"    lat: {v['lat']},")
        lines.append(f"    lng: {v['lng']},")
        lines.append(f"    address: {ts_literal(v['address'])},")
        for key in ("accepts_snap", "phone", "url", "notes"):
            field_line = emit_field(key, v[key], optional=True)
            if field_line is not None:
                lines.append(field_line)
        lines.append(f"    source: {ts_literal(v['source'])},")
        lines.append(f"    last_verified: {ts_literal(v['last_verified'])},")
        lines.append("  },")

    lines.append("];")
    lines.append("")

    DST.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {DST.relative_to(REPO)}")
    print(f"  kept={len(kept)} dropped_no_name={dropped_no_name} dropped_no_coords={dropped_no_coords} dropped_unknown_shop={dropped_unknown_shop}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
