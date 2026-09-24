/**
 * document.title locale tests (#589).
 *
 * The locale is a client cookie/toggle (LocaleContext), not a route, so
 * Next.js Metadata's server-rendered <title> can only ever be English
 * (AGENTS.md "Known bilingual limitation", #287) — a Spanish visitor got a
 * fully-localized page body under a stubbornly-English tab title. This file
 * proves the client-side fix (useDocumentTitle, src/lib/useDocumentTitle.ts)
 * for every page whose body is actually localized: rendering each page's
 * "Content" component under `<LocaleProvider initialLocale="es">` and
 * asserting `document.title` is the Spanish string.
 *
 * Pages deliberately excluded (not localized, or nothing translatable in the
 * title — see the PR body for the full list):
 *   - /venue/[id], /box/[id] — title is a venue/box proper name, no EN
 *     string to translate.
 *   - /admin/* — internal tool, gated by Better Auth, never localized.
 */

import { describe, test, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { LocaleProvider, useLocale } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

// ─── Shared mocks ──────────────────────────────────────────────────────────

// PageNav (bottom nav + drawer) has its own test; stub it so these tests
// don't need matchMedia — same convention every other *Content.test.tsx
// file in this suite already uses.
vi.mock("@/components/PageNav", () => ({ default: () => null, PAGE_NAV_CLEARANCE: "" }));

// useSearchParams() has no provider outside a mounted Next App Router —
// BoxesActivityContent and AlertsConfirmContent both call it directly on
// render, so without this override `searchParams.get(...)` throws on a
// null context value. Only useSearchParams is overridden; everything else
// (including useRouter, already mocked globally in vitest.setup.ts) passes
// through untouched.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useSearchParams: () => new URLSearchParams() };
});

// BoxesActivityContent's data hooks (useBoxVenues/useBoxActivity/
// useBoxNetworkStats) all fetch on mount. A resolved-but-not-ok response
// makes each hook settle on its own empty-state default (see their own
// headers) rather than throwing — document.title doesn't depend on the
// data ever arriving.
vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false } as Response)));

const mockTurnstile = {
  render: vi.fn((_container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-token");
    return "widget-id";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};
vi.stubGlobal("turnstile", mockTurnstile);

const FIXTURE_VENUE: Venue = {
  id: "garden-rmser",
  name: "RMSER Community Garden",
  category: "garden",
  lat: 38.27,
  lng: -104.6,
  address: "330 Lake Ave, Pueblo, CO 81004",
  source: "test",
  last_verified: "2026-01-01",
};

const FIXTURE_BOX: PublicBlessingBox = {
  id: "test-box-1",
  name: "Test Blessing Box",
  category: "blessing_box",
  lat: 38.27,
  lng: -104.61,
  address: "123 Test St, Pueblo, CO",
  source: "manual",
  last_verified: "2026-09-01T00:00:00.000Z",
  box: {
    hostName: null,
    hostNote: null,
    mostNeeded: null,
    installedOn: "2026-01-01",
    removedOn: null,
    status: "stocked",
    lastFilledAt: null,
    recentCheckins: [],
    latestPhoto: null,
    adopters: [],
  },
};

const FIXTURE_GROUPS = [
  {
    category: "pantry" as const,
    items: [
      {
        id: "v1",
        name: "Test Pantry",
        category: "pantry" as const,
        lat: 38.27,
        lng: -104.6,
        address: "1 Test St, Pueblo, CO",
        source: "test",
        last_verified: "2026-01-01",
      } satisfies Venue,
    ],
  },
];

/** Render a "Content" component wrapped in an ES LocaleProvider. */
function renderEs(ui: React.ReactElement) {
  return render(<LocaleProvider initialLocale="es">{ui}</LocaleProvider>);
}

// ─── / (home) — needs its own next/dynamic + MapWrapper/SplashScreen mocks ──
// Same rationale as src/__tests__/page.test.tsx's own header: next/dynamic's
// real (ssr:false) chunk loading never settles under Vitest/jsdom, and
// MapWrapper/SplashScreen pull in Mapbox WebGL + geolocation that aren't
// needed to prove document.title.

vi.mock("next/dynamic", () => ({
  default: (factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null;
    factory().then((mod) => {
      ResolvedComponent = mod.default;
    });
    function DynamicWrapper(props: Record<string, unknown>) {
      return ResolvedComponent ? React.createElement(ResolvedComponent, props) : null;
    }
    DynamicWrapper.displayName = "DynamicWrapper";
    return DynamicWrapper;
  },
}));

// The real MapWrapper (mocked away below — Mapbox WebGL, per every other
// MapWrapper*.test.tsx's own convention) is where the home page's
// useDocumentTitle call actually lives, NOT HomePageClient.tsx — see
// MapWrapper.tsx's own comment at that call for why (keeps the i18n
// dictionary out of the route's blocking JS chunk on slow-4G phones,
// #589's coordinator note). This sentinel mock reproduces that one real
// line (real useDocumentTitle + real t()/useLocale, only the heavy map UI
// stubbed) so this test still proves the actual wiring, not just the mock.
vi.mock("@/components/MapWrapper", () => ({
  default: function MockMapWrapper() {
    const { locale } = useLocale();
    useDocumentTitle(t("app.documentTitle", locale));
    return <div data-testid="map-wrapper" />;
  },
}));
vi.mock("@/components/SplashScreen", () => ({
  default: () => (
    <div role="dialog" aria-modal="true">
      <button type="button">Find food near me</button>
    </div>
  ),
}));

import HomePage from "@/app/page";
import AboutContent from "@/components/AboutContent";
import PrivacyContent from "@/components/PrivacyContent";
import ResourcesContent from "@/components/ResourcesContent";
import FeedbackPageContent from "@/components/FeedbackPageContent";
import SuggestPageContent from "@/components/SuggestPageContent";
import VenuesDirectoryContent from "@/components/VenuesDirectoryContent";
import BoxesActivityContent from "@/components/BoxesActivityContent";
import AlertsConfirmContent from "@/components/AlertsConfirmContent";
import AlertsStopContent from "@/components/AlertsStopContent";
import ReportPageContent from "@/components/ReportPageContent";
import NotFoundContent from "@/components/NotFoundContent";
import BoxHistoryContent from "@/components/BoxHistoryContent";

// Expected document.title in Spanish per page — the literal SSR title (see
// each page.tsx's own `metadata`/`generateMetadata`, verified against a
// live `npm run dev` render) with its short title swapped for the Spanish
// dictionary value. Hardcoded rather than recomputed via pageDocumentTitle()
// so this test is a real spec against the actual production title, not a
// tautology that only checks the implementation agrees with itself.
const EXPECTED_ES = {
  home: "Pueblo Food Map — Recursos de alimentos en el Condado de Pueblo, CO",
  about: "Acerca de · Pueblo Food Map",
  privacy: "Privacidad · Pueblo Food Map",
  resources: "Programas de ayuda alimentaria · Pueblo Food Map",
  feedback: "Enviar comentarios · Pueblo Food Map",
  suggest: "Sugerir un lugar · Pueblo Food Map",
  venues: "Todos los recursos alimentarios · Pueblo Food Map",
  activity: "Actividad de las cajas de bendiciones · Pueblo Food Map",
  alertsConfirm: "Confirma tu correo · Pueblo Food Map",
  alertsStop: "Correos detenidos · Pueblo Food Map",
  report: "Reportar un problema — RMSER Community Garden · Pueblo Food Map",
  boxHistory: "Test Blessing Box — Historial · Pueblo Food Map",
  notFound: "Página no encontrada · Pueblo Food Map",
} as const;

describe("document.title follows locale (#589)", () => {
  test("/ (home)", async () => {
    await act(async () => {
      render(
        <LocaleProvider initialLocale="es">
          <HomePage />
        </LocaleProvider>,
      );
      // Flush the dynamic()-mock's Promise resolution (see mock above).
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(document.title).toBe(EXPECTED_ES.home);
  });

  test("/about", () => {
    renderEs(
      <AboutContent faqJsonLd='{"@type":"FAQPage"}' venueCount={42} publishedAt="2026-01-01T00:00:00.000Z" />,
    );
    expect(document.title).toBe(EXPECTED_ES.about);
  });

  test("/privacy", () => {
    renderEs(<PrivacyContent />);
    expect(document.title).toBe(EXPECTED_ES.privacy);
  });

  test("/resources", () => {
    renderEs(<ResourcesContent />);
    expect(document.title).toBe(EXPECTED_ES.resources);
  });

  test("/feedback", () => {
    renderEs(<FeedbackPageContent />);
    expect(document.title).toBe(EXPECTED_ES.feedback);
  });

  test("/suggest", () => {
    renderEs(<SuggestPageContent />);
    expect(document.title).toBe(EXPECTED_ES.suggest);
  });

  test("/venues", () => {
    renderEs(<VenuesDirectoryContent groups={FIXTURE_GROUPS} />);
    expect(document.title).toBe(EXPECTED_ES.venues);
  });

  test("/boxes/activity", () => {
    renderEs(<BoxesActivityContent />);
    expect(document.title).toBe(EXPECTED_ES.activity);
  });

  test("/alerts/confirm", () => {
    renderEs(<AlertsConfirmContent />);
    expect(document.title).toBe(EXPECTED_ES.alertsConfirm);
  });

  test("/alerts/stop", () => {
    // Empty token: the mount effect that POSTs to /api/public/alerts/stop
    // early-returns on a falsy token (see AlertsStopContent's own header),
    // so this needs no fetch mock and stays focused on the title alone.
    renderEs(<AlertsStopContent token="" />);
    expect(document.title).toBe(EXPECTED_ES.alertsStop);
  });

  test("/report/[venueId]", () => {
    renderEs(<ReportPageContent venue={FIXTURE_VENUE} />);
    expect(document.title).toBe(EXPECTED_ES.report);
  });

  test("/box/[id]/history", () => {
    renderEs(<BoxHistoryContent box={FIXTURE_BOX} />);
    expect(document.title).toBe(EXPECTED_ES.boxHistory);
  });

  test("404 not-found", () => {
    renderEs(<NotFoundContent />);
    expect(document.title).toBe(EXPECTED_ES.notFound);
  });
});

// Sanity check that the mechanism doesn't just always show Spanish —
// English stays the SSR title (the one thing the fix must not disturb).
describe("document.title stays English at the default locale", () => {
  test("/privacy — no LocaleProvider", () => {
    render(<PrivacyContent />);
    expect(document.title).toBe("Privacy · Pueblo Food Map");
  });

  test("/resources — no LocaleProvider", () => {
    render(<ResourcesContent />);
    expect(document.title).toBe("Food help programs · Pueblo Food Map");
  });
});
