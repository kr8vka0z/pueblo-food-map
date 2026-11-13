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

It builds the app, resets the made-up data, starts everything and runs the self-check (about 30 seconds). Run it
again after any code change.

| Flag | What it does |
|---|---|
| `--no-tunnel` | No public link; the preview is only on this machine |
| `--staging` | The test-site flavour: the admin shows "Test site: publishing is turned off here" |
| `--foreground` | For a Mac, or Linux without passwordless `sudo`: runs the parts as plain background processes instead of systemd units |

By default the three parts (the app, the sign-in proxy, the tunnel) run as systemd units named
`pfm-admin-preview-worker`, `-proxy` and `-tunnel`, started with `sudo systemd-run` as your own user, so they keep
running after the terminal or agent session that started them closes. They stop at a reboot.

## Addresses it prints

- **Local:** `http://127.0.0.1:8792/__preview/signin`. Opening it signs you in and takes you to the Dashboard.
- **Public** (unless `--no-tunnel`): a random `https://<words>.trycloudflare.com` address with
  `/__preview/signin` on the end. It stays the same while the tunnel runs (a second `start.sh` keeps it) and
  changes after `stop.sh`. Send it to the site's owner in chat only, never in a pull request or an issue.
- **See the sign-in page:** add `/__preview/signout` to either address. It signs this browser out and shows the
  sign-in page. Any admin page opened after that signs you back in.

## Stop

    scripts/admin-preview/stop.sh

Stops the tunnel, the proxy and the app, whichever way they were started. Logs and the generated files stay in
`.wrangler/admin-preview/` (gitignored) until the next start.

## What works and what doesn't

- Every admin page opens, signed in as the made-up admin `dana@example.org`, who is also the "owner", so the
  Activity tab shows.
- **Data resets on every start.** Changes you make (approve, reject, edit) last until then.
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
- Everything is local: the app's database and file storage live under `.wrangler/state`. Nothing runs
  `wrangler deploy` or touches a remote database, and every tool starts with an empty environment, so no
  Cloudflare token can reach it.
- `start.sh` writes the gitignored `.dev.vars` (a random local `BETTER_AUTH_SECRET` and the made-up admin as the
  only allowed email). If a `.dev.vars` already exists that it did not write, it stops and changes nothing.
  While that file exists, `npm run dev` and `npm run preview` use the made-up admin too; delete it to undo.

## Files

| File | What it is |
|---|---|
| `start.sh` | Builds, seeds and starts everything, then runs the self-check |
| `stop.sh` | Stops everything (systemd units and `--foreground` processes, by saved PID) |
| `selfcheck.sh` | The one check: sign-in lands on /admin, ten admin pages, three images, one admin save, a foreign Origin refused, Suggest Spanish blocked, sign-out, and the app with no cookie shows no admin content |
| `proxy.ts` | The Bun proxy in front of the app: rewrites the address, signs the session cookie, blocks analytics and AI calls, drops visitor IP headers |
| `seed-preview.sql` | Made-up rows for every admin state (ids start `pv-`, or sit in 900000-900999) |
| `seed-session.sh` | Adds the made-up admin and one session to the local database |
| `gen-live-venues.ts` | Copies four places from the public snapshot so "Live" and "Live · edits waiting" show |
| `images/` | Two flat placeholder pictures (a box photo and an event flyer). Committed rather than drawn at start, because drawing them needs a Python image library that not every machine has |

Load order: `scripts/seed-dev.sql`, the generated `live-venues.sql`, `seed-preview.sql`, then `seed-session.sh`.
Proposal 900099 is rejected by every self-check; the next start brings it back.
