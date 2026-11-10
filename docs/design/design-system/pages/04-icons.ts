// Design system: the icon library. Every Lucide icon the site imports, drawn from the lucide-react the site ships
// (the LU block below was generated from node_modules/lucide-react, so the shapes match the live site, not the
// kit's icons.ts copies), plus the four drawings made for this site, copied from their components. Sizes are the
// compiled values: this repo's @theme makes size-5 24 pixels and size-6 32, so class-sized icons are larger than
// their names. The meaning table flags any icon with two meanings or two icons for one meaning.
import { hex, dodont, toc, type Page } from "../lib";

// Generated from node_modules/lucide-react 1.65.0 (the version the site ships): [lucide file name, inner SVG].
const LU: Record<string, [string, string]> = {
  "X": ["x", "<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>"],
  "Star": ["star", "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\"/>"],
  "Phone": ["phone", "<path d=\"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384\"/>"],
  "MapPin": ["map-pin", "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>"],
  "List": ["list", "<path d=\"M3 5h.01\"/><path d=\"M3 12h.01\"/><path d=\"M3 19h.01\"/><path d=\"M8 5h13\"/><path d=\"M8 12h13\"/><path d=\"M8 19h13\"/>"],
  "HandHelping": ["hand-helping", "<path d=\"M11 12h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 14\"/><path d=\"m7 18 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9\"/><path d=\"m2 13 6 6\"/>"],
  "ExternalLink": ["external-link", "<path d=\"M15 3h6v6\"/><path d=\"M10 14 21 3\"/><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/>"],
  "Clock": ["clock", "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 6v6l4 2\"/>"],
  "Menu": ["menu", "<path d=\"M4 5h16\"/><path d=\"M4 12h16\"/><path d=\"M4 19h16\"/>"],
  "Map": ["map", "<path d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z\"/><path d=\"M15 5.764v15\"/><path d=\"M9 3.236v15\"/>"],
  "Locate": ["locate", "<line x1=\"2\" x2=\"5\" y1=\"12\" y2=\"12\"/><line x1=\"19\" x2=\"22\" y1=\"12\" y2=\"12\"/><line x1=\"12\" x2=\"12\" y1=\"2\" y2=\"5\"/><line x1=\"12\" x2=\"12\" y1=\"19\" y2=\"22\"/><circle cx=\"12\" cy=\"12\" r=\"7\"/>"],
  "LocateFixed": ["locate-fixed", "<line x1=\"2\" x2=\"5\" y1=\"12\" y2=\"12\"/><line x1=\"19\" x2=\"22\" y1=\"12\" y2=\"12\"/><line x1=\"12\" x2=\"12\" y1=\"2\" y2=\"5\"/><line x1=\"12\" x2=\"12\" y1=\"19\" y2=\"22\"/><circle cx=\"12\" cy=\"12\" r=\"7\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>"],
  "Loader2": ["loader-circle", "<path d=\"M21 12a9 9 0 1 1-6.219-8.56\"/>"],
  "CircleHelp": ["circle-question-mark", "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><path d=\"M12 17h.01\"/>"],
  "CalendarPlus": ["calendar-plus", "<path d=\"M16 18h6\"/><path d=\"M16 2v3\"/><path d=\"M19 15v6\"/><path d=\"M21 11.5V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h8.3\"/><path d=\"M3 9h18\"/><path d=\"M8 2v3\"/>"],
  "Share2": ["share-2", "<circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><line x1=\"8.59\" x2=\"15.42\" y1=\"13.51\" y2=\"17.49\"/><line x1=\"15.41\" x2=\"8.59\" y1=\"6.51\" y2=\"10.49\"/>"],
  "Search": ["search", "<path d=\"m21 21-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/>"],
  "RotateCcw": ["rotate-ccw", "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/>"],
  "Navigation": ["navigation", "<polygon points=\"3 11 22 2 13 21 11 13 3 11\"/>"],
  "MessageSquareText": ["message-square-text", "<path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\"/><path d=\"M7 11h10\"/><path d=\"M7 15h6\"/><path d=\"M7 7h8\"/>"],
  "MessageSquare": ["message-square", "<path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\"/>"],
  "MapPinPlus": ["map-pin-plus", "<path d=\"M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/><path d=\"M16 18h6\"/><path d=\"M19 15v6\"/>"],
  "ListOrdered": ["list-ordered", "<path d=\"M11 5h10\"/><path d=\"M11 12h10\"/><path d=\"M11 19h10\"/><path d=\"M4 4h1v5\"/><path d=\"M4 9h2\"/><path d=\"M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02\"/>"],
  "Lightbulb": ["lightbulb", "<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5\"/><path d=\"M9 18h6\"/><path d=\"M10 22h4\"/>"],
  "Info": ["info", "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>"],
  "History": ["rotate-ccw-clock", "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/><path d=\"M12 7v5l4 2\"/>"],
  "Heart": ["heart", "<path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\"/>"],
  "Flag": ["flag", "<path d=\"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528\"/>"],
  "Eye": ["eye", "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>"],
  "CreditCard": ["credit-card", "<rect width=\"20\" height=\"14\" x=\"2\" y=\"5\" rx=\"2\"/><line x1=\"2\" x2=\"22\" y1=\"10\" y2=\"10\"/><path d=\"M6 14h2\"/>"],
  "Compass": ["compass", "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"/>"],
  "ChevronUp": ["chevron-up", "<path d=\"m18 15-6-6-6 6\"/>"],
  "ChevronRight": ["chevron-right", "<path d=\"m9 18 6-6-6-6\"/>"],
  "ChevronDown": ["chevron-down", "<path d=\"m6 9 6 6 6-6\"/>"],
  "ChevronLeft": ["chevron-left", "<path d=\"m15 18-6-6 6-6\"/>"],
  "Check": ["check", "<path d=\"M20 6 9 17l-5-5\"/>"],
  "Apple": ["apple", "<path d=\"M12 6.528V3a1 1 0 0 1 1-1h0\"/><path d=\"M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21\"/>"],
  "ArrowUp": ["arrow-up", "<path d=\"m5 12 7-7 7 7\"/><path d=\"M12 19V5\"/>"],
  "CornerUpLeft": ["corner-up-left", "<path d=\"M20 20v-7a4 4 0 0 0-4-4H4\"/><path d=\"M9 14 4 9l5-5\"/>"],
  "CornerUpRight": ["corner-up-right", "<path d=\"m15 14 5-5-5-5\"/><path d=\"M4 20v-7a4 4 0 0 1 4-4h12\"/>"],
  "CircleCheck": ["circle-check", "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16 9-5.5 5.5L8 12\"/>"],
  "ClipboardCheck": ["clipboard-check", "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><path d=\"m9 14 2 2 4-4\"/>"],
  "Globe": ["globe", "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"/><path d=\"M2 12h20\"/>"],
  "Ticket": ["ticket", "<path d=\"M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z\"/><path d=\"M13 5v2\"/><path d=\"M13 17v2\"/><path d=\"M13 11v2\"/>"],
};
const LICENSE = "ISC License\n\nCopyright (c) 2026 Lucide Icons and Contributors\n\nPermission to use, copy, modify, and/or distribute this software for any\npurpose with or without fee is hereby granted, provided that the above\ncopyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\" AND THE AUTHOR DISCLAIMS ALL WARRANTIES\nWITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF\nMERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR\nANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES\nWHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN\nACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF\nOR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.\n\n---\n\nThe following Lucide icons are derived from the Feather project:\n\nairplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out\n\nThe MIT License (MIT) (for the icons listed above)\n\nCopyright (c) 2013-present Cole Bemis\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n";

const lu = (n: string, size = 24, extra = "") => `<svg class="fi-ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"${extra}>${LU[n][1]}</svg>`;
const kebab = (n: string) => LU[n][0];

// The site's own drawings, copied from the components named beside each.
const FILTER = `<path d="M4 6h16M7 12h10M10 18h4"/>`; // SearchBar.tsx:55, 2.2 stroke
const BOX = (on: boolean) => `<path d="M3 10 12 4l9 6"/><path d="M5 9v11h14V9"/><path d="M12 17.5s-3-1.8-3-3.6a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.8-3 3.6-3 3.6z" fill="${on ? "currentColor" : "none"}"/>`; // bottomNavShared.tsx:32
const PIN = "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"; // PinShadow.tsx PIN_PATH
const STAR_POINTS = "12,5.6 13.12,8.46 16.19,8.64 13.81,10.59 14.59,13.56 12,11.9 9.41,13.56 10.19,10.59 7.82,8.64 10.88,8.46"; // src/lib/eventPins.ts
const shadow = (px: number, base: number) => `<g transform="translate(0 ${2 / px})" fill="#000" stroke="#000" stroke-linejoin="round">${[[8, 0.01], [6, 0.015], [4, 0.025], [2, 0.03], [1, 0.04]].map(([g, o]) => `<g opacity="${o}" stroke-width="${base + g / px}"><path d="${PIN}"/></g>`).join("")}</g>`;
const placePin = (size: number, color: string) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="overflow:visible">${shadow(size / 24, 1.5)}<g fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${LU.MapPin[1]}</g></svg>`;
const pickedPin = (color: string) => `<svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true" style="overflow:visible"><circle cx="23" cy="23" r="21" fill="none" stroke="${hex("color-sage-500")}" stroke-width="4"/><g transform="translate(5 5) scale(1.5)">${shadow(1.5, 1.5)}<g fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${LU.MapPin[1]}</g></g></svg>`;
const eventPin = (h: number) => `<svg width="${Math.round(h * 20 / 21.5)}" height="${h}" viewBox="2 1 20 21.5" aria-hidden="true" style="overflow:visible">${shadow(h / 21.5, 1.6)}<path d="${PIN}" fill="${hex("color-brand-orange")}" stroke="${hex("color-brand-navy")}" stroke-width="1.6" stroke-linejoin="round"/><polygon points="${STAR_POINTS}" fill="${hex("color-brand-navy")}"/></svg>`;
const own = (inner: string, size: number, sw = 2) => `<svg class="fi-ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:${sw}">${inner}</svg>`;

// ── The set, grouped by job ──────────────────────────────────────────────────────────────────────────────────
const NICK: Record<string, string> = {
  X: "Close", Star: "Saved", MapPin: "Where a place is", Locate: "Near me", LocateFixed: "Near me, found you", Loader2: "Working", Search: "Search", Map: "Map view", List: "List of places", ListOrdered: "Route steps", Navigation: "Get directions", ArrowUp: "Go straight", CornerUpLeft: "Turn left", CornerUpRight: "Turn right", ChevronLeft: "Previous step", ChevronRight: "Next or open", ChevronUp: "Fewer", ChevronDown: "More", Menu: "Menu",
  Phone: "Call", Clock: "Hours", CircleHelp: "Hours unknown", ExternalLink: "Opens another site", Globe: "Website", Share2: "Share", Check: "Done", Flag: "Report a problem", CreditCard: "SNAP", Apple: "WIC", Heart: "Donate",
  CalendarPlus: "Add to calendar", Ticket: "Tickets", ClipboardCheck: "Sign up", CircleCheck: "RSVP", HandHelping: "Help", Eye: "Preview",
  MapPinPlus: "Suggest a place", MessageSquare: "Send us feedback", MessageSquareText: "Text a number", Info: "About this map", History: "Box activity", Compass: "How to use the map", RotateCcw: "Welcome screen", Lightbulb: "Roadmap",
};
const GROUPS: [string, string[]][] = [
  ["Getting around", ["Locate", "LocateFixed", "Loader2", "Search", "Map", "List", "Menu", "X", "ChevronUp", "ChevronDown", "ChevronRight"]],
  ["Directions", ["Navigation", "ListOrdered", "MapPin", "ArrowUp", "CornerUpLeft", "CornerUpRight", "ChevronLeft"]],
  ["A place", ["Phone", "Clock", "CircleHelp", "ExternalLink", "Share2", "Check", "Star", "Flag", "CreditCard", "Apple"]],
  ["Events", ["CalendarPlus", "Globe", "Ticket", "ClipboardCheck", "CircleCheck", "HandHelping", "Heart", "Eye"]],
  ["The menu", ["MapPinPlus", "MessageSquare", "MessageSquareText", "Info", "History", "Compass", "RotateCcw", "Lightbulb"]],
];
const tile = (n: string) => `<div class="itile" data-name="${kebab(n)} ${NICK[n].toLowerCase()}">${lu(n, 28)}<b>${NICK[n]}</b><small>${kebab(n)}</small></div>`;
const total = GROUPS.reduce((t, [, l]) => t + l.length, 0);
const gallery = `<section class="ds fi-icons" id="set">
  <div class="dsh"><h2>The set: Lucide</h2><span class="st built">Live as is</span></div>
  <p class="dsnote">lucide-react ${"1.65.0"}, the version in package.json (^1.65.0) and installed. ISC licence (notice at the foot). Each icon is imported by name, so only the ${total} the site uses are sent to phones.</p>
  <p class="dsp">Simple line drawings on a 24-pixel square, 2-pixel lines with round ends, never filled except where a fill means something (a saved star, Boxes on). An icon helps people find the words faster; it never replaces them.</p>
  ${GROUPS.map(([cat, list]) => `<section class="igroup"><h3>${cat} <span>${list.length}</span></h3><div class="igrid">${list.map(tile).join("")}</div></section>`).join("")}
  <p class="dssz">The kit's own copies in icons.ts are Lucide 1.67.0, used only for this mockup site's menu. Every drawing on this page comes from the site's 1.65.0.</p>
</section>`;

// ── Drawn for this site ──────────────────────────────────────────────────────────────────────────────────────
const drawn = `<section class="ds" id="drawn">
  <div class="dsh"><h2>Drawn for this site</h2><span class="st built">Live as is</span></div>
  <p class="dsp">Four drawings Lucide doesn't have. Each sits on the same 24-pixel grid with round ends, so they read as one set. Draw a new one only when Lucide has nothing close.</p>
  <div class="fi-drawn">
    <div><span class="fi-dbox">${own(FILTER, 20, 2.2)}</span><b>Filters</b><small>Three bars, shortest at the bottom. 20 pixels in the search bar, a slightly heavier 2.2-pixel line so it holds up at that size. SearchBar.tsx:55</small></div>
    <div><span class="fi-dbox">${own(BOX(false), 32)}<span style="color:${hex("color-cat-blessing")};display:inline-flex">${own(BOX(true), 32)}</span></span><b>Boxes (blessing boxes)</b><small>A small house with a heart. On: raspberry and the heart fills, so the shape changes too, not only the color. 32 pixels on phones, 24 from 1536 wide. bottomNavShared.tsx:32</small></div>
    <div><span class="fi-dbox fi-mapbg">${placePin(28, hex("color-cat-pantry"))}${placePin(28, hex("color-cat-farm"))}${pickedPin(hex("color-cat-grocery"))}</span><b>A place on the map</b><small>Lucide's map pin, filled with the category color, a 1.5-pixel white edge, its shadow drawn in the SVG. 28 pixels; picked, 36 inside a 4-pixel sage 500 ring. The tap area is 44 pixels (see below). VenueMarker.tsx, PinShadow.tsx</small></div>
    <div><span class="fi-dbox fi-mapbg">${eventPin(44)}${eventPin(52)}</span><b>An event on the map</b><small>The same pin outline in orange, a navy edge and a navy five-point star in the head. 44 pixels coming up, 52 going on now (with the rings and NOW label), a 48-pixel tap area. EventMarker.tsx, src/lib/eventPins.ts</small></div>
  </div>
</section>`;

// ── Sizes ────────────────────────────────────────────────────────────────────────────────────────────────────
const inUse: [number, string, string][] = [
  [11, "The Clock and Hours unknown icons in the small card badges", "VenueCard.tsx:93, size={11}"],
  [12, "The card's detail lines on a computer (hours, address)", "VenueCardBody.tsx:75, iconSm"],
  [13, "Report a problem; the phone icon on the computer card", "ReportVenueButton.tsx, VenueCardBody.tsx"],
  [14, "Menu rows, Filters rows, Resources actions, the card's lines on a phone, the search popover's list row", "size={14}, the most used"],
  [15, "The phone icon on the phone card and a place's page; the website link; the events list star", "size={15}"],
  [16, "Close in small headers (menu, Filters, location help, event strip); Search on phones; Add to calendar; Share on the event card", "size={16}, h-4 w-4"],
  [18, "Close on the card and route strip; share and save on a computer; Search on a computer; Get directions; the map or list suggestion; chevrons on event rows", "size={18}"],
  [20, "Share and save on the phone card; the Filters drawing; the location help pin; Resources' open and close chevron", "size={20}"],
  [24, "The route's step icons and its previous and next arrows; the bottom bar from 1536 wide", "h-5 w-5 and 2xl:size-5: 24, not 20 (the spacing trap)"],
  [28, "The empty Saved page's star; a map pin", "size={28}"],
  [32, "The bottom bar's icons on phones and tablets", "size-6: 32, not 24 (the spacing trap)"],
];
const proposed: [number, string][] = [
  [14, "Beside 12 to 14-pixel words: menu rows, Filters rows, a card's detail lines, small badges. Takes in today's 11, 12, 13 and 15."],
  [16, "Beside 16-pixel words, and Close in a small header."],
  [20, "Icon buttons on their own: close, share and save on any card, the search bar's icons. Takes in today's 18."],
  [24, "The bottom bar and the route's steps."],
  [28, "An empty page's icon."],
];
const sizesSec = `<section class="ds" id="sizes">
  <div class="dsh"><h2>Sizes</h2><span class="st built">Live as is</span></div>
  <p class="dsnote">The sizes as they are live today, then a proposed set for Kyle to decide on.</p>
  <h3>In use today: eleven sizes</h3>
  <div class="fi-sizes">${inUse.map(([s, where, how]) => `<div><span class="fi-sbox">${lu("Star", s)}</span><p><b>${s} pixels</b>${where}<small>${how}</small></p></div>`).join("")}</div>
  <p class="dssz">Map pins are their own scale: 28 and 36 for places, 44 and 52 for events. Two sizes come out bigger than they're written because this site makes <code>size-5</code> 24 pixels and <code>size-6</code> 32 (Foundations, spacing trap). DESIGN.md says the bottom bar's icons are 24; on a phone they're 32.</p>
  <h3>Proposed, for Kyle: five sizes</h3>
  <div class="fi-proposed"><span class="st new">Proposed</span>
  <div class="fi-sizes">${proposed.map(([s, where]) => `<div><span class="fi-sbox">${lu("MapPin", s)}</span><p><b>${s} pixels</b>${where}</p></div>`).join("")}</div>
  <ul>
    <li><b>The bottom bar: 24 or 32?</b> Its code comment and DESIGN.md say 24; it's 32 live because of the spacing trap, and the approved Bottom bar entry reads 24. Kyle's call: bring it to 24, or keep 32 and write that down.</li>
    <li>Written as a number, <code>size={20}</code>, never a size class: <code>size-5</code> and <code>size-6</code> don't mean 20 and 24 here.</li>
    <li>The line stays 2 pixels at every size. The two exceptions stay: map pins 1.5, the Filters drawing 2.2.</li>
  </ul></div>
</section>`;

// ── Meanings ─────────────────────────────────────────────────────────────────────────────────────────────────
type Row = { i: string; mean: string; where: string; flag?: string; ok?: string };
const rows: Row[] = [
  { i: "X", mean: "Close or dismiss", where: "Place and event cards, the menu, Filters, the route strip, the event strip, the location help card" },
  { i: "Star", mean: "Saved", where: "The bottom bar's Saved, the save button on a card (filled clay when saved), the empty Saved page", flag: "Two meanings: filled orange with a navy edge it means an event (Filters' Events row, the events list, the event line on a place card, and the star inside the event pin)." },
  { i: "MapPin", mean: "Where a place is", where: "The address line on cards and event cards; filled, it is the map pin itself", flag: "Also your own location (the location help card) and the arrive step in walking directions. Close jobs, one drawing; worth a look." },
  { i: "HandHelping", mean: "Help: food help programs", where: "The bottom bar's Help, the menu's Food help programs", flag: "Two meanings: also Volunteer, a link on an event card." },
  { i: "CalendarPlus", mean: "Add to calendar", where: "The event card", flag: "Two meanings: also Share an event, in the menu." },
  { i: "ExternalLink", mean: "Opens another site", where: "A place's website link, Resources' Website links, Donate in the menu", flag: "Two icons for one meaning: an event's Website link uses the globe instead." },
  { i: "Globe", mean: "Website", where: "An event's Website link and any other link on it", flag: "See above: the place card and Resources use the external-link arrow for Website." },
  { i: "MessageSquare", mean: "Send us feedback", where: "The menu", flag: "A near twin: the speech bubble with lines means Text a number on Resources. Two jobs, two very close drawings." },
  { i: "MessageSquareText", mean: "Text a number", where: "Resources' Text links" },
  { i: "CircleCheck", mean: "RSVP", where: "An event card's RSVP link", flag: "A near twin of the plain tick, which means Done. Close drawings, different jobs." },
  { i: "Check", mean: "Done", where: "Link copied (share), added to calendar" },
  { i: "Heart", mean: "Donate", where: "The menu's Donate card, an event's Donate link", ok: "One meaning. The heart inside the Boxes drawing is part of that drawing and means a blessing box." },
  { i: "Locate", mean: "Near me", where: "The bottom bar", ok: "Locate, the filled crosshair once it found you, and the spinner while it looks are one item's three states, not three meanings." },
  { i: "LocateFixed", mean: "Near me, found you", where: "The bottom bar after locating" },
  { i: "Loader2", mean: "Working", where: "Near me while locating" },
  { i: "List", mean: "Places as a list", where: "The menu's List view and Browse all places, the search popover's See as a list" },
  { i: "Map", mean: "Map view", where: "The menu and the map or list suggestion" },
  { i: "Search", mean: "Search", where: "The search bar" },
  { i: "Menu", mean: "Menu", where: "The bottom bar" },
  { i: "Clock", mean: "Hours", where: "A card's hours line, Filters' Open now" },
  { i: "CircleHelp", mean: "Hours unknown", where: "A card with no hours listed", ok: "A different icon from Clock on purpose, so no hours never reads as open. DESIGN.md calls it Help; it isn't." },
  { i: "Phone", mean: "Call", where: "A place's phone number, Resources' Call links" },
  { i: "Share2", mean: "Share", where: "Place and event cards" },
  { i: "Flag", mean: "Report a problem", where: "The foot of a place card" },
  { i: "CreditCard", mean: "SNAP", where: "Filters' SNAP row" },
  { i: "Apple", mean: "WIC", where: "Filters' WIC row" },
  { i: "Navigation", mean: "Get directions", where: "The event card and event page" },
  { i: "ListOrdered", mean: "Route steps", where: "The walking-route strip" },
  { i: "ArrowUp", mean: "Go straight", where: "A route step" },
  { i: "CornerUpLeft", mean: "Turn left", where: "A route step" },
  { i: "CornerUpRight", mean: "Turn right", where: "A route step" },
  { i: "ChevronLeft", mean: "Previous step", where: "The route's step arrows" },
  { i: "ChevronRight", mean: "Next, or open this", where: "The route's next step, the event strip, event card rows", ok: "Both mean forward; fine." },
  { i: "ChevronUp", mean: "Fewer, or close a section", where: "The route's Fewer turns" },
  { i: "ChevronDown", mean: "More, or open a section", where: "The route's More turns, Resources' sections (it turns over when open)" },
  { i: "Ticket", mean: "Tickets", where: "An event card's Tickets link" },
  { i: "ClipboardCheck", mean: "Sign up", where: "An event card's Sign up link" },
  { i: "Eye", mean: "Preview", where: "The Share an event form's preview button" },
  { i: "MapPinPlus", mean: "Suggest a place", where: "The menu" },
  { i: "Info", mean: "About this map", where: "The menu" },
  { i: "History", mean: "Blessing box activity", where: "The menu" },
  { i: "Compass", mean: "Learn how to use this map", where: "The menu (the guided tour)" },
  { i: "RotateCcw", mean: "Show welcome screen", where: "The menu" },
  { i: "Lightbulb", mean: "Roadmap", where: "The menu" },
];
const flagged = rows.filter((r) => r.flag).length;
const meanRow = (r: Row) => `<div class="${r.flag ? "flag" : ""}"><span class="fi-mi">${lu(r.i, 20)}</span><p><b>${r.mean}</b> <code>${kebab(r.i)}</code><small>${r.where}</small>${r.flag ? `<em>${r.flag}</em>` : ""}${r.ok ? `<small class="ok">${r.ok}</small>` : ""}</p></div>`;
const drawnRows = [
  [own(FILTER, 20, 2.2), "Filters", "SearchBar.tsx's own drawing"],
  [own(BOX(true), 20), "Boxes: blessing boxes", "bottomNavShared.tsx's own drawing"],
  [placePin(20, hex("color-cat-pantry")), "A place, in its category color", "The map"],
  [eventPin(22), "An event", "The map"],
].map(([svg, m, w]) => `<div><span class="fi-mi">${svg}</span><p><b>${m}</b><small>${w}</small></p></div>`).join("");
const meanings = `<section class="ds" id="meanings">
  <div class="dsh"><h2>Which icon means what</h2><span class="st built">Live as is</span></div>
  <p class="dsnote">Every icon on the site, with where it shows. ${flagged} are flagged: one icon with two meanings, or two icons for one meaning. Listed for Kyle, not changed.</p>
  <p class="dsp">One meaning per icon, and one icon per meaning, so a person learns it once.</p>
  <div class="fi-mean">${rows.filter((r) => r.flag).map(meanRow).join("")}</div>
  <h3>The rest: one meaning each</h3>
  <div class="fi-mean">${rows.filter((r) => !r.flag).map(meanRow).join("")}${drawnRows}</div>
</section>`;

// ── How to use them ──────────────────────────────────────────────────────────────────────────────────────────
const rules = `<section class="ds" id="rules">
  <div class="dsh"><h2>How to use them</h2></div>
  <ul>
    <li><b>Always beside words, or named.</b> An icon-only button (Close, Share, Save) has a translated name a screen reader says, in English and Spanish. Icons beside words are hidden from screen readers.</li>
    <li><b>The color of the words next to it.</b> Ink 400 for quiet ones (search, chevrons, share), sage 600 or 700 inside links, clay 500 for the saved star, raspberry for Boxes on. Never the only sign of a state.</li>
    <li><b>The tap area is the button, not the drawing:</b> 48 pixels even when the icon is 16. Today the place pins tap at 44 (VenueMarker.tsx:42), under the floor.</li>
    <li><b>No emoji as icons,</b> anywhere.</li>
    <li><b>A new one:</b> search this page first, ask whether words alone would do, check it can't be mistaken for one already here, and take it from Lucide so there's still one set.</li>
  </ul>
  <h3>Do and don't</h3>
  ${dodont(
    [`<span class="fi-word">${lu("Phone", 15)}Call (719) 555-0142</span><span class="fi-word">${lu("Clock", 14)}Open today · 9am – 1pm</span>`, "Icon and words together, the icon in the words' color."],
    [`<span class="fi-word">${lu("Star", 16)}Saved</span><span class="fi-word">${lu("Star", 16, ` style="fill:${hex("color-brand-orange")};stroke:${hex("color-brand-navy")}"`)}Happening today</span>`, "One drawing for two jobs side by side: is the star a saved place or an event?"],
  )}
</section>`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const licence = `<section class="ds" id="licence">
  <div class="dsh"><h2>Licence</h2></div>
  <p class="dsp">Lucide is free and open source under the ISC licence, which allows copying and changing the icons as long as the notice below travels with them. Some Lucide icons come from the Feather project, under the MIT licence; that notice is part of the same file. Copied from node_modules/lucide-react/LICENSE (1.65.0).</p>
  <pre class="fi-lic">${esc(LICENSE)}</pre>
</section>`;

export const pages: Page[] = [{
  slug: "icons", route: "DESIGN.md → Icons", title: "Design system: Icon library", area: "Design system", nav: "Icons",
  blurb: `The ${total} Lucide icons the site uses plus its four own drawings, their sizes, and what each one means.`,
  changed: ["Nothing changes on the site. This page writes down the icons as they are live today.", "A proposed set of five icon sizes, for Kyle to decide on."],
  kept: ["Lucide stays the one set; the Filters, Boxes and pin drawings stay as drawn."],
  check: [
    `${flagged} icons are flagged under Which icon means what: the star (saved and events), the calendar (add to calendar and Share an event), the helping hand (Help and Volunteer), Website drawn two ways, and two near-twin pairs. Keep, or change some?`,
    "The proposed sizes: 14, 16, 20, 24 and 28. And the bottom bar: 24 as written, or 32 as it is live?",
  ],
  html: `<div class="head"><h1>Icon library</h1></div>
  ${toc([["#set", "The set"], ["#drawn", "Drawn for this site"], ["#sizes", "Sizes"], ["#meanings", "Meanings"], ["#rules", "How to use them"], ["#licence", "Licence"], ["foundations.html", "Foundations"]])}
  ${gallery}${drawn}${sizesSec}${meanings}${rules}${licence}`,
}];
