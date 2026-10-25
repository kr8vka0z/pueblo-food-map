/**
 * GET /api/admin/source-switch — the automatic switch's state per
 * (source, field) for the review queue's SourceSwitchPanel
 * (src/lib/sourceSwitch.ts). A separate fetch rather than one more read on
 * the Places page: the page's own reads are deliberately one parallel batch
 * (page.concurrency.test.tsx), and this panel is optional — a database
 * without migration 0023 answers 503 and the queue still renders.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/adminDb";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import {
  computeSwitchStates,
  SWITCH_HISTORY_SQL,
  SWITCH_RESETS_SQL,
  type SwitchHistoryRow,
  type SwitchResetRow,
} from "@/lib/sourceSwitch";

export async function GET(req: NextRequest): Promise<Response> {
  let db: D1Database;
  try {
    ({ db } = await getAdminDb(req.headers));
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  try {
    const [history, resets] = await Promise.all([
      db.prepare(SWITCH_HISTORY_SQL).all<SwitchHistoryRow>(),
      db.prepare(SWITCH_RESETS_SQL).all<SwitchResetRow>(),
    ]);
    return NextResponse.json({ ok: true, states: computeSwitchStates(history.results, resets.results) });
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
