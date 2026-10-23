// audit-prod.mjs — the required production-dependency CVE gate: `npm audit --omit=dev`, minus the advisories in
// IGNORED below. Prints one line per remaining high/critical package ("- name (severity): urls") and exits 1 if any,
// 0 if none, 2 if npm audit itself failed (no usable report). Called by weekly-security-audit.yml's blocking step and
// by audit-fix.sh's gate() and failing list, so the check and the daily auto-fix job always agree.
// Test: the "ignore list" case in audit-fix.test.mjs.
import { spawnSync } from "node:child_process";

// Each entry is build-only: its whole chain is in vinext's build tooling, and no file from the chain is in the deployed
// Worker or the public assets (checked 2026-10-22: zero hits for any package of the chain in the dist/server and
// dist/client source maps, which do list the runtime packages such as react-dom, better-auth and vinext itself).
// Re-check that before adding anything here.
const IGNORED = new Set([
  // braces (high): vinext > vite-plugin-commonjs > vite-plugin-dynamic-import > fast-glob > micromatch > braces.
  // `braces *`: no patched version exists, so no override can fix it. Remove when vinext drops vite-plugin-commonjs
  // or a fixed braces reaches that chain (npm audit stops listing it under vinext).
  "GHSA-vfj7-8cjw-p6xm",
]);
// The other vinext build-only advisory, GHSA-px8p-9vwx-vf98 (fflate, vinext > @vercel/og > satori > fflate), is fixed
// by the `satori > fflate` override in package.json instead of being ignored here.

const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

const res = spawnSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
let report;
try {
  report = JSON.parse(res.stdout);
} catch {
  report = null;
}
if (!report || report.error || typeof report.vulnerabilities !== "object") {
  console.error("audit-prod: npm audit returned no usable report");
  if (res.stderr) console.error(res.stderr.trim());
  process.exit(2);
}

const vulns = report.vulnerabilities;
const advisoryId = (v) => String(v.url ?? "").split("/").pop();
// A package's severity once ignored advisories are dropped: the worst of its own kept advisories and of the kept
// packages it is vulnerable through. A package with any un-ignored advisory still counts, so a new advisory on the
// same package fails the gate. null = nothing left.
// ponytail: re-walks shared chains per package (no memo, so a cycle can't cache a partial answer); npm audit lists
// tens of packages, not thousands.
function effective(name, path = new Set()) {
  if (path.has(name) || !vulns[name]) return null; // cycle, or a package npm didn't list
  const next = new Set(path).add(name);
  let worst = null;
  for (const via of vulns[name].via ?? []) {
    const sev = typeof via === "string" ? effective(via, next) : IGNORED.has(advisoryId(via)) ? null : via.severity ?? vulns[name].severity;
    if (sev && (worst === null || RANK[sev] > RANK[worst])) worst = sev;
  }
  return worst;
}

const failing = [];
for (const name of Object.keys(vulns)) {
  const sev = effective(name);
  if (sev === "high" || sev === "critical") {
    const urls = [...new Set((vulns[name].via ?? []).filter((v) => typeof v === "object" && !IGNORED.has(advisoryId(v))).map((v) => v.url))];
    failing.push(`- ${name} (${sev}): ${urls.join(", ")}`);
  }
}
if (failing.length) {
  console.log(failing.join("\n"));
  process.exit(1);
}
