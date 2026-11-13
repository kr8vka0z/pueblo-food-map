# Admin preview (for agents)

Linked from AGENTS.md, section Hosting and deploys. How it works and what the owner sees:
[scripts/admin-preview/README.md](../../scripts/admin-preview/README.md).

**When to use it:** a change to an admin page that the owner must try before it reaches `dev`. Admin sign-in
only works on the site's own three addresses, so a plain tunnel or `npm run preview` can't show the admin signed
in. This tool can: the app in local workerd, made-up data, the made-up admin `dana@example.org` already signed
in, one public link. Public pages need none of this.

**The command** (from the worktree that holds the change):

    scripts/admin-preview/start.sh                # build, empty and reseed its own storage, start, self-check, links
    scripts/admin-preview/start.sh --no-tunnel    # local only; also stops a tunnel left by an earlier start
    scripts/admin-preview/start.sh --staging      # test-site flavour
    scripts/admin-preview/start.sh --foreground   # no systemd or sudo (a Mac)
    scripts/admin-preview/stop.sh
    scripts/admin-preview/selfcheck.sh --lifecycle  # after changing start.sh/stop.sh: the start/stop proofs

`start.sh` must exit 0 after `SELF-CHECK OK` and, with a tunnel, print a `Public:` line. A failure once it has
started (build, seed, secrets check, self-check, tunnel not answering) exits non-zero, prints no public link and
stops the tunnel; a refusal before that (bad flag, missing tool, an env-file refusal) changes nothing. Fix it before
sending anything.

**Hard rules:**

- Never loosen the app's sign-in host list, the `requireAdminOrigin()` check, the allowlist or the cookie
  settings to make a preview work. The tool works from outside the app; change the tool instead.
- Sign-in is seed data (a session row in the LOCAL database). Never request, read or work out an emailed sign-in
  code, for this or any other preview.
- Local only: never `wrangler deploy`, never `--remote`, never read 1Password or any `CLOUDFLARE_*` token for it.
- The public link is a signed-in sandbox on made-up data. Send it to the owner in chat only, never into a pull
  request, an issue or a commit.
- Its own storage and secrets, by construction: the Worker and every wrangler call use
  `.wrangler/admin-preview/state` (recreated empty each start, never the ordinary `.wrangler/state`), and the
  Worker loads only the tool's fresh three-key secrets file, copied over whatever the build left beside it. Never
  add a key to that list, point the preview at the ordinary store, or skip the check before the Worker starts.
- It never changes your `.dev.vars` / `.env` files, and their values never reach the preview's Worker. It
  refuses to start if any repo-root `.env*` or `.dev.vars*` file other than `.env.example` contains the text
  `CLOUDFLARE_` or `WRANGLER_` anywhere (any letter case, comments included). That is a plain text search on
  purpose, not a dotenv parser: vite, vinext and wrangler each accept forms another doesn't (`KEY: value`, a
  byte-order mark, `export`, CRLF), and matching one grammar kept missing another. Never narrow it back to a
  key match. If it refuses, ask before moving that file.
- Never commit what it writes: `.wrangler/admin-preview/` and `dist/` are gitignored.
- Stop it (`stop.sh`) when the owner is done; the link stays open while the tunnel runs.

**After the change merges into `dev`:** the preview ran on made-up data, local storage and a rewritten address,
so re-check on https://dev.pueblofoodmap.com/admin what it could not show: a real sign-in (emailed code and
passkey), map tiles, a save on real staging data, and that nothing the preview hid (analytics, Suggest Spanish,
emails) broke. Publish stays refused on staging by design.
