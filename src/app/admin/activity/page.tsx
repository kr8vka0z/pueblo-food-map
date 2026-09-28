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
import { loadAdminNavCounts, type AdminNavCounts } from "@/lib/adminNavCounts";
import {
  buildActivityDays,
  loadActivityPage,
  loadActivityPeople,
  parseActivityFilters,
  type ActivityDay,
  type ActivityFilters,
} from "@/lib/activityLog";
import AdminNav from "@/components/AdminNav";
import ActivityLog from "@/components/ActivityLog";

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
  let email: string;
  let isOwner = false;
  let db: D1Database;
  let navCounts: AdminNavCounts;

  try {
    const access = await getAdminDb(await headers());
    email = access.identity.email;
    isOwner = access.identity.isOwner === true;
    db = access.db;
  } catch (err) {
    handlePageAuthError(err);
  }

  // Owner gate — checked before a single activity row is read.
  if (!isOwner) notFound();

  const filters = parseActivityFilters(searchParams ? await searchParams : {});
  let days: ActivityDay[];
  let people: string[];
  let nextUntil: string | null;
  try {
    const [page, loadedPeople, counts] = await Promise.all([
      loadActivityPage(db, filters),
      loadActivityPeople(db),
      loadAdminNavCounts(db),
    ]);
    days = buildActivityDays(page);
    people = loadedPeople;
    nextUntil = page.nextUntil;
    navCounts = counts;
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="activity" counts={navCounts} showActivity />
      <div className="px-4 py-6 sm:px-6">
        <h2 className="wordmark mx-auto mb-4 max-w-3xl text-lg text-[var(--color-ink-900)]">Activity</h2>
        <ActivityLog
          days={days}
          filters={filters}
          people={people}
          olderHref={nextUntil ? olderHref(filters, nextUntil) : null}
        />
      </div>
    </main>
  );
}
