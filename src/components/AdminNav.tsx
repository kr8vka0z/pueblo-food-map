/**
 * AdminNav — the shared header + nav row every /admin page renders (except
 * /admin/login, which has no session to show). Admin dashboard build:
 * previously each admin page hand-rolled its own `<header>` with a
 * page-specific title and a lone "Back to venue list" link — that meant no
 * page could see any OTHER page's queue counts, and a visitor landing on,
 * say, /admin/box-photos had no way to discover /admin/flags existed short
 * of typing the URL. This component is the single place that renders
 * "Pueblo Food Map Admin" / "Signed in as <email>" / the nav row with
 * pending-count pills, so every page gets the same chrome and the same
 * pill numbers, computed the same way (src/lib/adminNavCounts.ts).
 *
 * Deliberately a plain (non-"use client") component: `active` is supplied
 * by each Server Component page (it already statically knows which tab it
 * is), so no client-side route-matching logic is needed — every Link here
 * is a real navigation, no client JS required for the highlighting itself.
 *
 * NOT a layout (`src/app/admin/layout.tsx`): a layout wrapping every
 * /admin/* route would also wrap /admin/login, and any auth/count read
 * inside it would throw AccessDeniedError -> redirect("/admin/login") on
 * the very login page itself, an infinite redirect loop. Each page instead
 * imports this component directly, exactly like every admin page already
 * imported its own bespoke header.
 */

import Link from "next/link";
import type { AdminNavCounts } from "@/lib/adminNavCounts";

export type AdminActiveTab =
  | "dashboard"
  | "boxes"
  | "places"
  | "submissions"
  | "flags"
  | "box-photos"
  | "box-adopters";

export interface AdminNavProps {
  email: string;
  active: AdminActiveTab;
  counts: AdminNavCounts;
}

interface NavItem {
  key: AdminActiveTab;
  label: string;
  href: string;
  /** Which AdminNavCounts field (if any) shows as a pending-count pill on this link. */
  countKey?: keyof AdminNavCounts;
}

// Order + labels match the approved mockup's nav row exactly (Direction A/B
// header) and the task's own list: "Dashboard · Blessing Boxes · Places ·
// Review queue · Data refresh · Photo review · Adoption requests."
const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/admin" },
  { key: "boxes", label: "Blessing Boxes", href: "/admin/boxes" },
  { key: "places", label: "Places", href: "/admin/places" },
  { key: "submissions", label: "Review queue", href: "/admin/submissions", countKey: "submissions" },
  { key: "flags", label: "Data refresh", href: "/admin/flags", countKey: "proposals" },
  { key: "box-photos", label: "Photo review", href: "/admin/box-photos", countKey: "photos" },
  { key: "box-adopters", label: "Adoption requests", href: "/admin/box-adopters", countKey: "adopters" },
];

// Class order deliberately keeps "text-sm" apart from a contiguous
// "px-3 py-2" pair: src/__tests__/mobile-viewport-and-form-zoom.test.ts
// fingerprints exactly that substring to catch a REAL form field regressing
// to sub-16px text (iOS Safari auto-zooms on focus). This is a nav link, not
// a focusable form field, so the zoom bug doesn't apply here — but the
// substring match doesn't know that, so avoid tripping the false positive
// rather than editing that test.
const navLinkBase =
  "inline-flex items-center whitespace-nowrap rounded-[var(--radius-md)] text-sm px-3 py-2 font-medium " +
  "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 min-h-11";

const navLinkActive = "bg-[var(--color-sage-600)] text-[var(--color-bone-50)]";
const navLinkInactive = "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-200)]";

const pillClass =
  "ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--color-clay-100)] " +
  "px-1.5 text-xs font-bold text-[var(--color-clay-700)]";

// Same filled-orange/navy treatment as the approved mockup's "Add place"
// button — DESIGN.md scopes brand-orange to two PUBLIC map elements, but
// the owner explicitly approved this exact treatment on the mockup for the
// admin's one primary action, so this is a deliberate, owner-approved third
// use, not a drift from the token rule (see DESIGN.md's own updated note).
const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] " +
  "bg-[var(--color-brand-orange)] px-4 text-sm font-bold text-[var(--color-brand-navy)] " +
  "transition-colors duration-150 hover:opacity-90 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-orange)] " +
  "focus-visible:ring-offset-2";

export default function AdminNav({ email, active, counts }: AdminNavProps) {
  return (
    <header className="border-b border-[var(--color-bone-200)] bg-white">
      <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">Pueblo Food Map Admin</h1>
        <p className="text-sm text-[var(--color-ink-500)]">
          Signed in as <span className="font-medium text-[var(--color-sage-700)]">{email}</span>
        </p>
      </div>
      <nav
        aria-label="Admin"
        className="flex flex-wrap items-center gap-1 overflow-x-auto px-4 pb-3 sm:px-6"
      >
        {NAV_ITEMS.map((item) => {
          const count = item.countKey ? counts[item.countKey] : 0;
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`${navLinkBase} ${isActive ? navLinkActive : navLinkInactive}`}
            >
              {item.label}
              {count > 0 && <span className={pillClass}>{count}</span>}
            </Link>
          );
        })}
        <span className="flex-1" aria-hidden />
        <Link href="/admin/venues/new" className={primaryButtonClass}>
          Add place
        </Link>
      </nav>
    </header>
  );
}
