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
import { fieldLabel, SOURCE_BADGE } from "@/components/ProposalCard";
import type { ProposalSourceValue } from "@/lib/adminProposals";
import { SWITCH_THRESHOLD, type SwitchState } from "@/lib/sourceSwitch";

export function SourceSwitchList({ states }: { states: SwitchState[] | null }) {
  if (!states || states.length === 0) return null;
  const bySource = new Map<string, SwitchState[]>();
  for (const s of states) bySource.set(s.source, [...(bySource.get(s.source) ?? []), s]);
  return (
    <div className="elevation-1 mb-4 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-3">
      {[...bySource].map(([source, pairs]) => (
        <div key={source} className="text-sm">
          <p className="font-semibold text-[var(--color-ink-700)]">
            {SOURCE_BADGE[source as ProposalSourceValue]?.label ?? source}: switches on after {SWITCH_THRESHOLD} approvals in a row
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[var(--color-ink-500)]">
            {pairs.map((p) => (
              <li key={p.field} className={p.on ? "font-medium text-[var(--color-sage-700)]" : undefined}>
                {p.on
                  ? `${fieldLabel(p.field)}: updates on its own`
                  : `${fieldLabel(p.field)}: ${p.streak} of ${SWITCH_THRESHOLD}, asks you first`}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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
