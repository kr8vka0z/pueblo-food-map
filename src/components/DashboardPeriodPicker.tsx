"use client";

/**
 * DashboardPeriodPicker — the Dashboard's 7 / 30 / 90 day slider (#926
 * decision 10: a three-way choice is AdminSegmented, real radios). The only
 * client piece on /admin: the page is a Server Component that reads
 * `?period=`, so choosing a period navigates to the same page with that
 * value and every other query value kept.
 *
 * WHY local state and no remount on navigation: the slider shows the new
 * choice at once, and the radio keeps keyboard focus while the arrow keys
 * move through the periods (the server re-render lands on the same mounted
 * picker).
 */

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSegmented from "@/components/AdminSegmented";

interface DashboardPeriodPickerProps {
  /** The period the server rendered (already validated by the page). */
  period: string;
  options: { value: string; label: string }[];
}

export default function DashboardPeriodPicker({ period, options }: DashboardPeriodPickerProps) {
  const router = useRouter();
  const [value, setValue] = useState(period);
  const [renderedPeriod, setRenderedPeriod] = useState(period);
  // A new server period (Back, or the page re-rendering) wins over the local choice.
  if (period !== renderedPeriod) {
    setRenderedPeriod(period);
    setValue(period);
  }

  function choose(next: string) {
    setValue(next);
    // Read at the moment of the change, not through a render hook, so the
    // other query values present right now are the ones kept.
    const params = new URLSearchParams(window.location.search);
    params.set("period", next);
    startTransition(() => router.push(`/admin?${params.toString()}`, { scroll: false }));
  }

  return <AdminSegmented name="period" legend="Time period" options={options} value={value} onChange={choose} />;
}
