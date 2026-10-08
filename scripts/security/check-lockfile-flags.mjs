/**
 * check-lockfile-flags.mjs — fails when package-lock.json flags a package that
 * production can reach as `"dev": true`.
 *
 * WHY: the CVE audit runs `npm audit --omit=dev`, which skips every dev-flagged
 * package. Node 22's bundled npm 10 writes those flags wrong on any lockfile
 * write, marking packages production reaches (sharp's `@img/sharp-*`) as dev, so
 * the audit silently stopped checking them. Seen on 51bfc98 (repaired two days
 * later by an npm 11 write) and e527456 (PR #752, repaired by #753; the audit
 * saw 166 production packages instead of 231). A "use npm 11" convention didn't
 * prevent it, so the audit job refuses such a lockfile.
 *
 * Run: node scripts/security/check-lockfile-flags.mjs [path]  (default package-lock.json)
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Lockfile object in, sorted paths of production-reachable packages flagged dev out. */
export function hiddenProductionPackages(lock) {
  const pk = lock.packages;
  if (!pk?.[""]) throw new Error('not a lockfileVersion 2/3 package-lock.json (no packages[""])');
  // Node-style lookup: <dir>/node_modules/<name>, then up one node_modules level at a time.
  const resolve = (from, name) => {
    for (let dir = from; ; ) {
      const path = `${dir ? `${dir}/` : ""}node_modules/${name}`;
      if (pk[path]) return path;
      if (!dir) return null;
      const i = dir.lastIndexOf("/node_modules/");
      dir = i === -1 ? "" : dir.slice(0, i);
    }
  };
  const seen = new Set();
  const queue = [""];
  while (queue.length) {
    const cur = queue.pop();
    const { dependencies, optionalDependencies, peerDependencies, peerDependenciesMeta } = pk[cur];
    const names = [
      ...Object.keys(dependencies ?? {}),
      ...Object.keys(optionalDependencies ?? {}),
      ...Object.keys(peerDependencies ?? {}).filter((n) => !peerDependenciesMeta?.[n]?.optional),
    ];
    for (const name of names) {
      const path = resolve(cur, name);
      if (path && !seen.has(path)) {
        seen.add(path);
        queue.push(path);
      }
    }
  }
  return [...seen].filter((path) => pk[path].dev).sort();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const file = process.argv[2] ?? "package-lock.json";
  const bad = hiddenProductionPackages(JSON.parse(readFileSync(file, "utf8")));
  if (bad.length === 0) {
    console.log(`${file}: no production package is flagged dev.`);
  } else {
    const shown = bad.slice(0, 10).map((p) => `  ${p}`);
    if (bad.length > 10) shown.push(`  ... and ${bad.length - 10} more`);
    console.error(
      `${file} flags ${bad.length} package(s) "dev": true that production code reaches.\n` +
        "`npm audit --omit=dev` skips dev-flagged packages, so the CVE audit would not check them.\n" +
        `npm 10 (bundled with Node 22) writes these flags wrong; npm 11 writes them right.\n\n${shown.join("\n")}\n\n` +
        "Fix: npx -y npm@11.21.0 install --package-lock-only --ignore-scripts\nthen commit package-lock.json.",
    );
    process.exitCode = 1;
  }
}
