/**
 * POST /api/admin/events/translate — "Suggest Spanish" for the admin event
 * form (#757). Body: the English values of any of name, host, description,
 * what_to_bring, cancel_note. Reply: `{ ok: true, suggestions: { name_es, ... } }`
 * for the fields sent. The text is machine-made and unreviewed; this route
 * saves nothing, reads no event row and writes no audit entry.
 *
 * Auth: same as the other event routes (authorizeEventRequest: session, then
 * Origin check). A model failure is 502 and a missing AI binding (local dev)
 * is 503, both `{ ok: false, error, message }` so the form can show `message`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { authorizeEventRequest } from "@/lib/adminEvents";
import { suggestSpanish, TranslateError, validateTranslateRequest } from "@/lib/eventTranslate";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await authorizeEventRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const validation = validateTranslateRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, errors: validation.errors }, { status: 422 });
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const suggestions = await suggestSpanish(env.AI, validation.fields);
    return NextResponse.json({ ok: true, suggestions });
  } catch (err) {
    const unavailable = err instanceof TranslateError && err.code === "unavailable";
    return NextResponse.json(
      { ok: false, error: unavailable ? "unavailable" : "translate_failed", message: "The Spanish suggestion could not be made." },
      { status: unavailable ? 503 : 502 },
    );
  }
}
