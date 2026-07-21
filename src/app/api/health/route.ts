/**
 * GET /api/health
 *
 * Lightweight uptime probe. Returns the running app version and a timestamp
 * so monitoring tools (UptimeRobot, etc.) and deploy verifiers can confirm:
 *   1. The Worker is reachable (HTTP 200).
 *   2. The deployed version matches expectations (version field).
 *   3. The response is fresh (timestamp field).
 *
 * WHY no external calls: a health endpoint that calls the DB, email provider,
 * or any third-party service will fail alongside that dependency — turning an
 * outage ping into a cascading alert storm. This handler intentionally calls
 * nothing external; it proves only that the Worker process is up.
 *
 * WHY force-dynamic + no-store: the response must be live on every request so
 * UptimeRobot sees real availability, not a stale cached copy.
 */

import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: "ok",
      version: pkg.version,
      timestamp: new Date().toISOString(),
      probe: "hx7-deploy-check",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
