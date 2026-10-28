/**
 * MapScreenStandIn — a still copy of the map screen's frame (search bar and
 * bottom nav, no map) for returning visitors, until MapWrapper's chunk
 * arrives (#730).
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
 * No jump on takeover: the search bar IS the real SearchBar (noop handlers),
 * and the nav uses BottomNav's own classes from bottomNavShared, so both land
 * on the same boxes. The area between is left as the page background, which
 * is what the list placeholder (ListView) paints first anyway.
 *
 * Not interactive: `inert` blocks focus and pointer, `aria-hidden` keeps it
 * out of the accessibility tree, so a screen reader never hears the bar
 * twice. Labels come in as plain strings from the server shell (HomeShell)
 * so this file never imports the i18n dictionary (see HomePageClient's
 * header for why that matters).
 */

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

const noop = () => {};

export default function MapScreenStandIn({ labels, pending }: { labels: StandInLabels; pending?: boolean }) {
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
      data-map-standin=""
      data-map-standin-pending={pending ? "" : undefined}
      aria-hidden
      inert
      className="flex-1 flex flex-col min-h-0"
    >
      <div className="relative h-full w-full">
        <SearchBar
          value=""
          onChange={noop}
          placeholder={labels.search}
          ariaLabel={labels.search}
          filtersButton={{ count: 0, onClick: noop, ariaLabel: labels.filters }}
        />
        {/* data-bottom-nav: globals.css positions the bar's `bottom` off it. */}
        <div data-bottom-nav="" className={NAV_CLASS}>
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
