"use client";

/**
 * MapWrapper — v2 shell composition.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Mobile·375×812·map(located)
 *       and §Desktop·1440×900·map(located)
 *
 * Layout (all viewports):
 *   <div relative h-full w-full>
 *     <Map />            — fills viewport
 *     <SearchBar />      — absolute top-center, z-index 1000 (Map/List switch inside)
 *     {isMobile && <BottomSheet />}
 *     <BottomNav />      — bar below 2xl, pill floating bottom-centre at 2xl+ (§3, §5); last in DOM
 *   </div>
 *
 * No sidebar. No category rail. No desktop split-pane.
 * Search behavior wired in PR 6: query state + searchVenues filter + EmptySearchPopover.
 * Typeahead dropdown wired in #67: SearchResultsPopover + ARIA combobox.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ROUTE_STRIP_HEIGHT_PX } from "@/components/RouteStrip";
import dynamic from "next/dynamic";
import MapLoadingFallback from "./MapLoadingFallback";
import SearchBar from "./SearchBar";
import BottomNav, { BOTTOM_NAV_HEIGHT_PX, type MenuSection } from "./BottomNav";
import FilterPanel from "./FilterPanel";
import BottomSheet from "./BottomSheet";
import EmptySearchPopover from "./EmptySearchPopover";
import ViewSuggestion from "./ViewSuggestion";
import SearchResultsPopover, {
  MAX_VISIBLE,
  type VenueWithDistance,
  optionId,
} from "./SearchResultsPopover";
import LocationHelpCard from "./LocationHelpCard";
import MapErrorBoundary from "./MapErrorBoundary";
import { useGeolocation, type LocationFailure } from "@/lib/useGeolocation";
import { useLocale } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { venues as allVenues } from "@/data/venues";
import type { Venue, VenueCategory } from "@/types/venue";
import HamburgerMenu from "./HamburgerMenu";
import HamburgerMenuContent from "./HamburgerMenuContent";
import DesktopSidePanel, {
  DESKTOP_PANEL_RIGHT_CLEARANCE_PX,
} from "./DesktopSidePanel";
import ListView from "./ListView";
import { useOverlayRegistration } from "@/lib/overlayRegistry";
import { PUEBLO_CENTER } from "@/data/pueblo-bbox";
import { useMapFilters } from "@/lib/useMapFilters";
import {
  isPointInBounds,
  isOutsideCounty,
  CATEGORY_FIT_PADDING_MOBILE,
  CATEGORY_FIT_PADDING_DESKTOP,
  CATEGORY_FIT_MAX_ZOOM,
  computeCategoryBounds,
  nearestBoundsAround,
} from "@/lib/mapBounds";
import { useWalkingRoute } from "@/lib/useWalkingRoute";
import { useBoxesList, toVenue } from "@/lib/useBoxesList";
import { useEventsFeed } from "@/lib/useEvents";
import { useEventDetail } from "@/lib/useEventDetail";
import { pinsAt, listOrder, syncEventParam, eventHereLabel } from "@/lib/eventPins";
import EventStrip from "@/components/EventStrip";
import EventsEmptyNotice from "@/components/EventsEmptyNotice";
import type { BoxStatus, CheckinKind, PublicBlessingBox } from "@/lib/blessingBoxes";
import { useMapUI, type ViewMode } from "@/lib/useMapUI";
import { useDeferredMapLoad } from "@/lib/useDeferredMapLoad";
import { track, EVENTS } from "@/lib/analytics";
import { useMediaQuery, MOBILE_QUERY, BELOW_2XL_QUERY, prefersReducedMotion } from "@/lib/useMediaQuery";
import type { SplashViewport } from "@/lib/splashGate";

// mapbox-gl must not run on the server (uses WebGL + globalThis) — keep the
// dynamic import here in a Client Component as required by Next.js 16
// (ssr:false only works in Client Components per the lazy-loading doc).
// Wrapping MapLoadingFallback in an arrow function satisfies the
// DynamicOptionsLoadingProps signature while still rendering the locale-aware
// component (which reads locale from LocaleContext internally).
const MapCanvas = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => <MapLoadingFallback />,
});

// perf(#588): DesktopVenueWindow only ever renders when `!isMobile &&
// viewMode === "map" && selectedVenue` (see its JSX below) — on the mobile
// viewport this whole app targets first, that condition is never true, so a
// plain top-level import still shipped ~800 lines of desktop-only markup
// (DesktopVenueWindow.tsx + VenuePopupHeader.tsx) into every mobile visitor's
// synchronous MapWrapper chunk for code that never mounts. Same next/dynamic
// pattern as MapCanvas above, minus a loading fallback (see the
// desktopWindowPrefetched effect below, near `isMobile`, for why): the JSX is
// already conditionally rendered, so the fetch only fires when a desktop
// user actually selects a venue (not on MapWrapper mount) — mobile visitors
// never trigger the import at all.
const DesktopVenueWindow = dynamic(() => import("./DesktopVenueWindow"), {
  ssr: false,
});

// The desktop event card (#759): same lazy rule, so a visitor who never opens
// an event downloads none of it (the phone sheet loads EventCardBody itself).
const EventPanel = dynamic(() => import("./EventPanel"), { ssr: false });

/**
 * The desktop side panel's single render driver (#682 8b — coordinator:
 * "MapWrapper owns one desktop sidePanelView union ... replacing separate
 * venue-selected/menu-open desktop states"). Desktop-only; mobile keeps its
 * existing `selectedVenueId`/`menuSection` flow untouched. `selectedVenueId`
 * itself stays the map's own ground truth (pins, walking route, box fetch,
 * deep links) for BOTH platforms — this union only decides what the PANEL
 * currently shows, kept in sync with `selectedVenueId` at every selection
 * call site (see `selectVenue`) rather than via a separate sync effect.
 * `from: "saved"` is set only when a venue is opened from the Saved list, so
 * the panel can render a "← Saved" link back to it.
 */
export type DesktopSidePanelView =
  | { kind: "venue"; id: string; from?: "saved" }
  | { kind: "saved" }
  | { kind: "menu" }
  | null;

// Guided tour (#159) — fetched only when a tour starts (it renders only
// while `tour` is non-null below), so its code and its EN/ES step copy never
// touch a visitor's first load. Same pattern as DesktopVenueWindow above.
const GuidedTour = dynamic(() => import("./GuidedTour"), { ssr: false });

/** What a running tour must give back when it ends (#159). */
interface TourSession {
  /** Where focus returns when the tour ends: the Menu nav button, or the map container (splash). */
  returnFocusSelector: string;
  prevSelectedId: string | null;
  prevViewMode: ViewMode;
  sampleVenue: Venue | null;
  /** The nearest live Blessing Box, for the box steps; null drops those steps. */
  sampleBox: Venue | null;
  /**
   * The visitor's filters, lifted for the tour: with Open now on at night (or
   * SNAP/WIC) the search demo could find nothing, and the Filters step must
   * show every switch off. Handed back in endTour.
   */
  prevFilters: {
    categories: Set<VenueCategory> | null;
    openNow: boolean;
    snap: boolean;
    wic: boolean;
    events: boolean;
  };
}

// Padding (px) around a walking-route fitBounds (#509) — mobile (BottomSheet)
// only, since the route strip is a phone-only concept (desktop's
// DesktopVenueWindow keeps its own unchanged layout, out of scope for #509).
// `bottom` clears the route strip (ROUTE_STRIP_HEIGHT_PX, shared with
// RouteStrip.tsx/BottomSheet.tsx so the two can't drift) PLUS
// BOTTOM_NAV_HEIGHT_PX. #531 (Kyle, 2026-09-19) added the nav term because
// the bar stayed visible underneath the strip back then; #547 (Kyle,
// 2026-09-20) reverses that — the nav now hides for the whole time a route
// is on screen (see `venueSheetOpen` below), so this term is conservative
// slack rather than a real clearance need. Left in: it only fits the route
// a little smaller than strictly necessary, never overlapping anything, and
// removing it isn't part of #547's ask. Plus a small gap.
// Deliberately NOT capped at CATEGORY_FIT_MAX_ZOOM=14 — that cap exists so a
// sparse category's 2-3 far-apart venues don't slam to street level; a
// walking route is usually well under a mile and WANTS a close, walkable
// zoom. ROUTE_FIT_MAX_ZOOM caps only the opposite failure (an extremely
// short route zooming in absurdly far).
export const ROUTE_FIT_PADDING_MOBILE = {
  top: 80,
  bottom: ROUTE_STRIP_HEIGHT_PX + BOTTOM_NAV_HEIGHT_PX + 24,
  left: 40,
  right: 40,
};
export const ROUTE_FIT_MAX_ZOOM = 17;

// Stable listbox id — used for aria-controls on the search input and id on the
// results listbox. The old category-browse listbox (CategoryDropdown, #95)
// was removed by #513 — search focus no longer opens a category list; the
// Filters panel is a dialog, not a combobox popup. #514 gave empty focus a
// new (non-listbox) popup instead: ViewSuggestion, a single button offering
// the other view — see showViewSuggestion below.
const LISTBOX_ID = "search-results-listbox";


// ─── MapWrapper ───────────────────────────────────────────────────────────────

interface MapWrapperProps {
  /** Optional: viewport mode from splash gate (PR 3). Defaults to 'pueblo-center'. */
  viewport?: SplashViewport;
  /**
   * Why the splash's "Find food near me" produced no position (#739). Set →
   * show LocationHelpCard on arrival. A prop because the splash runs its own
   * geolocation hook: this component's geo.state never sees that failure.
   */
  splashLocationFailure?: LocationFailure | null;
  /**
   * Called when the user activates "Show welcome screen" from the hamburger
   * menu (#99). Re-shows the SplashScreen WITHOUT clearing localStorage.
   */
  onShowWelcome?: () => void;
  /** Deep link (#132): venue id from a ?venue=<id> URL to open on load. */
  initialVenueId?: string | null;
  /** Deep link (#758): event id from a ?event=<id> URL; that star pin starts selected. */
  initialEventId?: string | null;
  /**
   * Boxes (#516): true when the resident arrived via a Menu page's "Boxes"
   * link (/?boxes=1, read once by HomePageClient). Applies the blessing_box
   * category filter on mount, the same one-shot shape `viewport === 'located'`
   * uses for auto-locate below.
   */
  initialBoxesFilter?: boolean;
  /**
   * Splash gate (#588): true while HomePageClient is showing the welcome
   * splash to a first-time visitor. Passed straight through to
   * useDeferredMapLoad's `hold` param — see that hook's module doc. Defaults
   * to false (today's unconditional idle-deferred load) for every other
   * caller: deep links, returning visitors, and every existing test in this
   * file that doesn't pass it.
   */
  holdMapLoad?: boolean;
  /**
   * Guided tour (#159): each new non-zero value starts the tour — bumped by
   * HomePageClient for the splash's "Take a tour" button and /?tour=1.
   */
  tourRequestId?: number;
}

export default function MapWrapper({
  viewport = 'pueblo-center',
  splashLocationFailure = null,
  onShowWelcome,
  initialVenueId,
  initialEventId = null,
  initialBoxesFilter = false,
  holdMapLoad = false,
  tourRequestId = 0,
}: MapWrapperProps) {
  // ── Locale — from context ─────────────────────────────────────────────────────
  const { locale } = useLocale();
  // <title> follows locale client-side (#589) — app.documentTitle holds the
  // FULL title per locale (the one page whose SSR title, set in page.tsx,
  // isn't run through layout.tsx's "%s · Pueblo Food Map" template — see
  // that key's own comment in i18n.ts). Called HERE rather than in
  // HomePageClient.tsx (the component that actually mounts this one) on
  // purpose: HomePageClient is the route's synchronous, always-blocking
  // client bundle (#202 dynamic()-imports this file specifically to keep
  // it out of that bundle on low-end/slow-4G phones); MapWrapper already
  // pulls in the full i18n dictionary for its own UI, so putting the title
  // call here costs nothing extra and keeps that dictionary out of the
  // blocking chunk. MapWrapper is unconditionally rendered whenever
  // HomePageClient renders anything real (splash is an overlay ON TOP of
  // the always-mounted map, never a replacement for it — see that file's
  // own header), so this fires exactly when the home page's title needs it.
  useDocumentTitle(t("app.documentTitle", locale));

  // ── Geolocation — v2 hook ────────────────────────────────────────────────────
  const geo = useGeolocation();
  // Prefer the user's real position if available; fall back to null which will
  // resolve to PUEBLO_CENTER in the origin derivation below.
  const userLocation = geo.state.position;

  // ── UI / selection state — extracted hook ────────────────────────────────────
  const {
    selectedVenueId,
    setSelectedVenueId,
    selectedEventId,
    setSelectedEventId,
    viewMode,
    setViewMode,
    mapUnavailable,
    mapUnavailableReason,
    handleMapError,
    showVenueOnMap,
    mapboxMap,
    setMapboxMap,
  } = useMapUI(initialEventId);

  // ── Deferred map load (#226, held behind the splash by #588) ────────────────
  // Perf: mapbox-gl is a large WebGL payload that used to fire the instant
  // MapWrapper mounted (the dynamic import factory runs on first render of
  // <MapCanvas>, not on interaction) — it dominated the mobile Lighthouse
  // performance audit. eager=true whenever a venue deep link is present so a
  // shared link (?venue=/#venue=) still opens on its pin immediately; see the
  // hook doc for the idle/interaction triggers that fire otherwise. While
  // false, the render below shows ListView in the map's place instead of
  // mounting <MapCanvas> — same absolute-fill box, so there is no layout shift
  // when the swap happens. holdMapLoad (#588) suppresses only the automatic
  // idle/timeout trigger while a first-time visitor's splash is up — see
  // useDeferredMapLoad's module doc for why the interaction listeners stay
  // live regardless (a real splash-CTA tap still starts the load right away).
  // A shared event link (?event=<id>) is eager too (#759): it skips the splash
  // exactly like ?venue= (splashGate.ts), so there is no splash hold to protect
  // and the star pin should be on screen at once.
  const mapLoadTriggered = useDeferredMapLoad(Boolean(initialVenueId) || Boolean(initialEventId), holdMapLoad);

  // ── Location help card (#739; replaced PR 7's denied-only banner) ───────────
  // Explains a locate attempt that gave no position, so the visitor isn't left
  // on the Pueblo-center map wondering. Shows after a USER-initiated attempt
  // fails — never on plain page load, even when the Permissions API already
  // reports "denied" (nothing was tapped, so nothing to explain):
  //   - the splash CTA failed → splashLocationFailure prop (effect below);
  //   - a "Near me" tap failed, "denied" OR "failed" (#738) → the geo.state
  //     effect below, gated on a fresh request via the timestamp refs.
  // Hidden by: the card's X/Escape/list button, a successful locate, a venue
  // opening (the sheet takes the card's space).
  const [locationFailure, setLocationFailure] = useState<LocationFailure | null>(null);
  const userRequestedAtRef = useRef<number>(0);   // epoch ms of last user-initiated request
  const failureShownAtRef  = useRef<number>(0);   // epoch ms of last time the card was shown

  useEffect(() => {
    const p = geo.state.permission;
    if (
      (p === "denied" || p === "failed") &&
      userRequestedAtRef.current > failureShownAtRef.current
    ) {
      setLocationFailure(geo.state);
      failureShownAtRef.current = Date.now();
    } else if (p === "granted" && geo.state.position !== null) {
      // A successful (re)try — the map is about to centre on the visitor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocationFailure(null);
    }
    // Depend on geo.state (object reference) rather than just permission:
    // useGeolocation always creates a new state object on each setState call,
    // so this effect fires even when permission stays "denied"/"failed" across retries.
  }, [geo.state]);

  // Mirror the splash's latest outcome in both directions: a failure shows the
  // card, and a later successful splash (prop back to null) clears it. Clearing
  // can't be left to the geo.state effect: autoLocateDoneRef only re-locates
  // once per session, so a reopened splash that succeeds never produces the
  // granted state that would hide a stale card (PR #741 review). Deferred out
  // of the effect body (set-state-in-effect lint rule), like autoLocate below.
  useEffect(() => {
    queueMicrotask(() => setLocationFailure(splashLocationFailure));
  }, [splashLocationFailure]);

  // ── Explicit recenter counter — incremented on each user-initiated locate tap ──
  // Map.tsx's flyTo effect depends on this value so the map re-centers every
  // time the user taps "Near me", not just on the first geolocation event. (#60)
  const [recenterRequestId, setRecenterRequestId] = useState(0);

  // ── Locating state — true while a geo request is in flight (#108) ────────────
  // Rendered by BottomNav's "Near me" item as its spinner state.
  const [isLocating, setIsLocating] = useState(false);
  // geoRequestedAtRef: epoch ms of last in-flight locate request (ref, not state,
  // so the useEffect below doesn't depend on isLocating itself).
  const geoRequestedAtRef = useRef<number>(0);
  const loadingClearedAtRef = useRef<number>(0); // epoch ms of last time spinner was cleared

  // ── Drift detection (#108) ───────────────────────────────────────────────────
  // isDrifted: true when the user-location dot has left the visible viewport.
  const [isDrifted, setIsDrifted] = useState(false);

  // ── Outside-county message (#108) ────────────────────────────────────────────
  const [outsideCountyVisible, setOutsideCountyVisible] = useState(false);

  // Wraps geo.request() to stamp the request timestamp and increment the
  // recenter counter so Map.tsx re-centers even if userLocation hasn't changed.
  //
  // WHY declared here (moved up from its original spot near handleMoveEnd):
  // useWalkingRoute below (#207) also calls this to request location when a
  // Walk tap has none, instead of falling back to PUEBLO_CENTER.
  const handleLocateRequest = useCallback(() => {
    userRequestedAtRef.current = Date.now();
    setRecenterRequestId((n) => n + 1);
    setOutsideCountyVisible(false);

    const alreadyLocated =
      geo.state.permission === "granted" && geo.state.position !== null;
    if (!alreadyLocated) {
      geoRequestedAtRef.current = Date.now();
      setIsLocating(true);
    } else {
      // Already located — this is a Re-center tap; clear drift immediately
      setIsDrifted(false);
    }
    geo.request();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.request, geo.state]);

  // #739: the bottom sheet takes the location card's space; dismiss (not
  // just hide) so it doesn't pop back when the sheet closes.
  useEffect(() => {
    if (selectedVenueId !== null) queueMicrotask(() => setLocationFailure(null));
  }, [selectedVenueId]);

  /**
   * Refreshes the user's location on each step-through arrow tap (#555)
   * WITHOUT bumping recenterRequestId. handleLocateRequest's own counter
   * bump is what makes Map.tsx fly the camera to the USER — reusing it here
   * would fight the flyTo-the-turn move the same tap just triggered via
   * focusRequestId (useWalkingRoute's stepTo). Only the "ask the browser for
   * a fresh reading" half of handleLocateRequest is shared; the camera stays
   * owned by the turn the stepper is on. Mirrors handleLocateRequest's own
   * "already located" guard so a tap doesn't flip the spinner on when the
   * position is already known (the overwhelmingly common case here, since a
   * route can't be active without a resolved position in the first place).
   */
  const requestStepLocationRefresh = useCallback(() => {
    const alreadyLocated =
      geo.state.permission === "granted" && geo.state.position !== null;
    if (!alreadyLocated) {
      geoRequestedAtRef.current = Date.now();
      setIsLocating(true);
    }
    geo.request();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.request, geo.state]);

  // ── Blessing boxes (slice 1, map-first rework 2026-09-18) — live layer,
  // fetched ONCE client-side (useBoxesList's full PublicBlessingBox shape,
  // stripped to plain Venues by its toVenue for the pins) and merged into
  // the same filter/count/marker
  // pipeline every other venue flows through (useMapFilters' own header
  // explains why). boxIdSet lets the mapUnavailable deep-link effect below
  // tell "this id is a box" apart from an unknown id with one Set lookup —
  // a box click (map or list, mapUnavailable or not) opens the SAME in-map
  // card every other venue uses (just with BoxCardBody content), never a
  // separate page (#524).
  // boxesById/boxOverrides let the open card show the box's full record
  // (status, host note, most-needed, check-ins) that the plain Venue shape
  // doesn't carry, and stay current after a check-in without a refetch.
  // WHY declared THIS early (2026-09-18 fix): the walking route's findVenue
  // below reads boxVenues in its own body and dependency array — a dependency
  // array is evaluated during THIS render pass, not deferred like an effect
  // body, so boxVenues must already be a assigned `const` by the time
  // JS execution reaches that array literal, or it's a ReferenceError
  // (temporal dead zone), not merely stale data. Caught by
  // MapWrapperBoxSelection.test.tsx failing with exactly that error.
  const { boxes: liveBoxes, loading: liveBoxesLoading } = useBoxesList();
  const boxVenues = useMemo(() => liveBoxes.map(toVenue), [liveBoxes]);
  const boxIdSet = useMemo(() => new Set(liveBoxes.map((b) => b.id)), [liveBoxes]);
  const boxesById = useMemo(() => new Map(liveBoxes.map((b) => [b.id, b])), [liveBoxes]);
  // Check-in success patches (kind/status/lastFilledAt) so the open card
  // reflects the just-submitted check-in immediately — see
  // handleBoxCheckinSuccess below. getBoxById checks this map FIRST, so an
  // override always wins over boxesById while it exists.
  //
  // Nothing clears an override today: useBoxesList() fetches exactly once on
  // mount (empty effect deps — see its own header) and never refetches, so
  // there is no later "fresh fetch" that could supersede a stale override.
  // ponytail: an override can drift from reality if the box changes by some
  // OTHER path in the same session (another tab's check-in, an admin edit).
  // Ceiling: acceptable today because nothing refetches to reconcile against.
  // If a periodic/background refetch of liveBoxes is ever added, this map
  // must be explicitly cleared or merged against the fresh data at that
  // point, or the override will permanently shadow it.
  const [boxOverrides, setBoxOverrides] = useState<Map<string, PublicBlessingBox>>(new Map());
  const getBoxById = useCallback(
    (id: string | null): PublicBlessingBox | null => {
      if (!id) return null;
      return boxOverrides.get(id) ?? boxesById.get(id) ?? null;
    },
    [boxOverrides, boxesById],
  );
  const handleBoxCheckinSuccess = useCallback(
    (boxId: string | null, result: { status: BoxStatus; lastFilledAt: string | null; kind: CheckinKind }) => {
      if (!boxId) return;
      setBoxOverrides((prev) => {
        const current = prev.get(boxId) ?? boxesById.get(boxId);
        if (!current) return prev;
        const next = new Map(prev);
        next.set(boxId, {
          ...current,
          box: {
            ...current.box,
            status: result.status,
            lastFilledAt: result.lastFilledAt,
            // Cap at 5 — the card only ever shows recentCheckins[0], and
            // BoxActivityList/history reads its own separate query, not
            // this in-memory list; keeping a handful avoids unbounded growth
            // across many check-ins in one page view.
            //
            // "problem" is skipped here, not just narrowly typed away: a
            // problem report is admin-only (PublicCheckinEvent's own kind
            // union excludes it — see blessingBoxes.ts's toPublicCheckinEvents,
            // the same structural privacy rule this in-memory patch must not
            // undermine) and never sets status (computeBoxStatus excludes it
            // too), so there is nothing for a problem submission to update on
            // the open card besides this optimistic list — correctly, nothing.
            recentCheckins:
              result.kind === "problem"
                ? current.box.recentCheckins
                : [
                    { kind: result.kind, createdAt: new Date().toISOString() },
                    ...current.box.recentCheckins,
                  ].slice(0, 5),
          },
        });
        return next;
      });
    },
    [boxesById],
  );

  // Watch geo.state for resolution of an in-flight locate request.
  // Mirrors the location-card effect above: use refs (not isLocating state)
  // as the gate so this effect never depends on the state it sets.
  useEffect(() => {
    if (geo.state.permission === "prompt") return;
    if (geoRequestedAtRef.current <= loadingClearedAtRef.current) return;
    // Geo request resolved — clear locating spinner and check outside-county
    loadingClearedAtRef.current = Date.now();
    setIsLocating(false);
    if (geo.state.permission === "granted" && geo.state.position !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOutsideCountyVisible(isOutsideCounty(geo.state.position));
    }
  // Only re-run when geo.state (object ref) changes — same pattern as the location-card effect.
  }, [geo.state]);

  // ── Walking route (#134, #207, #555) — see useWalkingRoute's header ────────
  // findVenue covers boxes too: a box card's address is its own Walk trigger.
  const findWalkVenue = useCallback(
    (id: string) => allVenues.find((v) => v.id === id) ?? boxVenues.find((v) => v.id === id),
    [boxVenues],
  );
  const {
    route: walkingRoute,
    routeVenueId: walkingRouteVenueId,
    focusPoint,
    focusRequestId,
    walkFor,
  } = useWalkingRoute({
    locale,
    userLocation,
    geoState: geo.state,
    selectedVenueId,
    requestLocation: handleLocateRequest,
    refreshLocation: requestStepLocationRefresh,
    findVenue: findWalkVenue,
  });

  // Handle map moveend: update drift state (called from Map's onMoveEnd prop).
  // Runs from a DOM event callback, not from a React effect.
  const handleMoveEnd = useCallback(
    (bounds: mapboxgl.LngLatBounds) => {
      const pos = geo.state.permission === "granted" ? geo.state.position : null;
      if (!pos) {
        setIsDrifted(false);
        return;
      }
      setIsDrifted(!isPointInBounds(pos, bounds));
    },
    [geo.state],
  );

  // ── Splash "Find food near me" → auto-locate on entry ─────────────────────────
  // The user enters the map via the splash CTA, which sets viewport='located'
  // (only after the splash's own geo grant). SplashScreen and MapWrapper use
  // SEPARATE useGeolocation instances, so the map starts with no position — which
  // is why a second "recenter" tap used to be needed. Run the locate flow once
  // here so the map centers on the user immediately; permission is already
  // granted, so getCurrentPosition resolves without re-prompting.
  const autoLocateDoneRef = useRef(false);
  useEffect(() => {
    if (viewport !== 'located') return;
    if (autoLocateDoneRef.current) return;
    autoLocateDoneRef.current = true;
    // Defer out of the effect body (set-state-in-effect lint rule).
    queueMicrotask(() => handleLocateRequest());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport]);

  // ── Breakpoints ──────────────────────────────────────────────────────────────
  // isMobile (<768): BottomSheet instead of DesktopVenueWindow.
  // isBelow2xl (<1536): the bottom nav is a bar covering the map's bottom edge.
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isBelow2xl = useMediaQuery(BELOW_2XL_QUERY);

  // #682 — whether the desktop side panel is currently open, kept in a ref
  // (declared here, before `selectedVenue` exists) so the category fit-bounds
  // effect further down — which runs before `selectedVenue` is computed in
  // source order — can read its CURRENT value without becoming a dependency.
  // The boolean itself is computed and synced into this ref near
  // `venueSheetOpen` below, once `selectedVenue` is available.
  const desktopPanelOpenRef = useRef(false);

  // perf(#588) — warm DesktopVenueWindow's chunk as soon as desktop layout is
  // known, well before any venue is selected. Reviewer note on the code-split
  // above: the dynamic() call has no `loading` fallback (unlike MapCanvas's
  // MapLoadingFallback) because DesktopSidePanel (the fixed shell it renders
  // inside, #682) already has a fixed size/position with no content-derived
  // measurement — a placeholder would just be an empty panel flash, not worth
  // a dedicated loading component. Prefetching here instead means the module
  // is normally already cached by the time a user actually clicks a pin
  // (search, pan, hover — every desktop session does several other things
  // first), so the "click does nothing for a beat" gap the reviewer flagged
  // is rare in practice rather than eliminated outright.
  const desktopWindowPrefetched = useRef(false);
  useEffect(() => {
    if (isMobile || desktopWindowPrefetched.current) return;
    desktopWindowPrefetched.current = true;
    void import("./DesktopVenueWindow");
  }, [isMobile]);

  // ── Drawer (HamburgerMenu) — opened from BottomNav at a section (spec §7) ────
  // `menuSection` stays the mobile-only state it always was — mobile's
  // HamburgerMenu is unchanged by #682 8b. `sidePanelView` is the NEW
  // desktop-only union (#682 8b) that replaces desktop's own read of
  // `menuSection` — see `selectVenue` above for the venue half, and
  // `handleNavSectionTap`/`closeDesktopPanel` below for the Saved/Menu half.
  const [menuSection, setMenuSection] = useState<MenuSection | null>(null);
  const [sidePanelView, setSidePanelView] = useState<DesktopSidePanelView>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const handleNavSectionTap = useCallback(
    (section: MenuSection) => {
      if (isMobile) {
        // Tapping the open section's own item closes it; any other item re-targets.
        setMenuSection((current) => (current === section ? null : section));
        return;
      }
      const kind: "saved" | "menu" = section === "saved" ? "saved" : "menu";
      setSidePanelView((current) => (current?.kind === kind ? null : { kind }));
      // Switching to Saved/Menu on desktop always drops any open venue card
      // — the panel now shows a different view, so the pin highlight and
      // any walking route should clear with it (judgment call flagged in
      // the coder's report; useWalkingRoute's selection effect already
      // clears a stale route once this fires).
      setSelectedVenueId(null);
      setSelectedEventId(null); // the panel now shows a different view (#759)
    },
    [isMobile, setSelectedVenueId, setSelectedEventId],
  );
  const handleMenuClose = useCallback(() => setMenuSection(null), []);
  // Closes whatever the desktop panel is showing (#682 8b) — Escape, the
  // panel's ✕, and re-clicking a lit bar item (handled above instead) all
  // route through this. A REAL close, full stop: the panel closes, the
  // venue (if any) deselects, and any walking route clears with it — same
  // as closing an ordinary card. "← Saved" is a separate, deliberate
  // BACK control (see `backToSaved` below), not a close — coordinator
  // correction after PR #688 review: an earlier version of this function
  // special-cased "opened from Saved" to go back to the list instead of
  // closing, which meant ✕/Escape on such a card couldn't fully close it
  // at all. Kept deliberately plain (no branching) so it stays obviously
  // correct for every view.
  const closeDesktopPanel = useCallback(() => {
    setSidePanelView(null);
    setSelectedVenueId(null);
    setSelectedEventId(null); // the event card shares this panel (#759)
  }, [setSelectedVenueId, setSelectedEventId]);

  // "← Saved" (#682 8b) — the back-link on a venue card opened FROM the
  // Saved list. A pure navigation within the panel, not a close: the venue
  // stays selected (pin highlight, walking route) exactly as it would if
  // the user had merely switched tabs, since going back to Saved has
  // nothing to do with what's selected on the map.
  const backToSaved = useCallback(() => {
    setSidePanelView({ kind: "saved" });
  }, []);

  // Single choke point for "a venue got selected" on desktop (#682 8b,
  // coordinator: "MapWrapper owns one desktop sidePanelView union ...
  // replacing separate venue-selected/menu-open desktop states"). Every
  // selection path (pin click, search, saved-list, deep link, Enter-to-
  // select) routes through this so `sidePanelView` (the panel's OWN render
  // driver on desktop) can never drift out of sync with `selectedVenueId`
  // (the map's ground truth — pins, walking route, box fetch, deep links —
  // which stays independent and unchanged for BOTH platforms; an
  // effect-sync was rejected instead of this shared setter after hitting a
  // real isMobile-starts-false race with a similar effect earlier in #682 —
  // see MapWrapper's pan-on-select effect). `from` is set ONLY by the
  // Saved-list selection path, so the panel can render a "← Saved" link back.
  // Declared here (early), not beside its call sites further down, because
  // the `initialVenueId` deep-link effects below also need it and `const`
  // bindings can't be read before their declaration.
  const selectVenue = useCallback(
    (id: string, from?: "saved") => {
      setSelectedVenueId(id);
      setSelectedEventId(null); // one selection at a time (#758)
      if (!isMobile) {
        setSidePanelView({ kind: "venue", id, from });
      }
    },
    [isMobile, setSelectedVenueId, setSelectedEventId],
  );

  // ── Special events (#758) ───────────────────────────────────────────────────
  // Live feed, fetched once like boxes. Selecting an event pin selects and
  // centers it and opens its card (#759): it drops any open place card so the
  // two selections never show at once, and the id is mirrored into ?event=<id>
  // (replace, never push) so the address bar always names the selected event.
  // Deselecting (null) removes the parameter. syncEventParam is a no-op when
  // the URL already agrees, which keeps a shared link's own ?event= intact on
  // the first render.
  // `eventsLoaded` (#759) tells useEventDetail when the feed has answered
  // without a shared link's id, so the single-event read is made only for an
  // event that has ended or been cancelled.
  const { events, loaded: eventsLoaded } = useEventsFeed();
  const selectEvent = useCallback(
    (id: string | null) => {
      setSelectedEventId(id);
      if (id !== null) {
        setSelectedVenueId(null);
        // The event card takes the desktop panel over (#759): drop the venue
        // card, Saved or Menu view it replaces.
        if (!isMobile) setSidePanelView(null);
      }
    },
    [isMobile, setSelectedEventId, setSelectedVenueId],
  );
  useEffect(() => {
    syncEventParam(selectedEventId);
  }, [selectedEventId]);

  // ── Origin — user position or Pueblo center fallback ─────────────────────────
  const origin = userLocation ?? PUEBLO_CENTER;

  // ── Filter pipeline — extracted hook (testable independently of map render) ──
  const {
    query,
    setQuery,
    commitSearch,
    setSearchTrackingPaused,
    selectedCategories,
    setSelectedCategories,
    filterOpenNow,
    setFilterOpenNow,
    filterSnap,
    setFilterSnap,
    filterWic,
    setFilterWic,
    filterEvents,
    setFilterEvents,
    venuesWithDistance,
    filteredVenues,
    savedVenues,
    anyFilterActive,
    openNowCount,
    snapCount,
    wicCount,
    toggleCategory,
    clearFilters,
    handleClearAllFilters,
  } = useMapFilters(origin, boxVenues);

  // ── Boxes (#516) — bottom-nav shortcut for the blessing-box category filter.
  // Reuses toggleCategory directly rather than a second flag, so ticking
  // "Blessing Box" in the Filters panel (#513) and tapping Boxes in the bar
  // stay in sync automatically — both read/write the same Set.
  //
  // #670 — one-shot override for the category-fit effect below (the
  // `selectedCategories` effect just past the Route-fit effect). Turning
  // Boxes ON with an already-known `userLocation` should fit the visitor's
  // nearest 5 boxes instead of that effect's normal "fit every venue in the
  // checked categories" bounds. A ref (not state) because it's read and
  // cleared inside that OTHER effect on the very next run it fires for —
  // it's a hand-off between this callback and that effect, not something a
  // render needs to reflect. Left null (the default, no override) for:
  // turning Boxes OFF, turning it on with no known location (never triggers
  // the geolocation prompt — Near me already owns that), or the Filters
  // panel's own checkbox (which calls toggleCategory directly, bypassing
  // this handler, so it keeps today's fit-all).
  const pendingBoxesFitBoundsRef = useRef<
    [[number, number], [number, number]] | null
  >(null);
  const handleBoxesToggle = useCallback(() => {
    const turningOn = !selectedCategories?.has("blessing_box");
    if (turningOn && userLocation) {
      pendingBoxesFitBoundsRef.current = nearestBoundsAround(userLocation, boxVenues, 5);
    }
    toggleCategory("blessing_box");
  }, [toggleCategory, selectedCategories, userLocation, boxVenues]);

  // ── PageNav "Boxes" (#516) → apply the filter on entry ───────────────────────
  // Same one-shot shape as the auto-locate effect above: a Menu page has no
  // filter state of its own, so it hands off via /?boxes=1 and this effect
  // applies the real filter once the map (and toggleCategory) exist.
  // #670: same nearest-5 override as handleBoxesToggle above, keyed off
  // whatever `userLocation` already resolved to at this moment — per the
  // issue, a hand-off arriving before geolocation resolves must NOT wait on
  // it, so an unresolved userLocation here just falls through to the
  // existing fit-all behavior.
  const initialBoxesFilterDoneRef = useRef(false);
  useEffect(() => {
    if (!initialBoxesFilter) return;
    if (initialBoxesFilterDoneRef.current) return;
    initialBoxesFilterDoneRef.current = true;
    if (userLocation) {
      pendingBoxesFitBoundsRef.current = nearestBoundsAround(userLocation, boxVenues, 5);
    }
    toggleCategory("blessing_box");
  }, [initialBoxesFilter, toggleCategory, userLocation, boxVenues]);

  // ── Filters panel (#513) — the side panel behind SearchBar's Filters button.
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  // Spoken/visible count on the Filters button's badge: every independent
  // filter counts once — the proof step in #513 ("two kinds + Open now →
  // badge 3") is per-item, not per-group, so a multi-category selection
  // contributes its full size, not a flat 1.
  const activeFilterCount =
    (selectedCategories?.size ?? 0) +
    (filterOpenNow ? 1 : 0) +
    (filterSnap ? 1 : 0) +
    (filterWic ? 1 : 0) +
    (filterEvents ? 1 : 0);

  // Events still to come, for the Filters panel's Events row and its footer
  // count (#761). Only read while the panel is open (it renders nothing
  // otherwise), which keeps MapWrapper off the minute clock: the strip and the
  // list each subscribe to it themselves.
  // Judged at render time from the wall clock, like eventHereFor below.
  const upcomingEventCount = () =>
    // eslint-disable-next-line react-hooks/purity -- wall clock on purpose; see above
    listOrder(events, Date.now()).length;
  const filterEventsCount = filterPanelOpen ? upcomingEventCount() : 0;

  // ── Typeahead popover state (issue #67) ──────────────────────────────────────
  // isPopoverOpen: true when input is focused + query is non-empty + matches exist.
  // activeIndex: keyboard-highlighted row (-1 = none).
  // blurTimerRef: grace timer so mousedown-inside-popover doesn't lose the click.
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Guided tour session (#159) — the tour's own logic sits with startTour
  // below; declared up here because the outside-press effect needs it.
  const [tour, setTour] = useState<TourSession | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // searchAreaRef: wraps SearchBar + ViewSuggestion + SearchResultsPopover
  // (display:contents — adds no box, purely a containment check target).
  // Keyboard-a11y fix (reviewer, PR #522): blur needs to tell "focus moved to
  // one of our own popover rows" (Tab) apart from "focus left the group
  // entirely" (Tab past the last row, or click elsewhere) — relatedTarget
  // containment answers that; a blind timer can't.
  const searchAreaRef = useRef<HTMLDivElement>(null);

  // ── Deep link (#132) ──────────────────────────────────────────────────────────
  // Opened with ?venue=<id> → select that venue once the map is ready to fly.
  // Waiting for mapboxMap ensures the selected-venue flyTo (Map.tsx) actually
  // centers, instead of firing before the map has loaded.
  const deepLinkDoneRef = useRef(false);
  useEffect(() => {
    if (deepLinkDoneRef.current) return;
    if (!mapboxMap) return; // wait until the map can fly
    deepLinkDoneRef.current = true;
    // No existence check against allVenues/boxVenues here (map-first rework,
    // 2026-09-18) — a box's data arrives async from useBoxesList, so an
    // existence check at this exact instant could reject a valid box id
    // before its fetch resolves. selectedVenue's own lookup (below) and
    // getBoxById both gracefully return null/undefined for an unknown id,
    // and Map.tsx's flyTo effect re-fires once `venues`/liveBoxes populate
    // (new array reference) — so there's nothing here to guard against.
    if (initialVenueId) {
      queueMicrotask(() => selectVenue(initialVenueId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxMap]);

  // mapUnavailable variant of the deep link above (review item 4): when the
  // map can't mount, Map.tsx never renders, so mapboxMap stays null forever
  // and the effect above never fires — a shared `/?venue=<id>` link silently
  // selected nothing (PageNav's saved-venue links reuse this same query
  // param). #524 fix: this used to router.replace to the venue/box detail
  // page instead (losing check-in/adopt/address for a box); it now just
  // selects the id directly, same as the mapboxMap-ready branch above — the
  // render guards below open BottomSheet/DesktopVenueWindow on
  // selectedVenueId whenever mapUnavailable, regardless of viewMode. Shares
  // deepLinkDoneRef so whichever branch resolves first (map ready vs. map
  // unavailable — mutually exclusive in practice) wins, never both.
  //
  // WHY this waits on liveBoxesLoading (2026-09-18 fix, found by
  // MapWrapperBoxSelection.test.tsx): mapUnavailable can flip true in the
  // SAME tick useBoxesList's fetch is still in flight, so boxIdSet can still
  // be empty the first (and, before this fix, only — deepLinkDoneRef made it
  // one-shot) time this effect runs. allVenues is a static, always-ready
  // array, so a plain-venue id still resolves instantly on the first pass;
  // only the box case needs to wait for the fetch to settle before this
  // effect is allowed to give up and mark itself done.
  useEffect(() => {
    if (deepLinkDoneRef.current) return;
    if (!mapUnavailable) return; // starts false; flips in a client effect (#165)
    if (!initialVenueId) {
      deepLinkDoneRef.current = true;
      return;
    }
    if (allVenues.some((v) => v.id === initialVenueId) || boxIdSet.has(initialVenueId)) {
      deepLinkDoneRef.current = true;
      // Deferred (react-hooks/set-state-in-effect, same convention the
      // mapboxMap-ready branch above already uses): a raw setState call
      // here passes that lint rule directly, but `selectVenue` — a plain
      // function wrapping multiple setState calls — reads as "might
      // synchronously setState" to its static check.
      queueMicrotask(() => selectVenue(initialVenueId));
      return;
    }
    if (liveBoxesLoading) return; // could still resolve to a box — wait
    deepLinkDoneRef.current = true; // genuinely unknown id — no redirect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapUnavailable, boxIdSet, liveBoxesLoading]);

  // ── Category autozoom (#111, generalized to multi-select by #513) ───────────
  // When one or more categories are checked in the Filters panel, fit the map
  // to the UNION of venues across every checked category. When the user
  // CLEARS every category, return to the all-venues overview.
  //
  // Fires after `selectedCategories` or `mapboxMap` changes — including the
  // map's first ready run, when `mapboxMap` flips from null to real. The
  // Filters panel is interactive before the map loads, so a filter can
  // already be set (or cleared) by then. `prevCategoriesKeyRef` (below) tells
  // that first-ready run apart from a genuine user clear so it never
  // fitBounds-to-all-venues over the #231 fixed home view on a fresh load (#247).
  //
  // Interaction with #108 drift detection: `fitBounds` will fire a `moveend`
  // event which calls `handleMoveEnd` → may set `isDrifted`. That's expected;
  // the Re-center button will appear if the user-dot isn't in the new view, which
  // is correct UX. No loop risk because `handleMoveEnd` only reads bounds, it
  // does not change `selectedCategories`.

  // Previous categories signature, updated only on runs where `mapboxMap` is
  // ready — `undefined` means "the map has never been ready before." Filter
  // churn that happens before the map exists to zoom on is invisible to this
  // ref, so it can't be mistaken for a real clear once the map finally loads.
  // A sorted, joined string (not the Set itself) is what's compared/stored:
  // `selectedCategories` gets a new Set identity on every toggle, so a
  // reference comparison would never read as "unchanged," and checking/
  // unchecking the SAME single category back to itself (add then remove a
  // different one) must still compare equal when the resulting membership is
  // equal — a plain string key gives that for free.
  const prevCategoriesKeyRef = useRef<string | null | undefined>(undefined);
  // Set by the guided tour right before it changes the categories itself.
  const skipCategoryFitRef = useRef(false);

  useEffect(() => {
    if (!mapboxMap) return;

    const categoriesKey =
      selectedCategories && selectedCategories.size > 0
        ? Array.from(selectedCategories).sort().join(",")
        : null;

    // Compare against, then overwrite with, the CURRENT value — only for runs
    // that reach here (map ready). Pre-ready renders bail above without
    // touching the ref.
    const prevCategoriesKey = prevCategoriesKeyRef.current;
    prevCategoriesKeyRef.current = categoriesKey;
    // The guided tour (#159) lifts the visitor's categories for the tour and
    // hands them back at the end; neither is a visitor's choice to zoom on,
    // and the tour restores the camera itself.
    if (skipCategoryFitRef.current) {
      skipCategoryFitRef.current = false;
      return;
    }

    const reducedMotion = prefersReducedMotion();

    // The bottom nav covers the map's bottom edge — the bar below 2xl, the
    // floating pill (24px up + 52px tall) at 2xl — so pad by it and fitted pins
    // don't land underneath (docs/bottom-nav-spec.md §5, §10).
    const basePadding = isMobile ? CATEGORY_FIT_PADDING_MOBILE : CATEGORY_FIT_PADDING_DESKTOP;
    const fitPadding = {
      ...basePadding,
      bottom: basePadding.bottom + (isBelow2xl ? BOTTOM_NAV_HEIGHT_PX : 24 + 52),
      // #682 — an open desktop side panel is also chrome fitted pins must
      // clear. Added explicitly (not via mapboxMap.setPadding) because
      // Mapbox's fitBounds REPLACES rather than merges an explicit padding
      // object with the map's persistent padding (see mapbox-gl's own
      // `_extendPadding`) — a persistent setPadding call would be silently
      // ignored by every fitBounds call here, which all pass their own
      // padding object already.
      right: basePadding.right + (desktopPanelOpenRef.current ? DESKTOP_PANEL_RIGHT_CLEARANCE_PX : 0),
    };

    if (categoriesKey === null) {
      // Skip unless a real category set was active on the previous ready run —
      // `== null` catches both "map's first ready run" (undefined) and
      // "filter was already empty." Only a genuine non-null → null transition
      // below is a real clear; otherwise whatever view is already showing
      // (the #231 home view, on a fresh load) stands untouched.
      if (prevCategoriesKey == null) return;

      // A real clear also means Boxes just turned off (its own toggle is the
      // only writer of `pendingBoxesFitBoundsRef`) — drop any pending nearest-5
      // override so a LATER Boxes-on doesn't fit stale bounds computed for a
      // location/box-list snapshot that's since moved on.
      pendingBoxesFitBoundsRef.current = null;

      // Real clear — fit the all-venues bounds, capped at CATEGORY_FIT_MAX_ZOOM.
      // NOT the wordmark/home zoom: this is a computed bounds-fit over the
      // whole venue set, a different view than PUEBLO_CENTER/PUEBLO_DEFAULT_ZOOM.
      // Includes boxVenues (map-first rework, 2026-09-18) — without this, the
      // blessing-box category chip never actually zoomed to box pins.
      const allBounds = computeCategoryBounds([...allVenues, ...boxVenues]);
      if (!allBounds) return;
      mapboxMap.fitBounds(allBounds, {
        padding: fitPadding,
        maxZoom: CATEGORY_FIT_MAX_ZOOM,
        duration: reducedMotion ? 0 : 600,
      });
      return;
    }

    // One or more categories checked — compute bounds from all (unfiltered)
    // venues across the UNION of checked categories, so the view doesn't
    // depend on other active filters (Open now/SNAP/WIC).
    // [...allVenues, ...boxVenues]: boxVenues is the only place `blessing_box`
    // category venues live (allVenues is the static published-venues.ts
    // snapshot, which never includes boxes — see "Blessing Boxes — live box
    // layer" in AGENTS.md) — without it, checking the blessing-box category
    // computed bounds over an empty array and never zoomed at all.
    const categoryVenues = [...allVenues, ...boxVenues].filter((v) =>
      selectedCategories!.has(v.category),
    );

    // #670 — Boxes-on with a known visitor location: use the nearest-5 bounds
    // handleBoxesToggle/the initialBoxesFilter effect computed and stashed
    // just before this same `selectedCategories` change, instead of this
    // effect's normal fit-every-checked-category bounds. One-shot: consumed
    // and cleared here so the NEXT category change (adding/removing some
    // other filter while Boxes stays on) falls through to the ordinary fit.
    const boxesOverride = pendingBoxesFitBoundsRef.current;
    pendingBoxesFitBoundsRef.current = null;
    const bounds = boxesOverride ?? computeCategoryBounds(categoryVenues);
    if (!bounds) return;

    mapboxMap.fitBounds(bounds, {
      padding: fitPadding,
      maxZoom: CATEGORY_FIT_MAX_ZOOM,
      duration: reducedMotion ? 0 : 600,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, mapboxMap, boxVenues]);
  // Note: `isMobile` / `isBelow2xl` intentionally excluded from deps — we want the padding that
  // was current at the time the category was selected, not re-zoom on resize.
  // `boxVenues` IS included (map-first rework, 2026-09-18) — unlike allVenues
  // (a stable module-level constant), it arrives async from useBoxesList, so
  // the blessing-box chip's zoom must re-run once that fetch resolves if the
  // filter was already active when the effect first ran with an empty array.
  // `allVenues` is a module-level constant (stable ref); no dep needed.

  // ── Route fit (#509) — fit the map to the whole walking route once it's ──
  // drawn, in the space ABOVE the route strip (BottomSheet shrinks to that
  // strip the moment a route starts — see BottomSheet.tsx's own header).
  // Fires once when `walkingRoute` becomes non-null, not on every strip <->
  // full-card toggle — the map view shouldn't jump around just because the
  // user tapped "Show card" to re-read the venue details.
  // Mobile only: the strip (and this padding) is a phone-only concept;
  // desktop's DesktopVenueWindow is explicitly out of scope for #509.
  useEffect(() => {
    if (!mapboxMap || !isMobile || !walkingRoute) return;

    const reducedMotion = prefersReducedMotion();

    const routeBounds = computeCategoryBounds(
      walkingRoute.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    );
    if (!routeBounds) return;

    mapboxMap.fitBounds(routeBounds, {
      padding: ROUTE_FIT_PADDING_MOBILE,
      maxZoom: ROUTE_FIT_MAX_ZOOM,
      duration: reducedMotion ? 0 : 600,
    });
  }, [walkingRoute, mapboxMap, isMobile]);

  // Pre-compute distance map for Map.tsx (aria-labels on markers)
  const userDistances = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of venuesWithDistance) {
      m.set(v.id, v.distanceMiles);
    }
    return m;
  }, [venuesWithDistance]);

  // Selected venue object — used by BottomSheet (mobile) and DesktopVenueWindow (desktop)
  const selectedVenue = useMemo(
    () =>
      filteredVenues.find((v) => v.id === selectedVenueId) ??
      venuesWithDistance.find((v) => v.id === selectedVenueId) ??
      null,
    [filteredVenues, venuesWithDistance, selectedVenueId],
  );

  // ── Event card (#759) ────────────────────────────────────────────────────────
  // The event the card shows: from the feed, or (a shared link to an event that
  // has ended or been cancelled) from the single-event read. A link that
  // resolves to nothing shows no card and the map is exactly as it would be
  // without the parameter (the selection stays inert: no pin matches it).
  // Ended/cancelled events never reach `events`, so they get no pin.
  const { event: selectedEvent } = useEventDetail(selectedEventId, events, eventsLoaded);

  // "See places open now" on an ended/cancelled card: the existing Open-now filter.
  const handleSeeOpenNow = useCallback(() => {
    setFilterOpenNow(true);
    selectEvent(null);
  }, [setFilterOpenNow, selectEvent]);

  // Closing the card from the phone sheet or the panel deselects the pin and
  // (via syncEventParam) clears ?event=.
  const closeEventCard = useCallback(() => selectEvent(null), [selectEvent]);

  // An upcoming or live event tied to the selected place (#759): one line on
  // that place's own card that opens the event. Judged at render time from the
  // feed (no timer of its own): the card is only on screen briefly, and a pin
  // that has just expired disappears from the map on the shared minute tick.
  const eventHereFor = (venueId: string | null) => {
    if (venueId === null || events.length === 0) return null;
    // eslint-disable-next-line react-hooks/purity -- wall clock on purpose; see above
    const pin = pinsAt(events, Date.now()).find((p) => p.event.venue_id === venueId);
    return pin ? { label: eventHereLabel(pin, locale), onOpen: () => selectEvent(pin.event.id) } : null;
  };

  // ── venue_opened analytics (#485 PR 2) ───────────────────────────────────────
  //
  // ONE choke point for every selection path (map pin, list row, search
  // result, deep link — five separate setSelectedVenueId call sites) rather
  // than instrumenting each: fires on the id actually CHANGING, keyed off a
  // ref rather than selectedVenueId itself, because venuesWithDistance gets
  // a new object identity on every `origin` change (a fresh geolocation fix)
  // — without the ref, that alone would re-fire this effect for the SAME
  // open venue. Also covers the async-boxes case: selectedVenue is null on
  // the render where selectedVenueId is set but boxVenues hasn't loaded yet,
  // so this only fires once selectedVenue itself resolves to a real object.
  const lastTrackedVenueIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedVenue === null) {
      lastTrackedVenueIdRef.current = null;
      return;
    }
    if (lastTrackedVenueIdRef.current === selectedVenue.id) return;
    lastTrackedVenueIdRef.current = selectedVenue.id;
    void track(EVENTS.VENUE_OPENED, {
      category: selectedVenue.category,
      venueId: selectedVenue.id,
    });
  }, [selectedVenue]);

  // ── Typeahead popover handlers (issue #67) ───────────────────────────────────
  // These come after filteredVenues / isMobile are declared so closures are valid.

  /** Open the popover when the input gains focus. */
  const handleSearchFocus = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setIsPopoverOpen(true);
    // Don't reset activeIndex on focus — keeps highlight if user refocuses.
  }, []);

  /**
   * Shared blur handler for the popover rows themselves (ViewSuggestion's
   * button, SearchResultsPopover's "see all" row) — also the tail of
   * handleSearchBlur, needed because Tab-ing further (past the last row)
   * blurs the ROW, not the input, so handleSearchBlur never sees it.
   */
  const handleSuggestionRowBlur = useCallback((e: React.FocusEvent) => {
    const next = e.relatedTarget;
    if (next instanceof Node && searchAreaRef.current?.contains(next)) return;
    blurTimerRef.current = setTimeout(() => {
      setIsPopoverOpen(false);
      setActiveIndex(-1);
    }, 150);
  }, []);

  /**
   * Close the popover on blur — UNLESS focus is moving to one of our own
   * rows (ViewSuggestion's button, SearchResultsPopover's "see all" row).
   *
   * Two distinct blur sources land here now:
   *   - Mouse click on a row: the row's own onMouseDown already called
   *     preventDefault, so the input never actually blurs — this handler
   *     doesn't even run.
   *   - Tab off the input: this DOES fire a real blur. e.relatedTarget is
   *     the element about to receive focus (browsers set it before running
   *     default focus-move handlers), so checking containment against
   *     searchAreaRef tells "Tab into our own row" (relatedTarget inside)
   *     apart from "Tab/click somewhere else" (relatedTarget outside or
   *     null) — a keyboard-a11y fix (reviewer, PR #522): the previous blind
   *     150ms timer raced Tab's own focus-move and could close mid-jump.
   * The 150ms timer stays as the fallback for the "somewhere else" case
   * (still gives a stray mousedown elsewhere a grace period).
   */
  const handleSearchBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Leaving the box commits the search for analytics (#738); before the
    // containment check so tabbing into our own popover still counts.
    commitSearch();
    handleSuggestionRowBlur(e);
  }, [commitSearch, handleSuggestionRowBlur]);

  /**
   * Close the popover for good: state down AND the input blurred.
   * WHY blur: if the input stays focused, tapping it again fires no `focus`
   * event, so the popover could never reopen (see handleViewSuggestionSelect).
   */
  const closeSearchPopover = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setIsPopoverOpen(false);
    setActiveIndex(-1);
    const active = document.activeElement;
    if (active instanceof HTMLElement && searchAreaRef.current?.contains(active)) {
      active.blur();
    }
  }, []);

  // Outside-press close. WHY not blur alone: a map pin / the Mapbox canvas
  // does not move focus (marker press, canvas drag), so the input never
  // blurred and the popover stayed open beside the opened place card. A
  // capture-phase pointerdown on the document sees the press before Mapbox
  // or a marker can stop it; presses inside the search area (input, filters
  // button, popover rows) are left alone so row clicks still land.
  useEffect(() => {
    // Not while a tour runs (#159): the tour's search demo opens these
    // results itself, and every tap then lands on the tour's own layer —
    // closing them would wipe the demo mid-step.
    if (!isPopoverOpen || tour) return;
    const onPress = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Node && searchAreaRef.current?.contains(target)) return;
      closeSearchPopover();
    };
    document.addEventListener("pointerdown", onPress, true);
    return () => document.removeEventListener("pointerdown", onPress, true);
  }, [isPopoverOpen, tour, closeSearchPopover]);

  // Selection by ANY route (pin, list row, strip, deep link, saved list)
  // closes it too — the card now owns the screen.
  const anythingSelected = selectedVenueId !== null || selectedEventId !== null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to selection from many call sites; one place beats patching each
    if (anythingSelected) closeSearchPopover();
  }, [anythingSelected, selectedVenueId, selectedEventId, closeSearchPopover]);

  /**
   * Keyboard handler forwarded from SearchBar: ArrowDown/Up/Enter/Escape.
   * Tab is deliberately NOT handled here — it used to force-close the
   * popover on every Tab press, which raced (and usually won against) the
   * browser's own default focus-move, closing the popover before Tab could
   * land on ViewSuggestion's/SearchResultsPopover's row (keyboard-a11y fix,
   * reviewer, PR #522). Tab's effect on the popover is now decided entirely
   * by blur/focus containment — see handleSearchBlur/handleSuggestionRowBlur.
   */
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const popoverVisible = isPopoverOpen && filteredVenues.length > 0;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!popoverVisible) {
          setIsPopoverOpen(true);
          setActiveIndex(0);
          return;
        }
        setActiveIndex((prev) => {
          const lastRendered = Math.min(filteredVenues.length - 1, MAX_VISIBLE - 1);
          return prev < lastRendered ? prev + 1 : prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!popoverVisible) return;
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsPopoverOpen(false);
        setActiveIndex(-1);
      } else if (e.key === "Enter") {
        commitSearch(); // Enter commits the search for analytics (#738)
        if (popoverVisible && activeIndex >= 0 && activeIndex < filteredVenues.length) {
          e.preventDefault();
          const venue = filteredVenues[activeIndex];
          // #524 fix: this used to branch on mapUnavailable and router.push
          // to /venue/<id> (or a box's /box/<id>/history), because
          // showVenueOnMap() no-ops while mapUnavailable (useMapUI.ts) and
          // BottomSheet/DesktopVenueWindow used to only render when
          // viewMode === "map" — so a keyboard Enter on a box result reached
          // a read-only page with no check-in/adopt/address. The render
          // guards below now also open on mapUnavailable (not just
          // viewMode === "map"), so plain selection is enough here too — no
          // more box-vs-venue branch, same as the other three selection
          // handlers (handleSelectSavedVenue/handleSelectVenueFromPopover/
          // handleSelectFromList).
          selectVenue(venue.id);
          showVenueOnMap();
          setIsPopoverOpen(false);
          setActiveIndex(-1);
        }
      }
    },
    // filteredVenues reference is stable between renders with same query/filters.
    [isPopoverOpen, filteredVenues, activeIndex, selectVenue, showVenueOnMap, commitSearch],
  );

  // Select a venue from the Saved list (#132 9c). Clears active filters + search
  // so the venue is in the filtered set — that makes its pin visible and lets the
  // map fly to it (Map.tsx's selected-venue flyTo reads the filtered set) — then
  // opens its detail card.
  const handleSelectSavedVenue = useCallback(
    (venueId: string) => {
      handleClearAllFilters();
      selectVenue(venueId, "saved");
      showVenueOnMap();
    },
    [handleClearAllFilters, selectVenue, showVenueOnMap],
  );

  /** Called when user clicks/taps a result row inside the popover. */
  const handleSelectVenueFromPopover = useCallback(
    (venueId: string) => {
      selectVenue(venueId);
      showVenueOnMap();
      setIsPopoverOpen(false);
      setActiveIndex(-1);
    },
    [selectVenue, showVenueOnMap],
  );

  // Select a venue from the list (#129) — switch back to the map, centered on
  // it. #524 fix: when mapUnavailable, this used to navigate to /venue/[id]
  // (or a box's read-only /box/<id>/history), stranding that visitor with no
  // check-in/adopt/address. showVenueOnMap() no-ops while mapUnavailable
  // (useMapUI.ts) so viewMode stays "list" — selecting a venue here now just
  // opens the same BottomSheet/DesktopVenueWindow card ON TOP of the list
  // (the render guards below key off mapUnavailable too, not only
  // viewMode === "map").
  // An event row in the list opens its card over the map, like a place row.
  const handleSelectEventFromList = useCallback(
    (id: string) => {
      selectEvent(id);
      showVenueOnMap();
    },
    [selectEvent, showVenueOnMap],
  );

  const handleSelectFromList = useCallback(
    (venueId: string) => {
      selectVenue(venueId);
      showVenueOnMap();
    },
    [selectVenue, showVenueOnMap],
  );


  // Derive the active option id for aria-activedescendant.
  const activeDescendantId =
    isPopoverOpen && activeIndex >= 0
      ? optionId(LISTBOX_ID, activeIndex)
      : undefined;

  // The results popover should show: focused + non-empty query + has matches.
  const showResultsPopover =
    isPopoverOpen && query.trim() !== "" && filteredVenues.length > 0;

  // ViewSuggestion (#514) shows on the OTHER half of the same condition:
  // focused + EMPTY query. Mutually exclusive with showResultsPopover and
  // EmptySearchPopover (both require a non-empty query) by construction.
  const showViewSuggestion = isPopoverOpen && query.trim() === "";

  // WHY one shared handler: every path that switches views (the search bar's
  // own suggestion row and results row, #514, "Near me" below, and the Menu
  // line) must honor the same mapUnavailable guard (selecting "map" while the
  // map can't mount would show a blank screen, #165).
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      if (mapUnavailable && mode === "map") return;
      setViewMode(mode);
    },
    [mapUnavailable, setViewMode],
  );

  /**
   * ViewSuggestion / the results-popover's "See all N matches" row (#514):
   * switch view then close whatever search popover triggered it.
   *
   * WHY blur the input: both rows call `onMouseDown={(e) => e.preventDefault()}`
   * (mirrors SearchResultsPopover's option rows) so the 150ms blur grace
   * period can't race the tap closed before this handler runs — but that
   * same preventDefault means the input never naturally loses focus on its
   * own. Without an explicit blur here, "search closes" (#514 spec) isn't
   * true: the keyboard stays up on phone, and — worse — a second empty tap
   * on the now-unfocused-looking bar fires no `focus` event (it was already
   * focused), so the OTHER direction's row (e.g. "Back to the map" right
   * after switching to list) never appears until the user taps away first.
   * Same pattern SearchBar's own Enter handler already uses
   * (`e.currentTarget.blur()`). The blur this triggers re-schedules
   * isPopoverOpen=false via the normal 150ms timer — harmless, since it's
   * already false.
   */
  const handleViewSuggestionSelect = useCallback(
    (mode: ViewMode) => {
      handleViewModeChange(mode);
      setIsPopoverOpen(false);
      setActiveIndex(-1);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [handleViewModeChange],
  );

  // "Near me" (docs/bottom-nav-spec.md §6). The bar persists in list view, but
  // a fly-to-your-location is invisible there — so it returns to the map first
  // (a no-op when the map can't mount; the location still re-sorts the list).
  const handleNearMe = useCallback(() => {
    // #485 PR 2: fired ONLY here, not inside handleLocateRequest — that
    // function is shared with the Walk-without-location path (#207), which
    // isn't a "Near me" tap and must not be misattributed as one.
    // source tells this apart from the splash CTA's tap (#738).
    void track(EVENTS.NEAR_ME_CLICKED, { source: "map" });
    handleViewModeChange("map");
    handleLocateRequest();
  }, [handleViewModeChange, handleLocateRequest]);

  // ── Guided tour (#159) ───────────────────────────────────────────────────────
  // Snapshot what the tour will change (selection, Map/List view), close
  // anything that would sit over it, and force the map view so pins and the
  // card exist to point at. GuidedTour.tsx drives each step's own state
  // through onShowVenue; endTour hands the snapshot back.
  // Desktop (#682 8b): venue selection goes through `selectVenue` and the
  // side panel, so the tour opens/closes the card the same way a pin click
  // does; the Saved/Menu panel it closes on start is not reopened at the end.
  // ponytail: an active walking route and a selected event are NOT restored
  // — selecting the sample venue clears both, and a tour mid-route is rare.
  // Upgrade path: snapshot + refetch the route / reselect the event in endTour.
  // A ref, not TourSession: the demo's unmount cleanup runs after endTour
  // has already cleared `tour`, and must still restore the same query.
  const tourPrevQueryRef = useRef("");
  // True from startTour to endTour. The demos' unmount cleanups run after
  // endTour has already handed the visitor's state back; they must not undo it.
  const tourActiveRef = useRef(false);
  // Phone only: the tour holds a box card's sheet open to show its lower buttons.
  const [tourCardExpanded, setTourCardExpanded] = useState(false);
  const startTour = useCallback(
    (returnFocusSelector: string) => {
      setMenuSection(null);
      setSidePanelView(null);
      setSelectedEventId(null);
      setFilterPanelOpen(false);
      setIsPopoverOpen(false);
      // The nearest pantry that's on the map right now (filteredVenues is
      // distance-sorted): a pantry card is the typical one, and a box has a
      // different card entirely. Falls back to any listed place, then to any
      // pantry at all when filters hide every one.
      const sampleVenue =
        filteredVenues.find((v) => v.category === "pantry") ??
        filteredVenues.find((v) => v.category !== "blessing_box") ??
        allVenues.find((v) => v.category === "pantry") ??
        null;
      // The nearest live box (the feed may still be loading or empty: then
      // there's no box to show and GuidedTour leaves those steps out).
      let sampleBox: Venue | null = null;
      for (const v of venuesWithDistance) {
        if (v.category !== "blessing_box" || !getBoxById(v.id)) continue;
        if (!sampleBox || (v.distanceMiles ?? Infinity) < ((sampleBox as typeof v).distanceMiles ?? Infinity)) {
          sampleBox = v;
        }
      }
      tourActiveRef.current = true;
      setTour({
        returnFocusSelector,
        prevSelectedId: selectedVenueId,
        prevViewMode: viewMode,
        sampleVenue,
        sampleBox,
        prevFilters: {
          categories: selectedCategories,
          openNow: filterOpenNow,
          snap: filterSnap,
          wic: filterWic,
          events: filterEvents,
        },
      });
      if (selectedCategories && selectedCategories.size > 0) skipCategoryFitRef.current = true;
      clearFilters();
      // The search demo borrows the real query; keep the visitor's own to
      // hand back, and keep the demo word out of search_used analytics.
      tourPrevQueryRef.current = query;
      setSearchTrackingPaused(true);
      handleViewModeChange("map");
    },
    [
      filteredVenues, selectedVenueId, viewMode, query, handleViewModeChange, setSelectedEventId, setSearchTrackingPaused,
      selectedCategories, filterOpenNow, filterSnap, filterWic, filterEvents, clearFilters, venuesWithDistance, getBoxById,
    ],
  );
  // Box steps demo (#159): the same Boxes view the bottom-nav button gives
  // (blessing_box only), off again once the box steps are left. The tour
  // cleared the visitor's own filters at start, so "off" is no filter at all;
  // theirs come back in endTour.
  const handleTourDemoBoxes = useCallback(
    (on: boolean) => {
      if (!tourActiveRef.current) return;
      setSelectedCategories(on ? new Set<VenueCategory>(["blessing_box"]) : null);
    },
    [setSelectedCategories],
  );
  // Search step demo (#159): set the real query and show its results without
  // focusing the input (so a phone keyboard never opens); null puts the
  // visitor's own query back with the results closed, as before the tour.
  const handleTourDemoSearch = useCallback(
    (text: string | null) => {
      // A blur's pending 150ms close (handleSearchBlur) would shut the demo's
      // results the moment they open.
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      setActiveIndex(-1);
      if (text === null) {
        setQuery(tourPrevQueryRef.current);
        setIsPopoverOpen(false);
        return;
      }
      setQuery(text);
      setIsPopoverOpen(text !== "");
    },
    [setQuery],
  );
  // One path for "show this venue's card / close any card" on both
  // platforms: selectVenue opens the desktop side panel too (a bare
  // setSelectedVenueId would leave the panel shut and the card step with
  // nothing to point at).
  const handleTourShowVenue = useCallback(
    (id: string | null, expanded = false) => {
      // The desktop box card has no folded part (DesktopVenueWindow's boxBody).
      setTourCardExpanded(expanded);
      if (id) {
        selectVenue(id);
        return;
      }
      setSelectedVenueId(null);
      if (!isMobile) setSidePanelView(null);
    },
    [isMobile, selectVenue, setSelectedVenueId],
  );
  const endTour = useCallback(() => {
    if (!tour) return;
    tourActiveRef.current = false;
    handleTourShowVenue(tour.prevSelectedId);
    setViewMode(tour.prevViewMode);
    // The demo steps undo themselves on unmount too; doing it here as well
    // keeps the restore in the same render as the rest of the snapshot.
    handleTourDemoSearch(null);
    setFilterPanelOpen(false);
    const f = tour.prevFilters;
    // Any change of categories here (the box steps' Boxes view, or the
    // visitor's own being handed back) must not re-zoom: the tour has just
    // put the camera back itself.
    const key = (c: Set<VenueCategory> | null) => (c && c.size > 0 ? [...c].sort().join(",") : "");
    if (key(f.categories) !== key(selectedCategories)) skipCategoryFitRef.current = true;
    setSelectedCategories(f.categories);
    setFilterOpenNow(f.openNow);
    setFilterSnap(f.snap);
    setFilterWic(f.wic);
    setFilterEvents(f.events);
    setSearchTrackingPaused(false);
    setTour(null);
  }, [
    tour, handleTourShowVenue, handleTourDemoSearch, setViewMode, setSearchTrackingPaused,
    selectedCategories, setSelectedCategories, setFilterOpenNow, setFilterSnap, setFilterWic, setFilterEvents,
  ]);
  const handleMenuStartTour = useCallback(
    () => startTour('[data-testid="nav-top"]'),
    [startTour],
  );
  // Splash / ?tour=1 requests (HomePageClient). Focus returns to the map
  // container (<main tabIndex=-1>), where dismissing the splash normally puts it.
  const handledTourRequestRef = useRef(0);
  useEffect(() => {
    if (!tourRequestId || tourRequestId === handledTourRequestRef.current) return;
    handledTourRequestRef.current = tourRequestId;
    queueMicrotask(() => startTour("main"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourRequestId]);

  // §10: the venue sheet (phone only) covers the bottom edge; the nav steps
  // aside for as long as a venue is selected — the FULL CARD (unchanged,
  // #509) or the collapsed route strip alike. #531 (Kyle, 2026-09-19) had
  // carved the strip out with a `!stripVisible` term here so the bar stayed
  // visible underneath it; #547 (Kyle, 2026-09-20) reverses that on sight of
  // the bar covering the route controls on his phone — the strip now hides
  // the bar too, so the carve-out is gone. Kept as one `selectedVenue !==
  // null` term (not two branches for strip vs. card) so there is nothing for
  // "Show card"/"Clear route" to desync — the registration only ever depends
  // on whether a venue is selected, never on which of the two views is
  // showing, so switching between them can't flicker the bar. #524: also
  // true when mapUnavailable — BottomSheet now opens over the list in that
  // case too (see its own render guard below), so the nav must step aside
  // there as well.
  const venueSheetOpen =
    isMobile && (viewMode === "map" || mapUnavailable) && (selectedVenue !== null || selectedEvent !== null);
  // #542: feeds the same shared registry every other full-surface overlay
  // uses — BottomNav hides itself (overlayRegistry.ts) instead of this
  // component wrapping <BottomNav/> in a `{!venueSheetOpen && ...}` JSX
  // conditional, which was the "fifth ad-hoc boolean" #542 called out.
  useOverlayRegistration(venueSheetOpen);

  // ── Desktop side panel (#682) — replaces the marker-anchored window ──────────
  // `sidePanelView` (8b) is the panel's sole render driver on desktop — see
  // its own type doc above. The venue card still needs the map-ish-view
  // guard `venueSheetOpen` above uses (a card only makes sense over the map
  // or mapUnavailable's fallback), but Saved/Menu don't: the old ~280px
  // dropdown worked over the list view too, and #682 doesn't ask to take
  // that away. `viewMode`/`mapUnavailable` are read directly (not via
  // `selectedVenue`, which is null while `sidePanelView.kind !== "venue"`).
  // The event card (#759) is derived from `selectedEventId` rather than being a
  // `sidePanelView` kind: a shared ?event= link seeds the selection on the first
  // render, before `isMobile` settles, and a view kind set by a handler would
  // miss that. It shows only while no venue/Saved/Menu view holds the panel.
  const eventPanelOpen =
    !isMobile && selectedEvent !== null && sidePanelView === null && (viewMode === "map" || mapUnavailable);
  const desktopPanelOpen =
    eventPanelOpen ||
    (!isMobile &&
      sidePanelView !== null &&
      (sidePanelView.kind !== "venue" || viewMode === "map" || mapUnavailable));

  // Stable ids for HamburgerMenuContent's Saved/Menu headings — the venue
  // view reuses DesktopVenueWindow's own existing heading id. Only read
  // while `desktopPanelOpen` (DesktopSidePanel unmounts otherwise), so the
  // fallback empty string here is never actually passed to a mounted panel.
  const panelHeadingId =
    eventPanelOpen && selectedEvent
      ? `event-card-title-${selectedEvent.id}`
      : sidePanelView?.kind === "venue"
      ? `venue-window-title-${sidePanelView.id}`
      : sidePanelView?.kind === "saved"
      ? "desktop-panel-saved-heading"
      : sidePanelView?.kind === "menu"
      ? "desktop-panel-menu-heading"
      : "";

  // Synced into the ref declared near `isMobile` above, not read as a direct
  // dependency of the fit-bounds effect: that effect deliberately excludes
  // isMobile/isBelow2xl too (see its own trailing comment — "the padding
  // that was current when the category was selected, not re-zoom on
  // resize"). Reading whatever the panel's state happens to be AT FIT TIME
  // follows the same rule without forcing that effect to re-run every time
  // the panel opens or closes.
  useEffect(() => {
    desktopPanelOpenRef.current = desktopPanelOpen;
  }, [desktopPanelOpen]);

  // Pan the selected pin clear of the panel (#682) — the panel's fixed
  // position/size means a pin near the right edge would otherwise render
  // under it. `panBy` shifts the camera in screen pixels (not degrees), so
  // this works regardless of zoom level; a positive x offset moves the
  // camera's on-screen reference point right, which is the documented Mapbox
  // way to make map CONTENT appear to shift left (revealing more on the
  // right) — see the Mapbox GL JS `panBy` example ("panBy([-100, 0])...
  // appears to move 100 pixels to the right"). Only pans when the pin is
  // ACTUALLY hidden (positive overflow) — never recenters a pin that's
  // already clear, so this never fights a fresh fitBounds/flyTo the same
  // selection just triggered elsewhere.
  useEffect(() => {
    // Gate on the panel actually being open (#688 review), not just on a
    // selection existing: a future path that selects without showing the map
    // must never pan a hidden map.
    if (isMobile || !mapboxMap || !selectedVenue || !desktopPanelOpen) return;
    // `project`/`panBy` guard: real mapboxgl.Map always has both. It exists
    // for tests: a test whose matchMedia stub (or lack of one) reads as
    // desktop, and that pre-selects a venue via `initialVenueId`, reaches
    // this effect with a minimal test map mock that only stubs the methods
    // ITS OWN scenario needs (fitBounds/flyTo/jumpTo, not project/panBy,
    // since every other desktop-only code path is already gated by the JSX
    // `!isMobile` render conditional, which this effect — deliberately
    // independent of what actually renders — is not). (Until #721,
    // useMediaQuery also started `false` for a tick on phones.)
    if (
      typeof mapboxMap.project !== "function" ||
      typeof mapboxMap.getContainer !== "function" ||
      typeof mapboxMap.panBy !== "function"
    ) {
      return;
    }
    const pt = mapboxMap.project([selectedVenue.lng, selectedVenue.lat]);
    const container = mapboxMap.getContainer();
    const visibleRight = container.offsetWidth - DESKTOP_PANEL_RIGHT_CLEARANCE_PX;
    const overflow = pt.x - visibleRight;
    if (overflow <= 0) return;
    const reducedMotion = prefersReducedMotion();
    mapboxMap.panBy([overflow, 0], { duration: reducedMotion ? 0 : 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenueId, mapboxMap, isMobile, desktopPanelOpen]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full">
      {/* Map — fills viewport; skipped entirely when WebGL is unavailable (#165)
          or the interactive load hasn't been triggered yet (#226 — see
          useDeferredMapLoad; ListView below covers this same window).
          MapErrorBoundary catches fatal init throws as a secondary safety net. */}
      {!mapUnavailable && mapLoadTriggered && (
        <MapErrorBoundary onError={handleMapError}>
          <MapCanvas
            venues={filteredVenues}
            selectedVenueId={selectedVenueId}
            userLocation={userLocation}
            userDistances={userDistances}
            recenterRequestId={recenterRequestId}
            onSelectVenue={selectVenue}
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={selectEvent}
            allUpcomingEvents={filterEvents}
            // WHY here (#758): Map defaults locale to "en" and nothing passed it,
            // so on /es every pin label and tooltip stayed English. Event pins
            // need the visitor's language; place pins' aria/tooltips now follow it too.
            locale={locale}
            onMapReady={setMapboxMap}
            onMoveEnd={handleMoveEnd}
            walkingRoute={walkingRouteVenueId === selectedVenueId ? walkingRoute : null}
            focusPoint={focusPoint}
            focusRequestId={focusRequestId}
          />
        </MapErrorBoundary>
      )}

      {/* List view (#129) — full-screen overlay above the map, below top chrome.
          When mapUnavailable, the notice prop carries the fallback banner (#165)
          so it renders inside ListView's z-[700] stacking context and stays visible.
          Also doubles as the #226 pre-load placeholder: while !mapLoadTriggered
          (viewMode is still "map" — this does not touch viewMode itself), this
          same branch covers the map's box so cold load never mounts mapbox-gl
          before idle/interaction. Reusing ListView (rather than a new skeleton)
          means the placeholder is already fully interactive — tapping a venue
          card both selects it and counts as the interaction that triggers the
          real map load. */}
      {(viewMode === "list" || !mapLoadTriggered) && (
        <ListView
          venues={filteredVenues}
          selectedVenueId={selectedVenueId}
          onSelect={handleSelectFromList}
          onClearFilters={handleClearAllFilters}
          showClearFilters={anyFilterActive || query.trim() !== ""}
          events={events}
          onSelectEvent={handleSelectEventFromList}
          eventsOnly={filterEvents}
          notice={
            mapUnavailable ? (
              <div
                role="status"
                aria-live="polite"
                className="w-full px-4 py-3 flex items-start gap-3 bg-[var(--color-bone-100)] border-b border-[var(--color-bone-300)] text-[var(--color-ink-700)]"
              >
                <span className="flex-1">
                  {/* Offline (#130) gets its own copy: the map will work
                      again with a connection, unlike a no-WebGL device. */}
                  <strong className="block text-sm font-semibold mb-0.5">
                    {t(mapUnavailableReason === "offline" ? "map.offlineTitle" : "map.unavailableTitle", locale)}
                  </strong>
                  <span className="text-sm">
                    {t(mapUnavailableReason === "offline" ? "map.offlineBody" : "map.unavailableBody", locale)}
                  </span>
                </span>
              </div>
            ) : undefined
          }
        />
      )}

      {/* searchAreaRef wraps these three — display:contents so it adds no box
          of its own — purely so blur handlers can ask "did focus move to one
          of OUR OWN rows, or leave the group entirely?" (keyboard-a11y fix,
          reviewer, PR #522). See handleSearchBlur/handleSuggestionRowBlur. */}
      <div ref={searchAreaRef} className="contents">
        {/* SearchBar — controlled (PR 6), ARIA combobox wired (#67).
            filtersButton (#513) opens the FilterPanel below — search focus
            opens ViewSuggestion (empty query) or SearchResultsPopover (typed),
            never a category list of its own. Nothing renders on the right end
            of the bar (#514 removed the inline Map/List switch — see
            ViewSuggestion/HamburgerMenu for its replacements). */}
        <SearchBar
          value={query}
          onChange={(next) => {
            setQuery(next);
            // Reset activeIndex on every keystroke — new results set.
            setActiveIndex(-1);
          }}
          placeholder={t("search.placeholder", locale)}
          ariaLabel={t("search.aria", locale)}
          comboboxEnabled={true}
          comboboxExpanded={showResultsPopover}
          comboboxControls={showResultsPopover ? LISTBOX_ID : undefined}
          comboboxActiveDescendant={activeDescendantId}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          onKeyDownExtra={handleSearchKeyDown}
          rightInset={desktopPanelOpen ? DESKTOP_PANEL_RIGHT_CLEARANCE_PX : 0}
          filtersButton={{
            count: activeFilterCount,
            onClick: () => setFilterPanelOpen(true),
            ariaLabel:
              activeFilterCount > 0
                ? t("filters.button.labelActive", locale, { count: String(activeFilterCount) })
                : t("filters.button.label", locale),
          }}
        />

        {/* ViewSuggestion (#514) — shown on an EMPTY, focused search bar; offers
            the other view. Mutually exclusive with SearchResultsPopover/
            EmptySearchPopover below (both require a non-empty query). Renders
            nothing itself while on the list with the map disabled (#165) —
            see the component's own guard. onFocus/onBlur (keyboard-a11y fix,
            reviewer, PR #522) make its button Tab-reachable: onFocus mirrors
            handleSearchFocus (clears any pending close timer), onBlur decides
            whether Tab-ing further should close the popover. */}
        {showViewSuggestion && (
          <ViewSuggestion
            mode={viewMode}
            count={filteredVenues.length}
            mapDisabled={mapUnavailable}
            locale={locale}
            onSelect={() => handleViewSuggestionSelect(viewMode === "map" ? "list" : "map")}
            onFocus={handleSearchFocus}
            onBlur={handleSuggestionRowBlur}
          />
        )}

        {/* SearchResultsPopover — shown when query is non-empty AND has matches (#67).
            Mutually exclusive with EmptySearchPopover. onSeeAllAsList (#514) is
            map-only — on the list, typing already updates ListView live.
            onSeeAllAsListFocus/onSeeAllAsListBlur (keyboard-a11y fix, reviewer,
            PR #522) — same pattern as ViewSuggestion above, scoped to that one
            new row (the option <li>s above it carry no tabIndex, so they were
            never keyboard-reachable and need no such wiring). */}
        {showResultsPopover && (
          <SearchResultsPopover
            venues={filteredVenues as VenueWithDistance[]}
            activeIndex={activeIndex}
            listboxId={LISTBOX_ID}
            onSelect={handleSelectVenueFromPopover}
            onClose={() => {
              setIsPopoverOpen(false);
              setActiveIndex(-1);
            }}
            onSeeAllAsList={
              viewMode === "map" ? () => handleViewSuggestionSelect("list") : undefined
            }
            onSeeAllAsListFocus={handleSearchFocus}
            onSeeAllAsListBlur={handleSuggestionRowBlur}
          />
        )}
      </div>

      {/* "Happening today" strip (#761). Map view only, once the map has loaded:
          the list view lists events itself, and before the map loads the
          list stands in for it (same z-700 rung, so the two must not coexist).
          Hidden while any place or event card is open (phone sheet or desktop
          panel): the open card already names what the strip points at, and a
          tall sheet reaches up under it. It returns when the card closes.
          Hidden while the search popover or Filters panel is open: the popover sits in
          the strip's exact spot and the strip's navy edge poked out around it.
          Hidden with no events, so an empty or failed feed changes nothing. */}
      {viewMode === "map" && mapLoadTriggered && events.length > 0 && selectedVenue === null && selectedEvent === null && !isPopoverOpen && !filterPanelOpen && (
        <EventStrip
          events={events}
          locale={locale}
          onOpen={selectEvent}
          onMore={() => handleViewModeChange("list")}
          rightInset={desktopPanelOpen ? DESKTOP_PANEL_RIGHT_CLEARANCE_PX : 0}
        />
      )}

      {/* Events filter on and nothing left to show (#761): say so on the map too, with a way out. */}
      {viewMode === "map" && filterEvents && (
        <EventsEmptyNotice
          events={events}
          locale={locale}
          onShowPlaces={() => setFilterEvents(false)}
          bottom={
            isBelow2xl
              ? `calc(${BOTTOM_NAV_HEIGHT_PX}px + 8px + 26px + 12px + env(safe-area-inset-bottom))`
              : 24 + 52 + 12
          }
        />
      )}

      {/* FilterPanel (#513) — the left side panel opened by SearchBar's Filters
          button. Not tied to search focus (replaces CategoryDropdown, #95). */}
      <FilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        locale={locale}
        resultCount={filterEvents ? filterEventsCount : filteredVenues.length}
        filterOpenNow={filterOpenNow}
        onToggleOpenNow={() => setFilterOpenNow((v) => !v)}
        openNowCount={openNowCount}
        filterSnap={filterSnap}
        onToggleSnap={() => setFilterSnap((v) => !v)}
        snapCount={snapCount}
        filterWic={filterWic}
        onToggleWic={() => setFilterWic((v) => !v)}
        wicCount={wicCount}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        onClearAll={clearFilters}
        filterEvents={filterEvents}
        onToggleEvents={() => setFilterEvents((v) => !v)}
        eventsCount={filterEventsCount}
        // The tour (#159) holds the panel open as a demo; its dialog owns focus then.
        trapFocus={tour === null}
      />

      {/* EmptySearchPopover — shown when query is non-empty but yields no results.
          Mutually exclusive with SearchResultsPopover (they depend on filteredVenues.length). */}
      {query.trim() !== "" && filteredVenues.length === 0 && (
        <EmptySearchPopover
          query={query.trim()}
          onSelectCategory={(label) => setQuery(label)}
        />
      )}

      {/* HamburgerMenu — the drawer, opened by BottomNav at a section (#71, spec §7).
          viewMode/onToggleView/mapDisabled (#514) drive its "List view"/"Map
          view" line — the second way into the switch, for anyone who never
          taps search. MOBILE ONLY (#682 8b) — desktop's Saved/Menu views
          render inside DesktopSidePanel below instead (same
          HamburgerMenuContent, different shell — see that component's own
          header). Gated on `isMobile`, not just `menuSection`, so a resize
          mid-session doesn't leave this mounted with the wrong shell. */}
      {isMobile && (
        <HamburgerMenu
          onShowWelcome={onShowWelcome}
          savedVenues={savedVenues}
          onSelectVenue={handleSelectSavedVenue}
          open={menuSection !== null}
          onClose={handleMenuClose}
          view={menuSection ?? "top"}
          ignoreOutsideRef={navRef}
          viewMode={viewMode}
          onToggleView={() => handleViewModeChange(viewMode === "map" ? "list" : "map")}
          mapDisabled={mapUnavailable}
          onStartTour={handleMenuStartTour}
        />
      )}

      {/* Outside-county message — appears when resolved position is beyond maxBounds (#108). Map mode only (#129). */}
      {viewMode === "map" && outsideCountyVisible && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            position: "absolute",
            // Below 2xl: lifted clear of the bottom nav bar AND the Mapbox
            // credits row above it (globals.css's `@media (width < 96rem)`
            // rule lifts that row the same way). Recomputed 2026-09-16 — the
            // old "+ 52" dated from a taller credits control that no longer
            // exists:
            //   BOTTOM_NAV_HEIGHT_PX (76) — the nav bar itself
            //   + 8                       — nav-to-credits gap (globals.css)
            //   + 26                      — credits row height: the 20px
            //                               logo/attrib control (globals.css
            //                               `.mapboxgl-ctrl-logo`) plus its
            //                               own 6px bottom margin
            //                               (`.mapboxgl-ctrl-bottom-right
            //                               .mapboxgl-ctrl`) — margins don't
            //                               collapse in a flex row, so both
            //                               count toward the row's height
            //   + 12                      — clearance above the credits row
            // 2xl: above the floating nav pill (24px up + 52px tall + 12px
            // gap) — credits aren't lifted at 2xl (the pill sits centred,
            // clear of the bottom-right corner), so this branch is unchanged.
            bottom: isBelow2xl
              ? `calc(${BOTTOM_NAV_HEIGHT_PX}px + 8px + 26px + 12px + env(safe-area-inset-bottom))`
              : 24 + 52 + 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1001,
            whiteSpace: "nowrap",
          }}
          className={[
            "flex items-center gap-2 px-4 py-2 rounded-full",
            "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]",
            "text-sm font-medium",
            "elevation-2",
          ].join(" ")}
        >
          <span>{t("locate.outsideCounty", locale)}</span>
          <button
            type="button"
            aria-label={t("detail.close", locale)}
            onClick={() => setOutsideCountyVisible(false)}
            className="text-[var(--color-clay-500)] hover:text-[var(--color-clay-700)] transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Legend removed: category browse is now in the search-focus dropdown (#95) */}

      {/* LocationHelpCard (#739) — after a failed splash CTA or Near me tap. Map mode only (#129). */}
      {viewMode === "map" && locationFailure && (
        <LocationHelpCard
          failure={locationFailure}
          // Re-request; if it fails again the geo.state effect re-shows the card
          // (possibly with a new reason), if it works the same effect clears it.
          onRetry={handleLocateRequest}
          onShowList={() => {
            handleViewModeChange("list");
            setLocationFailure(null);
          }}
          onDismiss={() => setLocationFailure(null)}
          rightInset={desktopPanelOpen ? DESKTOP_PANEL_RIGHT_CLEARANCE_PX : 0}
        />
      )}

      {/* BottomSheet — mobile only (vaul v2, venue-centric API). Map mode
          (#129), OR mapUnavailable (#524) — the card then opens on top of
          the list itself, with no map behind it; BottomSheet.tsx's own
          `open = venue !== null` already renders a closed drawer for a null
          selection, so this is safe to mount whenever mapUnavailable
          regardless of whether a venue is currently selected. */}
      {isMobile && (viewMode === "map" || mapUnavailable) && (
        <BottomSheet
          key={selectedVenueId ?? selectedEvent?.id ?? "empty"}
          venue={selectedVenue}
          event={selectedVenue ? null : selectedEvent}
          userLocation={userLocation}
          onSeeOpenNow={handleSeeOpenNow}
          eventHere={eventHereFor(selectedVenueId)}
          box={getBoxById(selectedVenueId)}
          onCheckinSuccess={(result) => handleBoxCheckinSuccess(selectedVenueId, result)}
          // The tour's box steps hold the sheet open (#159); undefined otherwise.
          forceExpanded={tour ? tourCardExpanded : undefined}
          inert={tour !== null}
          onClose={() => {
            setSelectedVenueId(null);
            closeEventCard();
          }}
          walk={walkFor(selectedVenueId)}
        />
      )}

      {/* DesktopSidePanel (#682, 8b) — fixed right-hand shell. `sidePanelView`
          decides content: the venue/box card (unchanged from 8a — Map mode
          #129 or mapUnavailable #524's fallback), or, new in 8b, the Saved
          list / Menu (HamburgerMenuContent — the SAME content mobile's
          HamburgerMenu renders, different shell, see that component's own
          header for why). `panelHeadingId` names whichever view's own
          focusable heading DesktopSidePanel should focus on view change. */}
      <DesktopSidePanel
        open={desktopPanelOpen}
        onClose={closeDesktopPanel}
        headingId={panelHeadingId}
        // The tour (#159) shows cards here; nothing on them may be pressed.
        inert={tour !== null}
      >
        {(close) => {
          if (eventPanelOpen && selectedEvent) {
            return (
              <EventPanel
                key={selectedEvent.id}
                event={selectedEvent}
                locale={locale}
                userLocation={userLocation}
                headingId={`event-card-title-${selectedEvent.id}`}
                onClose={close}
                onSeeOpenNow={handleSeeOpenNow}
              />
            );
          }
          if (sidePanelView?.kind === "venue") {
            if (!selectedVenue) return null;
            return (
              <DesktopVenueWindow
                key={sidePanelView.id}
                venue={selectedVenue}
                box={getBoxById(sidePanelView.id)}
                onCheckinSuccess={(result) => handleBoxCheckinSuccess(sidePanelView.id, result)}
                onClose={close}
                eventHere={eventHereFor(sidePanelView.id)}
                // "← Saved" (#682 8b) — a back-navigation, NOT a close: uses
                // `backToSaved` (keeps the venue selected), never `close`
                // (a real, full close — same for every card, coordinator
                // correction after PR #688 review).
                backTo={
                  sidePanelView.from === "saved"
                    ? { label: t("panel.backToSaved", locale), onClick: backToSaved }
                    : undefined
                }
                walk={walkFor(sidePanelView.id)}
              />
            );
          }
          if (sidePanelView?.kind === "saved") {
            return (
              <HamburgerMenuContent
                view="saved"
                locale={locale}
                savedVenues={savedVenues}
                onSelectVenue={handleSelectSavedVenue}
                onClose={close}
                headingId={panelHeadingId}
              />
            );
          }
          if (sidePanelView?.kind === "menu") {
            return (
              <HamburgerMenuContent
                view="top"
                locale={locale}
                onShowWelcome={onShowWelcome}
                viewMode={viewMode}
                onToggleView={() => handleViewModeChange(viewMode === "map" ? "list" : "map")}
                mapDisabled={mapUnavailable}
                onClose={close}
                headingId={panelHeadingId}
                // Not wrapped in close(): startTour shuts this panel itself,
                // and close()'s focus hop back to the nav item would pull
                // focus out of the tour (#159).
                onStartTour={handleMenuStartTour}
              />
            );
          }
          return null;
        }}
      </DesktopSidePanel>

      {/* BottomNav — LAST in DOM order so keyboard users reach the map and the
          search first (spec §12). Rendered unconditionally: it hides ITSELF
          (overlayRegistry.ts) whenever venueSheetOpen or any other
          full-surface overlay is open (#542) — see the useOverlayRegistration
          call above for venueSheetOpen's own registration. `rightInset`
          (#682) shifts it left, clear of the desktop side panel — see
          BottomNav's own header for why the shift is a CSS var, not a class. */}
      <BottomNav
        locale={locale}
        // Mobile reads `menuSection` (unchanged); desktop reads
        // `sidePanelView` instead (#682 8b) — a venue card lights neither
        // bar item, matching the issue's "only the list is lit" rule for a
        // venue opened FROM Saved.
        openSection={
          isMobile
            ? menuSection
            : sidePanelView?.kind === "saved"
            ? "saved"
            : sidePanelView?.kind === "menu"
            ? "top"
            : null
        }
        onSectionTap={handleNavSectionTap}
        geoState={geo.state}
        isLocating={isLocating}
        isDrifted={isDrifted}
        onNearMe={handleNearMe}
        boxesActive={selectedCategories?.has("blessing_box") ?? false}
        onBoxesToggle={handleBoxesToggle}
        navRef={navRef}
        rightInset={desktopPanelOpen ? DESKTOP_PANEL_RIGHT_CLEARANCE_PX : 0}
      />

      {/* Guided tour (#159) — after BottomNav so it's the last thing in the
          DOM and paints over everything. Deliberately NOT in the
          useOverlayRegistration set: that would hide BottomNav, and the tour
          points at its Near me / Saved / Menu items. */}
      {tour && (
        <GuidedTour
          locale={locale}
          sampleVenue={tour.sampleVenue}
          sampleBox={tour.sampleBox}
          onDemoBoxes={handleTourDemoBoxes}
          mapboxMap={mapboxMap}
          onShowVenue={handleTourShowVenue}
          onDemoSearch={handleTourDemoSearch}
          onShowFilters={setFilterPanelOpen}
          onClose={endTour}
          returnFocusSelector={tour.returnFocusSelector}
        />
      )}
    </div>
  );
}
