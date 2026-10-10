/**
 * /event/[id] — one special event's own page (#762, umbrella #156), for search
 * results and shared-link previews. The Spanish twin is /es/event/[id].
 *
 * WHY force-dynamic (like /box/[id]): events live only in D1 and are not part
 * of the build-time Publish snapshot, so there is no fixed id list to
 * prerender, and a cancel or edit must show without a rebuild. The static
 * generateStaticParams + dynamicParams=false pairing the venue pages use (and
 * its open-next.config.ts trap, AGENTS.md "Discoverability / SEO traps") is
 * deliberately NOT used here. No Cache-Control is added: /box/[id] adds none
 * either, Next marks a dynamic page non-cacheable, and a D1 point read is
 * cheap — so an edit, a cancel and a not-found are all current on the next
 * request, and a draft is never stored anywhere.
 *
 * Draft, archived and unknown ids all end in notFound() (a real 404),
 * indistinguishable from each other; see src/lib/eventPageData.ts.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventPage from "@/components/EventPage";
import { eventPageMetadata, loadEventForPage, requestTimeMs } from "@/lib/eventPageData";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return params.then(({ id }) => eventPageMetadata(id, "en"));
}

export default async function EventRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await loadEventForPage(id);
  if (!event) notFound();
  return <EventPage event={event} locale="en" nowMs={requestTimeMs()} />;
}
