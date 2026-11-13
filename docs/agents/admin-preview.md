# Admin preview (for agents)

Linked from AGENTS.md, section Hosting and deploys. How it works and what the owner sees:
[scripts/admin-preview/README.md](../../scripts/admin-preview/README.md).

**When to use it:** a change to an admin page that the owner must try before it reaches `dev`. Admin sign-in
only works on the site's own three addresses, so a plain tunnel or `npm run preview` can't show the admin signed
in. This tool can: the app in local workerd, made-up data, the made-up admin `dana@example.org` already signed
in, one public link. Public pages need none of this.

**The command** (from the worktree that holds the change):

    scripts/admin-preview/start.sh                # build, reset data, start, self-check, print the links
    scripts/admin-preview/start.sh --no-tunnel    # local only
    scripts/admin-preview/start.sh --staging      # test-site flavour
    scripts/admin-preview/start.sh --foreground   # no systemd or sudo (a Mac)
    scripts/admin-preview/stop.sh

`start.sh` must end with `SELF-CHECK OK`. If it doesn't, the link is not ready: fix it before sending anything.

**Hard rules:**

- Never loosen the app's sign-in host list, the `requireAdminOrigin()` check, the allowlist or the cookie
  settings to make a preview work. The tool works from outside the app; change the tool instead.
- Sign-in is seed data (a session row in the LOCAL database). Never request, read or work out an emailed sign-in
  code, for this or any other preview.
- Local only: never `wrangler deploy`, never `--remote`, never read 1Password or any `CLOUDFLARE_*` token for it.
- The public link is a signed-in sandbox on made-up data. Send it to the owner in chat only, never into a pull
  request, an issue or a commit.
- Never commit what it writes: `.dev.vars` and `.wrangler/admin-preview/` are gitignored. If `start.sh` refuses
  because a `.dev.vars` exists that it did not write, ask before moving that file.
- Stop it (`stop.sh`) when the owner is done; the link stays open while the tunnel runs.

**After the change merges into `dev`:** the preview ran on made-up data, local storage and a rewritten address,
so re-check on https://dev.pueblofoodmap.com/admin what it could not show: a real sign-in (emailed code and
passkey), map tiles, a save on real staging data, and that nothing the preview hid (analytics, Suggest Spanish,
emails) broke. Publish stays refused on staging by design.
