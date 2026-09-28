/**
 * app/global-not-found.tsx — 404 page for URLs that match no route at all.
 *
 * Required once app/(site)/ became a route group (#689 PR 1): there is no
 * top-level app/layout.tsx any more, so Next can't compose an unmatched-URL
 * 404 from "the" root layout — node_modules/next/dist/docs/01-app/
 * 03-api-reference/03-file-conventions/not-found.md ("global-not-found.js
 * (experimental)") prescribes exactly this file for that case, gated by
 * `experimental.globalNotFound` in next.config.ts.
 *
 * This file bypasses the app's normal rendering (Next's own docs: "Next.js
 * skips rendering and directly returns this global page"), so unlike
 * app/(site)/not-found.tsx it must import globals.css and build the full
 * <html>/<body> document itself — RootShell (shared with every root layout)
 * does that, and NotFoundContent is the same branded 404 body used before
 * this file existed. metadata/viewport can't be inherited from a parent
 * layout here (there isn't one), so both are set explicitly to match what
 * app/(site)/layout.tsx would otherwise have supplied.
 *
 * app/(site)/not-found.tsx still exists separately: it renders in-tree for
 * an explicit notFound() call (venue/[id], box/[id], report/[venueId]),
 * where a real root layout IS in scope.
 */
import "./globals.css";
import RootShell from "@/components/RootShell";
import NotFoundContent from "@/components/NotFoundContent";
import { ROOT_METADATA, ROOT_VIEWPORT } from "@/lib/site";

// This file has no parent layout (it bypasses the (site) route group
// entirely — see the file header above), so OG/twitter/description would
// otherwise be silently dropped instead of inherited the way they are on
// every other page. Reusing ROOT_METADATA keeps them identical; only the
// title is overridden — no template is inherited here, so the brand suffix
// app/(site)/layout.tsx's title.template would otherwise append is spelled
// out literally to match today's rendered <title>.
export const metadata = {
  ...ROOT_METADATA,
  title: "Page Not Found · Pueblo Food Map",
};

export const viewport = ROOT_VIEWPORT;

export default function GlobalNotFound() {
  return (
    <RootShell lang="en">
      <NotFoundContent />
    </RootShell>
  );
}
