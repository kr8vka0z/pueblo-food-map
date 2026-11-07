# Mockup kit

**In this repo:** Pueblo Food Map's design-system review pages, a copy of the shared mockup kit. Colors are copied
from `src/app/globals.css` `@theme` into `brand.ts`; the Components page rebuilds live components from their real
classes (the "Pueblo Food Map: replicas" section at the end of `mock.css`). The phone view is 360 pixels wide, the
site's baseline phone. These are Bun scripts, kept out of the app's `tsc` (`tsconfig.json` exclude). Build from this
folder: `MOCK_DIST=<a path containing /scratch/> bun build.ts`. `dist/` is gitignored.

Static, clickable mockups of an admin (or any app) redesign, plus the design-system pages that go with them:
Brand, Foundations, Components, Icons and Patterns. The owner reviews them on a public link before anything is
built. Every page has a Notes panel that says what changes, what's kept as is, and what to check.

It's brand-neutral. The full worked example is the Rescue Ready repo's `docs/design/admin-redesign/`.

## Start a project

1. Copy this folder into the project as `docs/design/<name>/` (for example `docs/design/admin-redesign/`).
2. Open `brand.ts` and set the site: name, logo files, fonts, colors, corners, the admin menu list and the index
   areas. That's the only file a new site needs to change. Everything else reads it.
3. Replace the placeholder pages' content with the project's own, keeping every name and number made up.
4. Add a `dist/` line to the project's `.gitignore`.

## Brand

- **Colors** live in `brand.ts → colors`. The keys are the CSS custom properties `mock.css` reads. Use hex only:
  the Foundations page works out every contrast ratio from them, and the build stops, naming the pair, when a
  color used for words is under 4.5 to 1 or one used for edges and icons is under 3 to 1. Each swatch row in
  `pages/02-foundations.ts` says how the color is used on white and on the primary (`text`, `edge`, `show`
  for a ratio shown but never used, `deco`, `-`).
- **The primary must be dark.** The admin menu, facts band and save bar put white words on it.
- **`on-accent`** is the word color on the main button. Make it white if the accent is dark.
- **Fonts** default to the system font. To use a real one, put a variable `.woff2` in `assets/`, add it to
  `brand.ts → fonts.files` (`{ family, file, weight: "400 700" }`), and put the family first in
  `fonts.display` or `fonts.body`.
- **Logo**: `assets/logo.svg` is drawn for the primary color, `assets/logo-on-light.svg` for white pages.
  Replace both.

## Add a page

Make a file in `pages/` that exports `pages: Page[]` (see `lib.ts → Page`). Build pages only from the helpers in
`lib.ts`, so one change to `mock.css` changes every page. Each page needs a slug, title, area (one of
`brand.areas`), the menu item it lights up, a one-line blurb, and `changed` (plus `kept` and `check` when they
apply). Start from `pages/10-example-list.ts` (list with side panel) or `pages/11-example-form.ts` (a form).
Files build in name order; the index (`pages/00-index.ts`) lists them by area.

## Build

```bash
MOCK_DIST=<dir> bun build.ts
```

`MOCK_DIST` is required, so nothing is built inside the synced skill folder by accident. The build empties that
folder first, so it refuses any folder that isn't inside the kit's own folder (a project copy's `dist/`), under a
path containing `/scratch/`, or named `dist`, `out` or `build`, and always refuses `/`, the home folder, the kit
itself or a folder above it, and a git repo. It stops on a brand color that's too faint (see Brand), and warns
about links to pages that don't exist and menu icons that aren't in `icons.ts`.

## Show the owner

Deploy the built folder as a public static site. `_headers` and every page's meta tag keep search engines out.

```bash
CLOUDFLARE_API_TOKEN=$(op read "op://<vault>/<deploy token item>/credential") CLOUDFLARE_ACCOUNT_ID=<account id> \
  bunx wrangler deploy --name <project>-mocks --assets <dir> --compatibility-date <today>
```

The project's `AGENTS.md` names its deploy token item and account id.

The owner reviews with preview annotations on the live link. **Anything not mentioned counts as approved.**
Put each round's decisions into the pages, bump `brand.round`, and deploy again to the same name.

## Rulings built in

The pages already follow the owner's rulings (Cancel beside Save, picking that ends on Done, three-dot row menus, slider switches, no subtitles, 44-pixel targets). The rulings themselves live in one place: `references/design-system.md`, "Starter patterns and the owner's rulings". Change a page only when the owner overrules one.

The kit was built for an admin or app (lists, forms, side panels, picking several). For a public marketing site, keep the Brand, Foundations, Components and Icons pages and drop the app patterns you don't need.

## Files

| File | What it is |
|---|---|
| `brand.ts` | The one file to edit per site |
| `build.ts` | Writes the HTML pages and `brand.css` |
| `lib.ts` | Building blocks every page uses |
| `mock.css` | Every component's look, reading `brand.css` |
| `mock.js` | Side panel, menus, picking several, search, must-tick confirms, the review strip |
| `icons.ts` | Lucide icon shapes, with their license notice |
| `pages/` | Index, the five design-system pages, two example screens |
