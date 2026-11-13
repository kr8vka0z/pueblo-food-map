/**
 * /admin/activity — the owner-only Activity log (#679): every admin
 * sign-in, failed attempt and action, newest first, grouped by day and then
 * by sign-in. See src/lib/activityLog.ts for the data and grouping rules,
 * src/lib/authEvents.ts for how sign-ins are recorded.
 *
 * Access: same Better Auth chain as every admin page (getAdminDb(), failing
 * closed via handlePageAuthError), THEN the owner gate — anyone who isn't
 * ADMIN_OWNER_EMAIL's account, including other allowlisted admins, gets a
 * 404, and AdminNav never renders the Activity item for them. There is no
 * separate data route: everything is read here, server-side, after the gate.
 */

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts } from "@/lib/adminNavCounts";
import {
  buildActivityDays,
  loadActivityPage,
  loadActivityPeople,
  parseActivityFilters,
  type ActivityFilters,
} from "@/lib/activityLog";
import AdminNav from "@/components/AdminNav";
import ActivityLog from "@/components/ActivityLog";
import { pageBodyClass, pageTitleClass } from "@/lib/adminCardStyles";

/** The filter fields the form sends; "until" is paging, not a filter. */
const FILTER_KEYS = ["person", "type", "from", "to", "q"];

function olderHref(filters: ActivityFilters, until: string): string {
  const params = new URLSearchParams();
  if (filters.person) params.set("person", filters.person);
  if (filters.type !== "all") params.set("type", filters.type);
  params.set("from", filters.from);
  params.set("to", filters.to);
  if (filters.q) params.set("q", filters.q);
  params.set("until", until);
  return `/admin/activity?${params.toString()}`;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const { db, identity } = await getAdminDb(await headers()).catch(handlePageAuthError);

  // Owner gate — checked before a single activity row is read.
  if (identity.isOwner !== true) notFound();

  const params = searchParams ? await searchParams : {};
  const filters = parseActivityFilters(params);
  // Decided from the address, not by comparing with the clock-based default range.
  const filtered = FILTER_KEYS.some((key) => [params[key]].flat().some(Boolean));
  const [page, people, navCounts] = await Promise.all([
    loadActivityPage(db, filters),
    loadActivityPeople(db),
    loadAdminNavCounts(db),
  ]);
  const days = buildActivityDays(page);
  const nextUntil = page.nextUntil;

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={identity.email} active="activity" counts={navCounts} showActivity />
      <div className={pageBodyClass}>
        <h2 className={pageTitleClass}>Activity</h2>
        <ActivityLog
          days={days}
          filters={filters}
          people={people}
          olderHref={nextUntil ? olderHref(filters, nextUntil) : null}
          filtered={filtered}
        />
      </div>
    </main>
  );
}
