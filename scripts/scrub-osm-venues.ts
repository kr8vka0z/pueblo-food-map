#!/usr/bin/env npx tsx
/**
 * scrub-osm-venues.ts — one-off script to:
 *   1. Parse "Hours (OSM opening_hours): ..." notes → hours_weekly + clean notes.
 *   2. Reverse-geocode venues with "Address not in OpenStreetMap".
 *
 * Run:  npx tsx scripts/scrub-osm-venues.ts
 *
 * Geocoding priority:
 *   1. Nominatim reverse geocoding (free, no auth; 1 req/sec limit)
 *   2. Mapbox geocoding (sk token from 1Password via `op` CLI)
 *   3. Coordinate fallback: "<lat>, <lng>"
 *
 * Nominatim usage policy: descriptive User-Agent + 1.1s inter-request sleep.
 * Output: prints the updated grocery-osm.ts contents to stdout.
 *         Redirect to src/data/grocery-osm.ts to apply.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DATA_FILE = join(REPO_ROOT, "src", "data", "grocery-osm.ts");

// ─── Nominatim ────────────────────────────────────────────────────────────────

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "pueblo-food-map/scrub-osm-venues (kysboyd@gmail.com)";
const NOMINATIM_DELAY_MS = 1100; // >1 req/sec policy

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

interface NominatimResult {
  display_name?: string;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
}

async function reverseGeoNominatim(
  lat: number,
  lng: number
): Promise<string | null> {
  const url =
    `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=jsonv2`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResult;
    if (!data.address) return null;
    const a = data.address;
    // Build a US-style street address
    const parts: string[] = [];
    if (a.house_number && a.road) {
      parts.push(`${a.house_number} ${a.road}`);
    } else if (a.road) {
      parts.push(a.road);
    }
    const city = a.city ?? a.town ?? a.village ?? a.suburb;
    if (city) parts.push(city);
    if (a.state) {
      const stateStr = a.postcode ? `${a.state} ${a.postcode}` : a.state;
      parts.push(stateStr);
    }
    if (parts.length < 2) return null; // too sparse
    return parts.join(", ");
  } catch {
    return null;
  }
}

// ─── Mapbox ──────────────────────────────────────────────────────────────────

function getMapboxToken(): string {
  // Read the resolved token from the environment. Do NOT hardcode a 1Password
  // reference here -- this repo is public. Provide the sk token via a gitignored
  // .env.local (see OPS-SECRETS.local.md) and run through:
  //   op run --env-file=.env.local -- npx tsx scripts/scrub-osm-venues.ts
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    throw new Error(
      "MAPBOX_TOKEN not set. Run via: op run --env-file=.env.local -- npx tsx scripts/scrub-osm-venues.ts"
    );
  }
  return token.trim();
}

async function reverseGeoMapbox(
  lat: number,
  lng: number,
  token: string
): Promise<string | null> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?access_token=${token}&types=address&limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ place_name?: string }>;
    };
    const first = data.features?.[0];
    if (!first?.place_name) return null;
    // Mapbox returns full place name; strip country suffix (", United States")
    return first.place_name.replace(/, United States$/, "").trim();
  } catch {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface VenueRecord {
  id: string;
  lat: number;
  lng: number;
  address: string;
  notes?: string;
}

function extractVenues(src: string): VenueRecord[] {
  // Quick regex extraction — not a full TS parser, but sufficient for this file's
  // regular structure.
  const venueBlocks = src.matchAll(/\{[\s\S]*?\},?\n(?=\s+\{|\s*\])/g);
  const results: VenueRecord[] = [];
  for (const match of venueBlocks) {
    const block = match[0];
    const id = block.match(/id:\s*"([^"]+)"/)?.[1];
    const lat = parseFloat(block.match(/lat:\s*([\d.-]+)/)?.[1] ?? "0");
    const lng = parseFloat(block.match(/lng:\s*([\d.-]+)/)?.[1] ?? "0");
    const address = block.match(/address:\s*"([^"]*)"/)?.[1];
    const notes = block.match(/notes:\s*"([^"]*)"/)?.[1];
    if (id && address) {
      results.push({ id, lat, lng, address, notes });
    }
  }
  return results;
}

async function main() {
  const src = readFileSync(DATA_FILE, "utf-8");
  const venues = extractVenues(src);

  const addressTargets = venues.filter(
    (v) => v.address === "Address not in OpenStreetMap"
  );
  const hoursTargets = venues.filter(
    (v) => v.notes?.startsWith("Hours (OSM opening_hours):")
  );

  console.error(
    `Found ${addressTargets.length} venues needing address geocoding`
  );
  console.error(
    `Found ${hoursTargets.length} venues needing hours parsing`
  );

  // ── Step 1: Geocode addresses ────────────────────────────────────────────

  let mapboxToken: string | null = null;
  const addressMap = new Map<string, string>(); // id → derived address
  const addressSources = new Map<string, string>(); // id → source label

  let nominatimCount = 0;
  let mapboxCount = 0;
  let coordFallbackCount = 0;

  for (const v of addressTargets) {
    process.stderr.write(`  Geocoding ${v.id} (${v.lat}, ${v.lng}) … `);
    await sleep(NOMINATIM_DELAY_MS);
    const nom = await reverseGeoNominatim(v.lat, v.lng);
    if (nom) {
      addressMap.set(v.id, nom);
      addressSources.set(v.id, "nominatim");
      nominatimCount++;
      process.stderr.write(`nominatim: "${nom}"\n`);
      continue;
    }
    // Mapbox fallback
    if (!mapboxToken) {
      try {
        mapboxToken = getMapboxToken();
      } catch (e) {
        process.stderr.write(`mapbox token error: ${e}\n`);
      }
    }
    if (mapboxToken) {
      const mb = await reverseGeoMapbox(v.lat, v.lng, mapboxToken);
      if (mb) {
        addressMap.set(v.id, mb);
        addressSources.set(v.id, "mapbox");
        mapboxCount++;
        process.stderr.write(`mapbox: "${mb}"\n`);
        continue;
      }
    }
    // Coordinate fallback
    const coords = `${v.lat}, ${v.lng}`;
    addressMap.set(v.id, coords);
    addressSources.set(v.id, "coords");
    coordFallbackCount++;
    process.stderr.write(`coord fallback: "${coords}"\n`);
  }

  console.error(
    `\nAddress geocoding done: Nominatim=${nominatimCount} Mapbox=${mapboxCount} CoordFallback=${coordFallbackCount}`
  );

  // ── Step 2: Parse hours from notes ──────────────────────────────────────

  // Import the parser dynamically (relative to this script)
  const { parseOsmNotesString } = await import(
    join(REPO_ROOT, "src", "lib", "parseOsmHours.ts")
  );

  // Build map of id → { hours_weekly, newNotes, newOperator }
  interface HoursPatch {
    hours_weekly: Record<string, string[]> | undefined;
    newNotes: string | undefined;
    newOperator: string | undefined;
  }
  const hoursMap = new Map<string, HoursPatch>();

  for (const v of hoursTargets) {
    const { hours_weekly, residue } = parseOsmNotesString(v.notes ?? "");
    let newNotes: string | undefined;
    let newOperator: string | undefined;

    if (residue) {
      // Classify residue: starts with "Operated by" → operator field
      if (residue.startsWith("Operated by ")) {
        newOperator = residue.slice("Operated by ".length).trim();
      } else {
        newNotes = residue;
      }
    }

    hoursMap.set(v.id, {
      hours_weekly: hours_weekly as Record<string, string[]> | undefined,
      newNotes,
      newOperator,
    });
    console.error(
      `  Hours ${v.id}: ${
        hours_weekly
          ? `parsed (${Object.keys(hours_weekly).length} days)`
          : "FAILED"
      } | residue="${residue ?? "(none)"}"`
    );
  }

  // ── Step 3: Emit patched file ────────────────────────────────────────────

  let patched = src;

  // Apply address patches
  for (const [id, newAddr] of addressMap.entries()) {
    // Escape for use in regex replacement string
    const escaped = newAddr.replace(/[\\$]/g, "\\$&");
    patched = patched.replace(
      new RegExp(
        `(id:\\s*"${id.replace(/[-]/g, "\\-")}",(?:[\\s\\S]*?))address:\\s*"Address not in OpenStreetMap"`,
        "m"
      ),
      `$1address: "${escaped}"`
    );
  }

  // Apply hours patches
  for (const [id, patch] of hoursMap.entries()) {
    if (!patch.hours_weekly) continue;

    const { hours_weekly, newNotes, newOperator } = patch;

    // Build hours_weekly block
    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const hoursLines = days
      .filter((d) => hours_weekly?.[d])
      .map((d) => `        ${d}: ["${hours_weekly![d][0]}"]`)
      .join(",\n");
    const hoursBlock = `    hours_weekly: {\n${hoursLines},\n    },`;

    // Find the venue block and replace/add fields
    const idPattern = `id: "${id}"`;
    const venueStart = patched.indexOf(idPattern);
    if (venueStart === -1) continue;

    // Find the closing brace of this venue object
    let depth = 0;
    const blockStart = patched.lastIndexOf("{", venueStart);
    let pos = blockStart;
    for (; pos < patched.length; pos++) {
      if (patched[pos] === "{") depth++;
      if (patched[pos] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const blockEnd = pos;
    let block = patched.slice(blockStart, blockEnd + 1);

    // Remove the OSM notes line
    block = block.replace(
      /\n\s+notes:\s*"Hours \(OSM opening_hours\):[^"]*",?/,
      ""
    );

    // Add hours_weekly if not present
    if (!block.includes("hours_weekly:")) {
      // Insert after last_verified or after lng or after lat
      block = block.replace(
        /(last_verified:\s*"[^"]*",)/,
        `$1\n${hoursBlock}`
      );
    }

    // Update notes field if residue exists and not an operator
    if (newNotes) {
      if (block.includes("\n    notes:")) {
        // Update existing notes
        block = block.replace(
          /(\n\s+notes:\s*)"[^"]*"/,
          `$1"${newNotes.replace(/"/g, '\\"')}"`
        );
      } else {
        // Add notes before source
        block = block.replace(
          /(\n\s+source:)/,
          `\n    notes: "${newNotes.replace(/"/g, '\\"')}",\n    source:`
        );
        // Remove accidental double "source:"
        block = block.replace(/,\n    source:\n    source:/, ",\n    source:");
      }
    }

    // Add operator field if extracted
    if (newOperator) {
      if (!block.includes("\n    operator:")) {
        block = block.replace(
          /(\n\s+source:)/,
          `\n    operator: "${newOperator.replace(/"/g, '\\"')}",\n    source:`
        );
        // Remove accidental double "source:"
        block = block.replace(/,\n    source:\n    source:/, ",\n    source:");
      }
    }

    patched = patched.slice(0, blockStart) + block + patched.slice(blockEnd + 1);
  }

  // Write result
  writeFileSync(DATA_FILE, patched, "utf-8");
  console.error("\nWrote patched file to", DATA_FILE);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
