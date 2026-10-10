/**
 * /es/event/[id] — Spanish twin of /event/[id] (#762). Same force-dynamic D1
 * read and the same shared EventPage body; the /es tree's own root layout
 * supplies <html lang="es"> in the server HTML (see src/app/es/layout.tsx).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventPage from "@/components/EventPage";
import { eventPageMetadata, loadEventForPage, requestTimeMs } from "@/lib/eventPageData";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return params.then(({ id }) => eventPageMetadata(id, "es"));
}

export default async function EsEventRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await loadEventForPage(id);
  if (!event) notFound();
  return <EventPage event={event} locale="es" nowMs={requestTimeMs()} />;
}
