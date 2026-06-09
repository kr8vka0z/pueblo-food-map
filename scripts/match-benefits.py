#!/usr/bin/env python3
"""
One-off: match the OSM grocery/convenience venues against the authoritative
USDA SNAP retailer list and the CDPHE WIC vendor list (both pulled for Pueblo),
by proximity + name, and emit accepts_snap / accepts_wic flags.

Inputs (committed in data/raw/, fetched once via the ArcGIS REST APIs):
  - snap-pueblo-county.json  USDA FNS SNAP Retailer Location data, Pueblo Co, CO
      services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/
      snap_retailer_location_data/FeatureServer/0/query
      ?where=State='CO' AND UPPER(County)='PUEBLO'
  - wic-pueblo.json          CDPHE WIC Vendor Locations, city = Pueblo
      www.cohealthmaps.dphe.state.co.us/arcgis/rest/services/PSD/
      PH_WIC_Map_Service/MapServer/0/query
      ?where=UPPER(City)='PUEBLO'&returnGeometry=true&outSR=4326
  To refresh: re-run those queries, overwrite the files, re-run this script.
Source venues:
  - src/data/grocery-osm.ts  (id, name, category, lat, lng)

Match rule (conservative, to avoid false "accepts SNAP/WIC" claims):
  - SAME-POINT  : a record within 80 m  -> match (OSM node vs official point
                  for the same store).
  - NAME+NEAR   : a record within 250 m that shares a distinctive name token
                  (len >= 4) -> match (same brand at the same plaza).
Otherwise: not flagged.
"""
import json
import re
import math
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."

STOPWORDS = {"the", "store", "market", "food", "foods", "mart", "inc", "llc",
             "co", "of", "and", "shop", "pueblo"}


def norm_tokens(name):
    s = re.sub(r"[^a-z0-9]+", " ", name.lower())
    toks = []
    for t in s.split():
        if t.isdigit():
            continue
        if len(t) < 2:
            continue
        toks.append(t)
    return toks


def distinctive(tokens):
    return {t for t in tokens if len(t) >= 4 and t not in STOPWORDS}


def name_keys(name):
    """Distinctive single tokens + joined adjacent pairs, so hyphen/space
    differences ('WAL-MART' vs 'Walmart') still match."""
    toks = norm_tokens(name)
    keys = set(distinctive(toks))
    for i in range(len(toks) - 1):
        joined = toks[i] + toks[i + 1]
        if len(joined) >= 5 and joined not in STOPWORDS:
            keys.add(joined)
    return keys


def haversine_m(a_lat, a_lng, b_lat, b_lng):
    R = 6371000.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat)
    dl = math.radians(b_lng - a_lng)
    x = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def load_venues(path):
    txt = open(path, encoding="utf-8").read()
    pat = re.compile(
        r'id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*category:\s*"([^"]+)",'
        r'\s*lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)'
    )
    out = []
    for m in pat.finditer(txt):
        out.append({
            "id": m.group(1), "name": m.group(2), "category": m.group(3),
            "lat": float(m.group(4)), "lng": float(m.group(5)),
        })
    return out


def load_snap(path):
    data = json.load(open(path, encoding="utf-8"))
    out = []
    for f in data["features"]:
        a = f["attributes"]
        if a.get("Latitude") is None or a.get("Longitude") is None:
            continue
        out.append({"name": a["Store_Name"], "lat": a["Latitude"],
                    "lng": a["Longitude"], "type": a.get("Store_Type", "")})
    return out


def load_wic(path):
    data = json.load(open(path, encoding="utf-8"))
    out = []
    for f in data["features"]:
        g = f.get("geometry") or {}
        if g.get("y") is None or g.get("x") is None:
            continue
        out.append({"name": f["attributes"]["VendorStoreName"],
                    "lat": g["y"], "lng": g["x"]})
    return out


SAME_POINT_M = 15   # truly identical coords -> same store (covers OSM rebrands)
NAME_NEAR_M = 400   # same brand nearby (big-box lots: official point can be far)


def best_match(v, records):
    vtok = name_keys(v["name"])
    same_point = None
    name_near = None
    for r in records:
        d = haversine_m(v["lat"], v["lng"], r["lat"], r["lng"])
        if d <= SAME_POINT_M and (same_point is None or d < same_point[1]):
            same_point = (r, d)
        if d <= NAME_NEAR_M and vtok & name_keys(r["name"]):
            if name_near is None or d < name_near[1]:
                name_near = (r, d)
    # Prefer a NAME match (same brand) over a bare co-location match, so a
    # store isn't credited for a different neighbour that happens to be close.
    if name_near:
        return name_near[0], name_near[1], "name+near"
    if same_point:
        return same_point[0], same_point[1], "same-point"
    return None, None, None


def main():
    venues = load_venues(f"{ROOT}/src/data/grocery-osm.ts")
    snap = load_snap(f"{ROOT}/data/raw/snap-pueblo-county.json")
    wic = load_wic(f"{ROOT}/data/raw/wic-pueblo.json")
    print(f"venues={len(venues)}  snap={len(snap)}  wic={len(wic)}\n")

    flags = {}
    snap_n = wic_n = 0
    print(f"{'VENUE':32} {'CAT':12} {'SNAP':>5} {'WIC':>4}  match")
    print("-" * 92)
    for v in sorted(venues, key=lambda x: (x["category"], x["name"])):
        sr, sd, sreason = best_match(v, snap)
        wr, wd, wreason = best_match(v, wic)
        snap_ok = sr is not None
        wic_ok = wr is not None
        if snap_ok:
            snap_n += 1
        if wic_ok:
            wic_n += 1
        if snap_ok or wic_ok:
            flags[v["id"]] = {"snap": snap_ok, "wic": wic_ok}
        detail = ""
        if snap_ok:
            detail += f"  SNAP<-{sr['name'][:24]}({sd:.0f}m,{sreason})"
        if wic_ok:
            detail += f"  WIC<-{wr['name'][:20]}({wd:.0f}m)"
        print(f"{v['name'][:32]:32} {v['category'][:12]:12} "
              f"{'YES' if snap_ok else '-':>5} {'YES' if wic_ok else '-':>4} {detail}")

    print("-" * 92)
    print(f"\nSNAP matched: {snap_n}/{len(venues)}   WIC matched: {wic_n}/{len(venues)}")
    print(f"venues with any flag: {len(flags)}")
    # Emit the TS overlay consumed by src/data/venues.ts
    out_ts = f"{ROOT}/src/data/benefit-flags.ts"
    lines = [
        "// Auto-generated by scripts/match-benefits.py — do not edit by hand.",
        "//",
        "// accepts_snap / accepts_wic flags for the OSM grocery/convenience/farm",
        "// venues, matched (by name + location) against authoritative public data:",
        "//   SNAP: USDA FNS SNAP Retailer Location data (Pueblo County, CO)",
        "//   WIC:  CDPHE WIC Vendor Locations (city of Pueblo)",
        "// Only confident matches are flagged (conservative — a benefits tool must",
        "// not over-claim). Re-run the script to refresh; commit the diff.",
        f"//   SNAP: {snap_n} stores   WIC: {wic_n} stores   (of {len(venues)} retailers)",
        "",
        "export const benefitFlags: Record<string, { snap: boolean; wic: boolean }> = {",
    ]
    for vid in sorted(flags):
        f = flags[vid]
        lines.append(f'  "{vid}": {{ snap: {str(f["snap"]).lower()}, '
                     f'wic: {str(f["wic"]).lower()} }},')
    lines.append("};")
    open(out_ts, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"\nwrote {out_ts}  ({len(flags)} venues)")


if __name__ == "__main__":
    main()
