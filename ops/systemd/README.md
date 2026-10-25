# ops/systemd — the weekly venue website reader

Runs `scripts/refresh-ingest.ts --db-mode remote --only website` (Venue Data
Rebuild step 3, `scripts/refresh/website.ts`) on the home server every Monday
at 02:00 Mountain time, after the GitHub weekly refresh. It writes review
proposals to the **production** database, so it only ever runs code from
`origin/main`: `run.sh` resets a dedicated checkout to `origin/main` and runs
`npm ci` before each run.

Why not GitHub Actions: Gemini is reached through the Antigravity CLI (`agy`)
under Kyle's Google login on this server, which GitHub's hosted runners can't
use, and this repo is public.

## Install (once the code is on `main`)

Needs: migration `0025` applied to production (AGENTS.md promotion checklist),
`agy` logged in for the `atlas` user, `/usr/bin/agent-browser`.

```bash
cd <a checkout of main>
sudo install -D -m 0755 ops/systemd/pfm-website-reader.sh /usr/local/lib/pfm-website-reader/run.sh
sudo install -m 0644 ops/systemd/pfm-website-reader.service ops/systemd/pfm-website-reader.timer /etc/systemd/system/
sudo install -m 0644 ops/systemd/pfm-website-reader.list /etc/claude-bot-secrets/pfm-website-reader.list  # names + refs only, like the others
sudo systemctl daemon-reload
sudo systemctl enable --now pfm-website-reader.timer
systemctl list-timers pfm-website-reader.timer   # next run: Monday 02:00 MT
```

First run by hand (optional, writes to production):
`sudo systemctl start pfm-website-reader.service`.

## How the token is kept from Gemini

agy and the browser read untrusted web pages and run as `atlas`, so they must
not be able to reach the D1 write token. The unit installs packages first,
then root writes `/run/pfm-website-reader/secrets.env`, then the reader reads
it and deletes it before anything else and hands the values only to wrangler.
Nothing sources the file, so the token is in no process environment (a
same-user process can read another's `/proc/<pid>/environ`), and agy and the
browser are started with every `CLOUDFLARE_*`/`OP_*` variable removed.

A run by hand with the token exported in your shell (e.g. the staging run)
puts it in node's starting environment. To keep that path closed too, write
the two values to a 0600 file in the same `NAME='value'` form and pass
`PFM_SECRETS_FILE=<file>` instead of exporting them; the reader deletes it.

Model: `PFM_GEMINI_MODEL` (default `gemini-3.8-flash-medium`, since Argon's
quota is small and shared). Set it with `systemctl edit pfm-website-reader`
(`Environment=PFM_GEMINI_MODEL=...`).

## Watching it

- `journalctl -u pfm-website-reader.service -n 200` — each run ends with one
  `SUMMARY website-reader:` line (venues read, failed, sites discovered, fields
  confirmed vs dropped, Gemini calls, proposals written, ok/ABORTED).
- A failed run exits non-zero, so `OnFailure=telegram-alert@` messages Kyle.
  A failure writes nothing from the reader (a Gemini quota error, every page
  failing, or a missing migration all abort the source).
- The admin staleness alert (`src/lib/refreshAlerts.ts`) also emails if the
  `website` source writes nothing for 40 days.

## Remove

```bash
sudo systemctl disable --now pfm-website-reader.timer
sudo rm /etc/systemd/system/pfm-website-reader.{service,timer} /etc/claude-bot-secrets/pfm-website-reader.list
sudo rm -r /usr/local/lib/pfm-website-reader
sudo systemctl daemon-reload
rm -rf ~/.local/share/pfm-website-reader
```

Server config outside `/home/atlas` is mirrored to the `infra` repo nightly; this
directory is the source copy for these files.
