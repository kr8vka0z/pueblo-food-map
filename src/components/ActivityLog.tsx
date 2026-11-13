/**
 * ActivityLog — the owner-only admin Activity page's body (#679): filters,
 * then days → sign-ins → actions. Pure presentation over
 * src/lib/activityLog.ts's buildActivityDays(); the page
 * (src/app/(site)/admin/activity/page.tsx) does the owner check and the loading.
 *
 * Plain server component: the filters are a GET form and long runs collapse
 * with a native <details>, so nothing here needs client JS.
 */

import Link from "next/link";
import {
  cardClass,
  emptyStateClass,
  focusRingClass,
  linkClass,
  secondaryButtonClass,
  sectionTitleClass,
  tagClass,
  type TagTone,
} from "@/lib/adminCardStyles";
import { ADMIN_PRIMARY_BUTTON, labelClass, inputClass } from "@/components/formClasses";
import {
  ACTIVITY_TYPES,
  describeDevice,
  describeFailure,
  describeLocation,
  formatTime,
  maskIp,
  METHOD_LABELS,
  summarizeAction,
  type ActivityDay,
  type ActivityFilters,
  type ActivityGroup,
  type ActivityItem,
  type AuthEventRow,
} from "@/lib/activityLog";
import { fieldLabel } from "@/lib/fieldLabels";

/** Readable names for system actors (actor_email without an "@"). */
const AUTOMATIC_ACTOR_LABELS: Record<string, string> = {
  "refresh-pipeline": "weekly data refresh",
  "refresh-pipeline-ai": "data refresh, AI auto-apply",
};

/** Runs of this many or more consecutive same-tag actions collapse. */
const COLLAPSE_RUN = 3;

// activityLog.ts's three tones mapped onto the shared tag tones (#926 decision 12).
const TAG_TONE: Record<"neutral" | "good" | "bad", TagTone> = { neutral: "neutral", good: "calm", bad: "attention" };

function Tag({ tone, children }: { tone: keyof typeof TAG_TONE; children: React.ReactNode }) {
  return <span className={`${tagClass(TAG_TONE[tone])} shrink-0`}>{children}</span>;
}

function Ip({ ip }: { ip: string | null }) {
  if (!ip) return null;
  return (
    <span title={ip} className="tabular-nums">
      {maskIp(ip)}
    </span>
  );
}

function DeviceLine({ row }: { row: AuthEventRow }) {
  const parts = [describeDevice(row.user_agent), describeLocation(row)].filter(Boolean);
  return (
    <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">
      {parts.join(" · ")}
      {row.ip && (
        <>
          {" · "}
          <Ip ip={row.ip} />
        </>
      )}
    </p>
  );
}

function ActionLine({ item }: { item: ActivityItem }) {
  const time = <span className="w-16 shrink-0 whitespace-nowrap text-sm tabular-nums text-[var(--color-ink-500)]">{formatTime(item.at)}</span>;
  if (item.kind === "auth") {
    const label =
      item.row.event === "sign_out" ? "Signed out" : item.row.event === "passkey_added" ? "Added a passkey" : "Removed a passkey";
    return (
      <li className="flex items-start gap-3 py-2">
        {time}
        <Tag tone="neutral">{label}</Tag>
      </li>
    );
  }
  const { row } = item;
  const summary = summarizeAction(row);
  return (
    <li className="flex items-start gap-3 py-2">
      {time}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={summary.tone}>{summary.tag}</Tag>
          {row.venue_id && row.venue_name ? (
            <Link
              href={`/admin/venues/${encodeURIComponent(row.venue_id)}/edit`}
              className={`${linkClass} text-sm`}
            >
              {row.venue_name}
            </Link>
          ) : row.venue_name ? (
            <span className="text-sm font-medium text-[var(--color-ink-700)]">{row.venue_name}</span>
          ) : null}
          {summary.note && <span className="text-sm text-[var(--color-ink-500)]">{summary.note}</span>}
          {summary.prUrl && (
            <a href={summary.prUrl} className={`${linkClass} text-sm`} rel="noreferrer" target="_blank">
              GitHub PR
            </a>
          )}
        </div>
        {summary.changes.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-sm text-[var(--color-ink-700)]">
            {summary.changes.map((c) => (
              <li key={c.field} className="break-words">
                <span className="font-medium">{fieldLabel(c.field)}</span>: <span className="text-[var(--color-ink-500)]">{c.before}</span> →{" "}
                {c.after}
              </li>
            ))}
            {summary.moreChanges > 0 && <li className="text-[var(--color-ink-500)]">+{summary.moreChanges} more {summary.moreChanges === 1 ? "field" : "fields"}</li>}
          </ul>
        )}
      </div>
    </li>
  );
}

function itemTag(item: ActivityItem): string {
  return item.kind === "action" ? summarizeAction(item.row).tag : item.row.event;
}

/** Splits items into runs; runs of COLLAPSE_RUN+ same-tag actions collapse behind "Edited 4 · show all". */
function ItemList({ items }: { items: ActivityItem[] }) {
  const runs: ActivityItem[][] = [];
  for (const item of items) {
    const last = runs.at(-1);
    if (last && itemTag(last[0]) === itemTag(item)) last.push(item);
    else runs.push([item]);
  }
  return (
    <ul className="mt-2 divide-y divide-[var(--color-bone-200)] border-t border-[var(--color-bone-200)]">
      {runs.map((run) =>
        run.length >= COLLAPSE_RUN && run[0].kind === "action" ? (
          <li key={`${run[0].at}-${run.length}`} className="py-2">
            <details>
              <summary
                className={`min-h-12 cursor-pointer rounded-[var(--radius-sm)] py-2 text-sm font-medium text-[var(--color-ink-700)] ${focusRingClass}`}
              >
                {itemTag(run[0])} {run.length} · show all
              </summary>
              <ul className="divide-y divide-[var(--color-bone-200)]">
                {run.map((item) => (
                  <ActionLine key={`${item.kind}-${item.row.id}`} item={item} />
                ))}
              </ul>
            </details>
          </li>
        ) : (
          run.map((item) => <ActionLine key={`${item.kind}-${item.row.id}`} item={item} />)
        ),
      )}
    </ul>
  );
}

function GroupCard({ group }: { group: ActivityGroup }) {
  if (group.kind === "failed") {
    const { row } = group;
    return (
      <li className={`${cardClass} border-[var(--color-danger)]`}>
        <p className="text-sm font-semibold text-[var(--color-danger)]">
          {formatTime(row.created_at)} · Failed sign-in{row.email ? `: ${row.email}` : ""}
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-danger)]">{describeFailure(row)}</p>
        <DeviceLine row={row} />
      </li>
    );
  }
  if (group.kind === "event") {
    return (
      <li className={cardClass}>
        {/* ActionLine is an <li>: a bare <li> in an <li> is split apart by the browser's HTML parser, putting the row outside this card until hydration. */}
        <ul>
          <ActionLine item={{ kind: "auth", at: group.at, row: group.row }} />
        </ul>
      </li>
    );
  }
  let heading: React.ReactNode;
  let sub: React.ReactNode = null;
  if (group.kind === "session") {
    const signIn = group.signIn;
    heading = signIn ? (
      <>
        {formatTime(signIn.created_at)} · {signIn.email ?? group.email ?? "Unknown account"} signed in
        {signIn.method && METHOD_LABELS[signIn.method] ? ` with ${METHOD_LABELS[signIn.method]}` : ""}
      </>
    ) : (
      <>{group.email ?? "Unknown account"} signed in before sign-ins were recorded</>
    );
    sub = signIn ? <DeviceLine row={signIn} /> : null;
  } else if (group.kind === "automatic") {
    heading = <>Automatic: {AUTOMATIC_ACTOR_LABELS[group.actor] ?? group.actor}</>;
  } else {
    heading = <>{group.email}, before sign-ins were recorded</>;
  }
  return (
    <li className={cardClass}>
      <p className="text-sm font-semibold text-[var(--color-ink-900)]">{heading}</p>
      {sub}
      {group.items.length > 0 && <ItemList items={group.items} />}
    </li>
  );
}

export interface ActivityLogProps {
  days: ActivityDay[];
  filters: ActivityFilters;
  people: string[];
  /** href for the next "Show older" page, or null. */
  olderHref: string | null;
  /** True when the address carried any filter: an empty result then says no activity matches, else "No activity yet." */
  filtered?: boolean;
}

export default function ActivityLog({ days, filters, people, olderHref, filtered = false }: ActivityLogProps) {
  return (
    // Its parts sit 24 apart, the same gap as the page body's (#926).
    <div className="flex flex-col gap-5">
      <form method="get" action="/admin/activity" className={`${cardClass} grid gap-4 sm:grid-cols-2`}>
        <div>
          <label htmlFor="activity-person" className={labelClass}>
            Person
          </label>
          <select id="activity-person" name="person" defaultValue={filters.person} className={inputClass}>
            <option value="">Everyone</option>
            <option value="automatic">Automatic</option>
            {people.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="activity-type" className={labelClass}>
            Activity
          </label>
          <select id="activity-type" name="type" defaultValue={filters.type} className={inputClass}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="activity-from" className={labelClass}>
            From
          </label>
          <input id="activity-from" type="date" name="from" defaultValue={filters.from} className={inputClass} />
        </div>
        <div>
          <label htmlFor="activity-to" className={labelClass}>
            To
          </label>
          <input id="activity-to" type="date" name="to" defaultValue={filters.to} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="activity-q" className={labelClass}>
            Place or box name
          </label>
          <input id="activity-q" type="search" name="q" defaultValue={filters.q} className={inputClass} />
        </div>
        <div className="flex gap-3 sm:col-span-2">
          <button type="submit" className={`${ADMIN_PRIMARY_BUTTON} flex-1`}>
            Show activity
          </button>
          {/* The page's one Clear filters, always here, so an empty result needs no second one (#926). */}
          <Link href="/admin/activity" className={secondaryButtonClass}>
            Clear filters
          </Link>
        </div>
      </form>

      {days.length === 0 ? (
        // No second Clear filters here: the form above always has one (#926).
        <div className={emptyStateClass}>
          <p>{filtered ? "No activity matches these filters." : "No activity yet."}</p>
        </div>
      ) : (
        days.map((day) => (
          <section key={day.ymd} aria-labelledby={`day-${day.ymd}`}>
            {/* h3: the page title is the h2 (#926 decision 5). */}
            <h3 id={`day-${day.ymd}`} className={`${sectionTitleClass} mb-3`}>
              {day.label}
            </h3>
            <ul className="space-y-3">
              {day.groups.map((group) => (
                <GroupCard key={group.key} group={group} />
              ))}
            </ul>
          </section>
        ))
      )}

      {olderHref && (
        <Link href={olderHref} className={`${secondaryButtonClass} self-start`}>
          Show older
        </Link>
      )}
    </div>
  );
}
