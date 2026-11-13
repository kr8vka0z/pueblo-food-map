# Design-system pages

Pueblo Food Map's design-system review pages: Brand, Foundations, Components (map and cards, pages and forms,
admin), Icons, Patterns, and the parked logo options. The owner reviewed them, and the repo's `DESIGN.md` is
written from them. They are static HTML mockups, not part of the site: nothing here is imported by `src/` or
deployed with the app.

This folder is a copy of a shared mockup kit, filled in for this site. Colors are copied from
`src/app/globals.css` `@theme` into `brand.ts`. The Components pages rebuild live components from their real
classes (the replica blocks in `mock.css`). The phone view is 360 pixels wide, the site's baseline phone. These are
Bun scripts, kept out of the app's `tsc` by the `tsconfig.json` exclude.

## Build

```bash
cd docs/design/design-system
MOCK_DIST=<dir> bun build.ts
```

`MOCK_DIST` is required. The build empties that folder first, so it refuses any folder that isn't this folder's
own `dist/` (gitignored), a path containing `/scratch/`, or a folder named `dist`, `out` or `build`; it always
refuses `/`, the home folder, the kit itself or a folder above it, and a git repo. It stops on a color used for
words that is under 4.5 to 1, or one used for edges and icons that is under 3 to 1, naming the pair. It warns about
links to pages that don't exist and menu icons that aren't in `icons.ts`. Open the built `index.html` in a browser.

## Reviewing

The owner reviews the built pages and marks them up. **Anything not mentioned counts as approved.** Each round's
decisions go into the pages (bump `brand.round`), then into `DESIGN.md` in the same change. A review copy, when one
is shared, is a separate static site with search engines kept out (`_headers` and each page's meta tag). It is
never the app's Worker; the app deploys only through GitHub Actions (`AGENTS.md`).

## Rulings built in

The pages follow the owner's interface rulings: Cancel beside Save, picking several ends on Done, per-row actions
in one three-dot menu, sliders for a two- or three-way switch, no subtitle under an admin page title, and 48-pixel
touch targets. `DESIGN.md` lists the rulings that apply to this site. Change a page only when the owner overrules
one.

## Files

| File | What it is |
|---|---|
| `brand.ts` | This site's name, fonts, colors, corners and menus |
| `build.ts` | Writes the HTML pages and `brand.css` |
| `lib.ts` | Building blocks every page uses, including the component entry layout |
| `mock.css` | Every component's look, reading `brand.css` |
| `mock.js` | Side panel, menus, picking several, the review strip |
| `icons.ts` | Lucide icon shapes, with their license notice |
| `pages/` | The index and the design-system pages, one file each |
| `assets/` | Fonts, the current logo files and the parked logo options |
