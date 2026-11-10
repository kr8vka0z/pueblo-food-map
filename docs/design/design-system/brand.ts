// Pueblo Food Map's settings for the mockup kit: name, logo, fonts, colors, corners, the menu and the index areas.
// build.ts turns it into dist/brand.css (CSS custom properties that mock.css reads) and the menu on every page.
// Every hex is copied from src/app/globals.css @theme, the source of truth. Never change one here to pass contrast.

export type FontFile = { family: string; file: string; weight: string }; // file under assets/, e.g. "Inter-Variable.woff2"
export type NavItem = [label: string, slug: string, icon: string]; // icon: a name from icons.ts (Lucide)

export const brand = {
  siteName: "Pueblo Food Map",
  adminLabel: "Design system", // beside the wordmark at the top of the menu, and alone in the phone top bar
  user: "reviewer@example.com", // shown at the foot of the menu; keep it made up
  logo: "assets/logo.svg", // the wordmark in bone-50, for the sage menu
  logoOnLight: "assets/logo-on-light.svg", // the wordmark in navy, as on the splash screen
  round: "Round 1", // shown on the index; bump it each review round

  fonts: {
    display: "'Fraunces', Georgia, serif", // --font-display in globals.css
    body: "'Public Sans', system-ui, -apple-system, sans-serif", // --font-sans in globals.css
    // Copied from public/fonts/; weight ranges match globals.css's @font-face rules.
    files: [
      { family: "Fraunces", file: "Fraunces-Variable.woff2", weight: "300 900" },
      { family: "Public Sans", file: "PublicSans-Variable.woff2", weight: "100 900" },
    ] as FontFile[],
  },

  // Keys are CSS custom property names. The first block is the kit's own slots (mock.css reads --primary and so
  // on), each filled with the PFM token the code uses for that job. The second block is the PFM tokens under their
  // real names (--color-sage-600 ...), so the component replicas on the Components page use the same variables
  // as src/. Hex only (contrast is computed).
  colors: {
    "primary-deep": "#1F4639", // sage-700
    primary: "#2C5F4F", // sage-600: the kit's dark structure color (menu, headings); bone-50 or white words on it
    accent: "#F7943C", // brand-orange: the main button fill, as on the splash screen
    "on-accent": "#190F3F", // brand-navy: words on the orange button
    // WHY the same orange: PFM has no darker hover orange. Its buttons brighten with a filter (PRESS_FEEDBACK in
    // src/lib/interactionStyles.ts), so a made-up second orange would be a color the site never shows.
    "accent-strong": "#F7943C",
    "accent-text": "#1F4639", // sage-700: link and phone-link words (sage-600 is the hover)
    "accent-soft": "#D1DDD3", // sage-100: small words on sage
    ink: "#2D2A26", // ink-700: everyday words
    muted: "#5F5A52", // ink-500: second lines
    edge: "#D4CDB8", // bone-300: outline button and search bar edge at rest
    line: "#E8E3D6", // bone-200: card borders and dividers
    surface: "#FBFAF6", // bone-50: the paper every page sits on
    shadow: "#1A1817", // ink-900: PFM shadows are ink-tinted rgba(26,24,23,…)
    okbg: "#EAF0EC", oktx: "#1F4639", // sage-50 / sage-700: the "good" tag (ActivityLog)
    inbg: "#D1DDD3", intx: "#1F4639", // sage-100 / sage-700: the SNAP and WIC badges
    wnbg: "#F8E2D4", wntx: "#7C2D12", // clay-100 / clay-700: the "Public report" and "bad" tags
    bdbg: "#F8E2D4", bdtx: "#B91C1C", // clay-100 / danger: PFM has no pale red, the clay tint is reused

    "color-brand-navy": "#190F3F",
    "color-brand-orange": "#F7943C",
    "color-brand-yellow": "#FFD166",
    "color-bone-50": "#FBFAF6",
    "color-bone-100": "#F4F1EA",
    "color-bone-200": "#E8E3D6",
    "color-bone-300": "#D4CDB8",
    "color-ink-400": "#6A645A",
    "color-ink-500": "#5F5A52",
    "color-ink-700": "#2D2A26",
    "color-ink-900": "#1A1817",
    "color-sage-50": "#EAF0EC",
    "color-sage-100": "#D1DDD3",
    "color-sage-500": "#4A8466",
    "color-sage-600": "#2C5F4F",
    "color-sage-700": "#1F4639",
    "color-clay-100": "#F8E2D4",
    "color-clay-500": "#C2410C",
    "color-clay-700": "#7C2D12",
    "color-success": "#15803D",
    "color-warning": "#B45309",
    "color-danger": "#B91C1C",
    "color-cat-pantry": "#BE2D45",
    "color-cat-grocery": "#1F4E8C",
    "color-cat-convenience": "#0F6573",
    "color-cat-farm": "#92591D",
    "color-cat-garden": "#2C5F4F",
    "color-cat-landscape": "#58772B",
    "color-cat-meal": "#6B3FA0",
    "color-cat-blessing": "#C2447B",
  },

  // Corners, smallest to largest (pixels): globals.css --radius-sm/md/lg/xl. Pills and badges are fully round.
  radius: { sm: 6, md: 10, lg: 14, xl: 20 },

  // Index headings, in order. The public site comes first, admin second; the design system pages sit above both
  // until the screen mockups exist.
  areas: ["Design system", "Public site", "Admin"],

  // The menu. A null group has no heading. Slugs are page file names (no .html). Only pages that exist are listed,
  // or the build warns about a missing page.
  nav: [
    [null, [["Overview", "index", "layout-dashboard"]]],
    ["Design system", [["Brand", "brand", "megaphone"], ["Foundations", "foundations", "layout-dashboard"], ["Components", "components", "list"], ["Icons", "icons", "search"], ["Patterns", "patterns", "clipboard-list"]]],
  ] as [string | null, NavItem[]][],
};
