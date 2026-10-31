/**
 * MapScreenStandIn — a copy of the map screen's frame (search bar and bottom
 * nav, no map) for returning visitors, until MapWrapper's chunk arrives
 * (#730). Its search field already works: a visitor can tap it and type.
 *
 * WHY: since #719 a first-time visitor sees the server-rendered splash at
 * first paint, but a returning visitor or a shared link skips the splash and
 * saw a blank page until MapWrapper (`ssr:false`, ~2.8 s on a throttled
 * phone) loaded. HomePageClient renders this in the server HTML while the
 * gate is unresolved (`pending`, which globals.css hides unless the inline
 * SPLASH_GATE_SCRIPT set data-splash-seen, so first-time visitors still get
 * only the splash), then as MapWrapper's `loading` placeholder until the
 * chunk mounts, which removes it.
 *
 * Typing carries over: the input is a plain uncontrolled <input>, usable
 * before hydration with no handler of ours. Each takeover reads it with
 * readStandInSearch() while rendering, while the old copy is still in the
 * DOM: the loading copy (a new element, since it mounts in another spot of
 * the tree) takes over the pending one's text and focus, and MapWrapper
 * starts its query from the text and moves focus to the real search field,
 * so the search runs on what was typed and the phone keyboard stays up.
 *
 * No jump on takeover: the search bar IS the real SearchBar (uncontrolled,
 * filters control drawn only), and the nav uses BottomNav's own classes from
 * bottomNavShared, so both land on the same boxes. The area between is left
 * as the page background, which is what the list placeholder (ListView)
 * paints first anyway.
 *
 * Only the input is live: the filters control and the nav are `inert` and
 * `aria-hidden`, and the whole stand-in is removed when the real screen
 * mounts, so a screen reader never meets two search fields. Labels come in
 * as plain strings from the server shell (HomeShell) so this file never
 * imports the i18n dictionary (see HomePageClient's header for why that
 * matters).
 */

import { useLayoutEffect, useRef, useState } from "react";
import { Locate, Star, HandHelping, Menu } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import { BoxHeartIcon, ICON_CLASS, ITEM_CLASS, NAV_CLASS, colorFor } from "@/components/bottomNavShared";

export interface StandInLabels {
  search: string;
  filters: string;
  nearMe: string;
  saved: string;
  boxes: string;
  help: string;
  menu: string;
}

/** What the visitor typed into the stand-in on screen, if any (call while rendering). */
export function readStandInSearch(): { value: string; focused: boolean } {
  const input =
    typeof document === "undefined" ? null : document.querySelector<HTMLInputElement>("[data-map-standin] input");
  return { value: input?.value ?? "", focused: !!input && input === document.activeElement };
}

/** Focus `input` with the caret after its text (a takeover from the stand-in). */
export function focusAtEnd(input: HTMLInputElement | null | undefined) {
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

export default function MapScreenStandIn({ labels, pending }: { labels: StandInLabels; pending?: boolean }) {
  // The pending copy is the first one; the loading copy takes over from it.
  const [carried] = useState(() => (pending ? { value: "", focused: false } : readStandInSearch()));
  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (carried.focused) focusAtEnd(rootRef.current?.querySelector("input"));
  }, [carried]);

  const items: [string, React.ReactNode][] = [
    [labels.nearMe, <Locate key="n" aria-hidden className={ICON_CLASS} />],
    [labels.saved, <Star key="s" aria-hidden className={ICON_CLASS} />],
    [labels.boxes, <BoxHeartIcon key="b" className={ICON_CLASS} active={false} />],
    [labels.help, <HandHelping key="h" aria-hidden className={ICON_CLASS} />],
    [labels.menu, <Menu key="m" aria-hidden className={ICON_CLASS} />],
  ];
  return (
    // Same box chain as HomePageClient's <main> > MapWrapper's root div, so
    // SearchBar's `absolute` resolves against the same box.
    <div
      ref={rootRef}
      data-map-standin=""
      data-map-standin-pending={pending ? "" : undefined}
      className="flex-1 flex flex-col min-h-0"
    >
      <div className="relative h-full w-full">
        <SearchBar
          defaultValue={carried.value}
          placeholder={labels.search}
          ariaLabel={labels.search}
          filtersButton={{ count: 0, ariaLabel: labels.filters }}
        />
        {/* data-bottom-nav: globals.css positions the bar's `bottom` off it. */}
        <div data-bottom-nav="" aria-hidden inert className={NAV_CLASS}>
          <ul className="flex h-full items-stretch 2xl:items-center 2xl:gap-0.5">
            {items.map(([label, icon]) => (
              <li key={label} className="flex flex-1 2xl:flex-none 2xl:h-11">
                <span className={ITEM_CLASS + " " + colorFor(false)}>
                  {icon}
                  <span>{label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
