"use client";

/**
 * SourceSwitchPanel — one line per switchable (source, field) pair on the
 * Places tab's review queue: how many unedited approvals in a row it has,
 * and whether it now updates on its own (src/lib/sourceSwitch.ts; Venue
 * Data Rebuild plan, "Decided: sources switch themselves on"), so Kyle sees
 * what is running by itself without reading a log. Fetched from
 * GET /api/admin/source-switch after the page loads (see that route's
 * header for why); any failure just leaves the panel out.
 */

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SOURCE_BADGE } from "@/components/ProposalCard";
import { fieldLabel } from "@/lib/fieldLabels";
import type { ProposalSourceValue } from "@/lib/adminProposals";
import { SWITCH_THRESHOLD, type SwitchState } from "@/lib/sourceSwitch";
import { cardSlimClass, focusRingClass, groupTitleClass, tagClass } from "@/lib/adminCardStyles";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

export function SourceSwitchList({ states }: { states: SwitchState[] | null }) {
  if (!states || states.length === 0) return null;
  const bySource = new Map<string, SwitchState[]>();
  for (const s of states) bySource.set(s.source, [...(bySource.get(s.source) ?? []), s]);
  const onCount = states.filter((s) => s.on).length;
  const summaryNote =
    onCount > 0 ? `${onCount} of ${states.length} running on their own` : `${states.length} asking you first`;
  return (
    // Folded by default with a visible chevron (design-system.md: sections used
    // less than daily stay folded) so the Places table stays close to the top.
    <details className={`${cardSlimClass} group`}>
      <summary
        className={
          `-mx-2 flex min-h-12 touch-manipulation cursor-pointer list-none items-center justify-between gap-2 ` +
          `rounded-[var(--radius-sm)] px-2 text-sm font-medium text-[var(--color-ink-700)] ` +
          `transition-colors duration-150 hover:bg-[var(--color-sage-100)] ${PRESS_FEEDBACK} ${focusRingClass} ` +
          `[&::-webkit-details-marker]:hidden`
        }
      >
        <span>
          Automatic data updates{" "}
          <span className="font-normal text-[var(--color-ink-500)] tabular-nums">({summaryNote})</span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="shrink-0 text-[var(--color-ink-500)] transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      {/* Each source is its own block, 12 apart with a hairline between, its
          heading 8 above its list, so two sources never run together (#926). */}
      <div className="mt-2 flex flex-col divide-y divide-[var(--color-bone-200)] border-t border-[var(--color-bone-200)] pt-3">
        {[...bySource].map(([source, pairs]) => (
          <div key={source} className="py-3 text-sm first:pt-0 last:pb-0">
            <p className={groupTitleClass}>
              {SOURCE_BADGE[source as ProposalSourceValue]?.label ?? source}: switches on after {SWITCH_THRESHOLD} approvals in a row
            </p>
            <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--color-ink-500)]">
              {pairs.map((p) => (
                // A pair that runs by itself shows as a calm tag.
                <li key={p.field} className={p.on ? tagClass("calm") : undefined}>
                  {p.on
                    ? `${fieldLabel(p.field)}: updates on its own`
                    : `${fieldLabel(p.field)}: ${p.streak} of ${SWITCH_THRESHOLD}, asks you first`}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function SourceSwitchPanel() {
  const [states, setStates] = useState<SwitchState[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/source-switch")
      .then((res) => (res.ok ? (res.json() as Promise<{ states?: SwitchState[] }>) : null))
      .then((body) => {
        if (live && Array.isArray(body?.states)) setStates(body.states);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return <SourceSwitchList states={states} />;
}
