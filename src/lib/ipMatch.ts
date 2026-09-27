/**
 * ipMatch.ts — IPv4/IPv6/CIDR matcher for the analytics IP exclusion list
 * (#485 comment, 2026-09-26: "exclude Kyle's own visits from all analytics").
 *
 * WHY this lives in src/lib/ instead of custom-worker.ts: that file imports
 * from the gitignored, build-generated .open-next/worker.js and can't be
 * unit-tested (see its own header comment) — this is the testable half the
 * /ingest proxy calls into.
 *
 * WHY it never throws: ANALYTICS_EXCLUDED_IPS is a plain Worker var, hand-
 * edited in wrangler.jsonc — a typo in it must degrade to "nothing
 * excluded," never take down the analytics proxy for every visitor.
 */

/** Expands IPv6 "::" shorthand into 8 explicit 16-bit hex groups. */
function expandIPv6(addr: string): string[] | null {
  if (addr.includes("::")) {
    const [head, tail] = addr.split("::");
    if (addr.indexOf("::") !== addr.lastIndexOf("::")) return null; // more than one "::"
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) return null;
    return [...headParts, ...Array(missing).fill("0"), ...tailParts];
  }
  const parts = addr.split(":");
  return parts.length === 8 ? parts : null;
}

/** Parses an IPv6 address into a 128-bit BigInt, or null if malformed. */
function parseIPv6(addr: string): bigint | null {
  const groups = expandIPv6(addr);
  if (!groups || groups.length !== 8) return null;
  // BigInt(0)/BigInt(16), not `0n`/`16n` literals — this repo's tsconfig
  // targets ES2017 (BigInt literal syntax needs ES2020+), even though the
  // BigInt runtime type itself is available via the esnext lib.
  let value = BigInt(0);
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    value = (value << BigInt(16)) | BigInt(parseInt(group, 16));
  }
  return value;
}

/** Parses an IPv4 address into a 32-bit number, or null if malformed. */
function parseIPv4(addr: string): number | null {
  const parts = addr.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = (value << 8) | n;
  }
  return value >>> 0;
}

/** True if `ip` falls inside `entry` — a bare address or a `/prefix` CIDR. */
function matchesEntry(ip: string, entry: string): boolean {
  const isV6 = ip.includes(":");
  const [base, prefixStr] = entry.split("/");
  // "1.2.3.4/" would otherwise parse as prefix 0 (Number("") === 0) and match
  // EVERY address, dropping all analytics. A malformed entry must match nothing.
  if (prefixStr !== undefined && prefixStr.trim() === "") return false;
  if (isV6 !== base.includes(":")) return false; // family mismatch

  if (isV6) {
    const ipVal = parseIPv6(ip);
    const baseVal = parseIPv6(base);
    if (ipVal === null || baseVal === null) return false;
    const prefix = prefixStr === undefined ? 128 : Number(prefixStr);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) return false;
    if (prefix === 0) return true;
    const shift = BigInt(128 - prefix);
    return ipVal >> shift === baseVal >> shift;
  }

  const ipVal = parseIPv4(ip);
  const baseVal = parseIPv4(base);
  if (ipVal === null || baseVal === null) return false;
  const prefix = prefixStr === undefined ? 32 : Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  if (prefix === 0) return true;
  const mask = prefix === 32 ? 0xffffffff : (~0 << (32 - prefix)) >>> 0;
  return (ipVal & mask) === (baseVal & mask);
}

/**
 * True if `ip` matches any entry (comma-separated IPv4/IPv6 address or CIDR)
 * in `list`. Malformed entries and a missing/empty ip or list resolve to
 * false rather than throwing — see file header WHY.
 */
export function isExcludedIp(
  ip: string | null | undefined,
  list: string | undefined,
): boolean {
  if (!ip || !list) return false;
  const entries = list
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of entries) {
    try {
      if (matchesEntry(ip, entry)) return true;
    } catch {
      // Malformed entry — skip it, never let one bad entry break the proxy.
      continue;
    }
  }
  return false;
}
