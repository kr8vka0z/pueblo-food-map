/**
 * /report/[venueId] share preview (#894 item 7): its canonical and Open Graph
 * URL are the report page itself, not the homepage the layout's defaults name.
 */

import { expect, test } from "vitest";
import { generateMetadata } from "@/app/(site)/report/[venueId]/page";
import { venues } from "@/data/venues";
import { SITE_URL } from "@/lib/site";

test("a report page's canonical and share URL are the report page, and the share title names the venue", async () => {
  const venue = venues[0];
  const metadata = await generateMetadata({ params: Promise.resolve({ venueId: venue.id }) });
  const url = `${SITE_URL}/report/${venue.id}`;
  expect(metadata.alternates?.canonical).toBe(url);
  expect(metadata.openGraph).toMatchObject({ url, title: expect.stringContaining(venue.name) });
});
