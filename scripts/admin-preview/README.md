# Admin preview

A private copy of the Food Map admin, already signed in and filled with made-up data, so the site's owner can
click through admin changes on a phone or a computer before they reach `dev`. It runs on your own machine.
Nothing it does reaches the live site, the test site (dev.pueblofoodmap.com), GitHub, or a real inbox.

Agents: read [docs/agents/admin-preview.md](../../docs/agents/admin-preview.md) for the rules.

## Start

From the repo root, after `npm ci`, with [Bun](https://bun.sh) and, for the public link,
[cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
installed:

    scripts/admin-preview/start.sh

It builds the app, empties the preview's own storage and fills it with the made-up data, starts everything and
runs the self-check (about 30 seconds). Run it again after any code change.

If a public link was asked for and the tunnel doesn't come up (no address, or the address never answers), it
stops the tunnel, prints no public link and exits with an error. The local preview stays up and its address is
printed. Any other failure after the start begins (build, data, the secrets check, the self-check) also stops a
running tunnel, so an old public address never serves a broken preview. To check the public address it also
looks the new name up through Cloudflare's 1.1.1.1 (DNS over HTTPS), because this machine's own lookup can
cache "no such name" for about a minute.

| Flag | What it does |
|---|---|
| `--no-tunnel` | No public link; the preview is only on this machine. A tunnel an earlier start left running is stopped, so its old address stops working |
| `--staging` | The test-site flavour: the admin shows "Test site: publishing is turned off here" |
| `--foreground` | For a Mac, or Linux without passwordless `sudo`: runs the parts as plain background processes instead of systemd units |

By default the three parts (the app, the sign-in proxy, the tunnel) run as systemd units named
`pfm-admin-preview-worker`, `-proxy` and `-tunnel`, started with `sudo systemd-run` as your own user, so they keep
running after the terminal or agent session that started them closes. They stop at a reboot.

## Addresses it prints

- **Local:** `http://127.0.0.1:8792/__preview/signin`. Opening it signs you in and takes you to the Dashboard.
- **Public** (unless `--no-tunnel`): a random `https://<words>.trycloudflare.com` address with
  `/__preview/signin` on the end. It stays the same while the tunnel runs (a second `start.sh` keeps it) and
  changes after `stop.sh` or `start.sh --no-tunnel`. Send it to the site's owner in chat only, never in a pull
  request or an issue.
- **See the sign-in page:** add `/__preview/signout` to either address. It signs this browser out and shows the
  sign-in page. Any admin page opened after that signs you back in. After a new start, the old sign-in no longer
  counts (each start makes a new secret); opening an admin page signs you in again.

## Stop

    scripts/admin-preview/stop.sh

Stops the tunnel, the proxy and the app, whichever way they were started, and deletes the preview's secrets file.
Logs and the made-up data stay in `.wrangler/admin-preview/` (gitignored) until the next start.

## What works and what doesn't

- Every admin page opens, signed in as the made-up admin `dana@example.org`, who is also the "owner", so the
  Activity tab shows.
- **Data resets on every start.** Everything you change or add (approve, reject, edit, a new place or event)
  lasts until then; the next start empties the store and seeds it again.
- **Publish can't publish.** The Publish bar and its counts show, but pressing Publish says the publish key isn't
  set up. No GitHub key exists here.
- **Emails are not sent.** No email key exists here, so alert and sign-up emails fail quietly.
- **Passkeys don't work.** They are tied to the real site addresses.
- **Map tiles may be blank.** The map key only works on the real site addresses.
- **Visitor and map-usage numbers** say "unavailable right now". No analytics keys exist here, and the proxy
  answers the page's analytics calls itself so nothing reaches the real analytics.
- **"Suggest Spanish"** on the event form doesn't work: it would call Cloudflare's AI service, so the proxy
  refuses it.
- **Signing out** signs out only your browser. Everyone shares one made-up session.
- **"Find location from address"** asks the US Census address lookup over the internet, as on the real site.
  Type only made-up addresses.

## Safety

- The public link is a signed-in sandbox: anyone who has it can click around the made-up data. It holds no real
  keys and no real people's details, it can't publish and it can't send email. The four places copied from the
  public map hold only what the public map already shows.
- The app is not changed. Its sign-in address list, its Origin check and its cookie rules stay as they are; the
  proxy only makes each request look like it came to dev.pueblofoodmap.com. The self-check proves the app still
  refuses a change from a foreign address, and shows no admin content to a request with no sign-in.
- Signing in is part of the made-up data (a session row in the local database). Nothing asks for or reads an
  emailed sign-in code.
- **Its own storage.** The preview's database and file storage live in `.wrangler/admin-preview/state`, deleted
  and recreated empty on every start. It never reads or writes the ordinary `.wrangler/state` that `npm run dev`
  and `npm run preview` use, so nothing you have there shows through the public link. (`vite.config.ts` points
  the app at that folder only when the tool sets `PFM_ADMIN_PREVIEW_PERSIST`.)
- **Its own secrets.** Your `.dev.vars` and `.env` files are never used by the preview's app and are never
  changed. Each start writes a fresh secrets file with exactly three entries (a random `BETTER_AUTH_SECRET`, and
  the made-up admin as the only allowed and owner email), puts it beside the built app in place of whatever the
  build copied there, and checks just before the app starts that nothing else is there. The self-check confirms
  the app loaded only that file. If any repo-root `.env*` or `.dev.vars*` file (other than `.env.example`)
  contains the text `CLOUDFLARE_` or `WRANGLER_` anywhere, in any letter case, the start refuses before building
  and names the file and the word (never a value or a line), because the build tools would load it. It is a
  plain text search, not a reading of the file's settings: the build tools each read these files their own way
  (`KEY: value`, an invisible byte-order mark at the start, `export`, Windows line endings), and a search for the
  word catches every way at once. So a comment that only mentions the word is refused too: move the file aside,
  or remove that line, while the preview runs.
- Everything is local: nothing runs `wrangler deploy` or touches a remote database, and every tool starts with an
  empty environment, so no Cloudflare token can reach it.

## Files

| File | What it is |
|---|---|
| `start.sh` | Builds, seeds and starts everything, then runs the self-check |
| `stop.sh` | Stops everything (systemd units and `--foreground` processes, by saved PID) and deletes the secrets file |
| `selfcheck.sh` | The one check: sign-in lands on /admin, ten admin pages, three images, one admin save, a foreign Origin refused, Suggest Spanish blocked, sign-out, the app with no cookie shows no admin content, and the app loaded only the tool's secrets file. `selfcheck.sh --lifecycle` runs the start/stop proofs (a root env file mentioning a Cloudflare or wrangler setting is refused, in fourteen forms, own storage, fake keys never reach the app, `--no-tunnel` stops a tunnel, a failed tunnel exits with an error); run it after changing `start.sh` or `stop.sh` |
| `proxy.ts` | The Bun proxy in front of the app: rewrites the address, signs the session cookie, blocks analytics and AI calls, drops visitor IP headers |
| `seed-preview.sql` | Made-up rows for every admin state (ids start `pv-`, or sit in 900000-900999) |
| `seed-session.sh` | Adds the made-up admin and one session to the local database |
| `gen-live-venues.ts` | Copies four places from the public snapshot so "Live" and "Live · edits waiting" show |
| `images/` | Two flat placeholder pictures (a box photo and an event flyer). Committed rather than drawn at start, because drawing them needs a Python image library that not every machine has |

Load order, into the freshly emptied store: `scripts/seed-dev.sql`, the generated `live-venues.sql`,
`seed-preview.sql`, then `seed-session.sh`.
Proposal 900099 is rejected by every self-check; the next start brings it back.
