// Design system: Components, admin. The staff-only admin pieces (signed in with Better Auth), in the same entry
// layout Kyle approved on the main Components page (pages/03-components.ts): status tag; what it's for and when to
// use something else; versions as working pieces; states as stills that also react to a real pointer and Tab;
// shared colors (with contrast ratios) and sizes; wording; works for everyone; one live Do and one live Don't; the
// code file. Replicas copy the real classes, words and sizes from the admin as built in #926 (src/lib/adminCardStyles.ts,
// src/components/formClasses.ts, AdminConfirm, AdminRowMenu, AdminSegmented; CSS in mock.css, block "admin", classes
// prefixed pa-). Every person, email, place and number here is made up.
import { contrast, dodont, entry, hex, ratio, sw, toc, type Page, type Token } from "../lib";


type T = Token | "white";
const H = (t: T) => (t === "white" ? "#FFFFFF" : hex(t));
const r = (fg: T, bg: T, need: 4.5 | 3 = 4.5) => ratio(H(fg), H(bg), need);
const NAMES: Partial<Record<T, string>> = { white: "white", "color-bone-50": "bone 50", "color-bone-100": "bone 100", "color-bone-200": "bone 200", "color-clay-100": "clay 100", "color-sage-100": "sage 100", "color-sage-50": "sage 50", "color-sage-600": "sage 600", "color-danger": "danger red", "color-brand-yellow": "yellow" };
/** Swatch with its contrast ratio against the background it really sits on. need 4.5 for words, 3 for edges. */
const swr = (name: string, t: Token, use: string, bg: T = "white", need: 4.5 | 3 = 4.5) =>
  sw(name, t, `${use}. ${r(t, bg, need)} on ${NAMES[bg] ?? bg}${need === 3 ? " (edge)" : ""}.`);
const q = (s: string) => s.replaceAll('"', "&quot;");
/** Demos. pa-cq makes the piece a size container, so its phone and computer layouts follow the box it sits in. */
const wide = (label: string, html: string) => `<figure class="dsd pa-wide"><div><div class="pa pa-cq">${html}</div></div><figcaption>${label}</figcaption></figure>`;
const mid = (label: string, html: string) => `<figure class="dsd pa-mid"><div><div class="pa pa-cq">${html}</div></div><figcaption>${label}</figcaption></figure>`;
const demo = (label: string, html: string) => `<figure class="dsd"><div><div class="pa">${html}</div></div><figcaption>${label}</figcaption></figure>`;
const say = (m: string) => ` data-say="${q(m)}"`;
let uid = 0; // unique ids for label/box pairs

// Made-up people, places and addresses. 555-01xx numbers are reserved for fiction; example.com and example.org
// are reserved for examples.
const ADMIN = "dana@example.org";

// ── Shared pieces drawn once and reused, as the code shares them ──────────────────────────────────────────────
/** AdminConfirm: the question, what happens, then Cancel first and the action. tone "danger" red, "primary" green. */
const confirmBox = (o: { title: string; body: string; action: string; tone: "danger" | "primary"; busy?: string; err?: string; live?: boolean }) => {
  const id = `pa-cf-${++uid}`;
  const act = o.tone === "danger" ? "pa-bd" : "pa-bp";
  return `<div class="pa-confirm${o.tone === "primary" ? " ok" : ""}" role="group" aria-labelledby="${id}"><p class="t" id="${id}">${o.title}</p>
  <p>${o.body}</p>
  <div class="two"><button type="button" class="pa-bs pa-ring"${o.busy ? " disabled" : ""}${o.live ? ` onclick="${q("const w=this.closest('.pa-cw');w.querySelector('.pa-confirm').hidden=true;const b=w.querySelector('.open');b.hidden=false;b.focus()")}"` : ""}>Cancel</button><button type="button" class="${act} pa-ring"${o.busy ? " disabled" : ""}${o.live ? say("Mockup: nothing is sent.") : ""}>${o.busy ?? o.action}</button></div>
  ${o.err ? `<p class="er" role="alert">${o.err}</p>` : ""}</div>`;
};
/** A trigger button that opens its confirm in place (hidden, still on the page), as useAdminConfirm does. */
const liveOpen = (btn: string) => btn.replace("<button ", `<button onclick="${q("this.hidden=true;const c=this.closest('.pa-cw').querySelector('.pa-confirm');c.hidden=false;c.querySelector('button').focus()")}" `).replace('class="', 'class="open ');
const liveBox = (box: string, gap = 0) => box.replace('<div class="pa-confirm', `<div hidden${gap ? ` style="margin-top:${gap}px"` : ""} class="pa-confirm`);
const confirmLive = (btn: string, box: string) => `<div class="pa-cw">${liveOpen(btn)}${liveBox(box)}</div>`;
/** AdminSegmented: real radios in a fieldset with a hidden legend. */
const seg = (legend: string, opts: string[], on: number, cls: string[] = []) => {
  const name = `pa-seg-${++uid}`;
  return `<fieldset class="pa-seg"><legend>${legend}</legend>${opts.map((o, i) => `<label${cls[i] ? ` class="${cls[i]}"` : ""}><input type="radio" name="${name}"${i === on ? " checked" : ""}>${o}</label>`).join("")}</fieldset>`;
};
const empty = (lines: string[], btn = "") => `<div class="pa-empty">${lines.map((l) => `<p>${l}</p>`).join("")}${btn}</div>`;

// ── Admin menu (AdminNav) ─────────────────────────────────────────────────────────────────────────────────────
type Tab = "Dashboard" | "Blessing Boxes" | "Places" | "Events" | "Activity";
const TABS: [Tab, number][] = [["Dashboard", 0], ["Blessing Boxes", 3], ["Places", 12], ["Events", 0]];
const navLink = (label: Tab, count: number, active: boolean, cls = "", live = false) =>
  `<a class="pa-nl pa-ring${cls ? ` ${cls}` : ""}" href="#admin-nav"${active ? ' aria-current="page"' : ""}${live ? say(`Mockup: this would open ${label}.`) : ""}>${label}${count > 0 ? `<span class="pa-pill">${count}</span>` : ""}</a>`;
const adminNav = (o: { active?: Tab; owner?: boolean; live?: boolean; skeleton?: boolean } = {}) => {
  const tabs: [Tab, number][] = o.owner ? [...TABS, ["Activity", 0]] : TABS;
  return `<header class="pa-head"><div class="pa-top"><h1 class="wm">Pueblo Food Map Admin</h1>
    <p class="pwho"${o.skeleton ? ' aria-hidden="true"' : ""}>${o.skeleton ? "&nbsp;" : `Signed in as <span>${ADMIN}</span>`}</p></div>
    <nav aria-label="Admin">${tabs.map(([l, c]) => navLink(l, o.skeleton ? 0 : c, !o.skeleton && l === (o.active ?? "Dashboard"), "", o.live)).join("")}<span class="sp" aria-hidden="true"></span>
    <a class="pa-add" href="#admin-nav"${o.live ? say("Mockup: this would open the Add a place form.") : ""}>Add place</a></nav></header>`;
};
const navCell = (label: Tab, count: number, active: boolean, cls = "") => `<div style="display:flex;background:#fff;padding:6px;border-radius:10px">${navLink(label, count, active, cls)}</div>`;

const adminNavEntry = entry({
  id: "admin-nav", name: "Admin menu (AdminNav)", status: "built",
  statusNote: "Live as is (#926). A menu item takes the light green tint (sage 100) under the pointer; Add place has no pointer change, only the press dim, and the green keyboard ring.",
  purpose: "The top of every admin page except sign-in: the title, who is signed in, and one row of tabs (Dashboard, Blessing Boxes, Places, Events) with a small count of things waiting on each. Add place sits at the end of the row. The owner's account also sees Activity. The title is the page's one main heading.",
  instead: [
    "It's a step inside one page (a filter, a sort, a time period): it goes on that page, not in the menu.",
    "It's a queue that belongs to a tab (photos, sponsor requests, data changes): it shows as that tab's count and its To review filter, not as a new tab. That is how Photo review, Sponsor requests and Data refresh were folded in.",
    "It's a second main action: there is only one orange button in the admin, Add place. Anything else uses the green button inside its page.",
  ],
  versions:
    wide("At this width the title and signed-in line share a row; on a phone (try the Phone view) they stack and the tabs wrap onto two lines. Tap any tab or Add place. Point at a tab to see the green tint.", adminNav({ live: true, active: "Places" })) +
    wide("The owner's account: Activity appears at the end. Every other account never gets it in its page at all.", adminNav({ owner: true, active: "Dashboard" })) +
    wide("While the next page loads: the same title and tabs, no email, no counts, nothing lit, so nothing jumps when the real menu arrives. These tabs don't change under the pointer.", adminNav({ skeleton: true })),
  states:
    demo("Resting", navCell("Places", 12, false)) +
    demo("Pointer over it: light green tint (sage 100)", navCell("Places", 12, false, "is-hover")) +
    demo("Reached by keyboard: a green ring with a white gap", navCell("Places", 12, false, "is-focus")) +
    demo("The page you're on: green fill, light words", navCell("Places", 12, true)) +
    demo("Add place: resting, then reached by keyboard (the green ring). Under the pointer it doesn't change.", `<div style="display:flex;gap:12px;flex-wrap:wrap;background:#fff;padding:8px;border-radius:10px"><a class="pa-add" href="#admin-nav">Add place</a><a class="pa-add is-focus" href="#admin-nav">Add place</a></div>`),
  colors:
    sw("White", "white", "The menu's background, with a bone 200 line under it") +
    swr("Ink 900", "color-ink-900", "The title, in Fraunces") +
    swr("Ink 500", "color-ink-500", "Tab words at rest, and the Signed in as line") +
    swr("Sage 700", "color-sage-700", "The signed-in email") +
    sw("Sage 600", "color-sage-600", `The page you're on. Bone 50 words on it ${r("color-bone-50", "color-sage-600")}`) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer. Ink 500 words on it ${r("color-ink-500", "color-sage-100")}`) +
    sw("Clay 100", "color-clay-100", `The count pill. Clay 700 numbers on it ${r("color-clay-700", "color-clay-100")}`) +
    sw("Orange", "color-brand-orange", `Add place, the admin's one orange button (owner-approved, DESIGN.md). Navy words on it ${r("color-brand-navy", "color-brand-orange")}`) +
    swr("Sage 500", "color-sage-500", "Keyboard ring on the tabs and on Add place", "white", 3),
  sizes: "Title 24 pixels in Fraunces. Every tab and Add place is 48 pixels tall; tabs are 12 pixels in from each side, 4 pixels apart, corners 10 pixels. Words 14 pixels, medium weight (Add place bold). The count pill is 16 pixels tall and at least 18 wide. 16 pixels of padding on a phone, 32 from 640 pixels wide, where the title and the signed-in line share one row.",
  wording: [
    "Tabs are one or two words, the same on every page: Dashboard, Blessing Boxes, Places, Events, Activity. The admin is English only.",
    "A count shows only when something is waiting; no pill means nothing to do. Blessing Boxes counts photos plus sponsor requests; Places counts data changes plus public suggestions.",
    "Signed in as, then the full email. The main action says what it makes: Add place.",
  ],
  everyone: [
    "Keyboard: every tab is a real link; Tab moves along the row, Enter opens it. Each shows the green ring, Add place too.",
    "Screen reader: the row is a navigation landmark called Admin; the page you're on is announced as the current page, not only by its fill. The title is the page's one main heading.",
    "Touch: every tab and Add place is 48 pixels tall. The row wraps rather than scrolling sideways on a 360-pixel phone.",
    "Color is never the only sign: the current page also says so to screen readers, and a count is a number, not a dot.",
  ],
  dd: dodont(
    [`<div class="pa pa-cq" style="width:100%">${adminNav({ active: "Places" })}</div>`, "One orange button, at the end of the row. The tabs carry counts, not more buttons."],
    [`<div class="pa pa-cq" style="width:100%"><header class="pa-head"><nav aria-label="Don't example" style="padding-top:12px">${navLink("Places", 12, true)}<a class="pa-add" href="#admin-nav">Publish</a><a class="pa-add" href="#admin-nav">Add place</a><a class="pa-add" href="#admin-nav">Add event</a></nav></header></div>`, "Several orange buttons in the menu. Orange is the one main action, so three of them means none stands out."],
  ),
  code: [
    "src/components/AdminNav.tsx (AdminNav and AdminNavSkeleton; addPlaceClass has no hover change and the shared focusRingClass)",
    "src/lib/adminCardStyles.ts (adminNameClass, focusRingClass)",
    "src/lib/adminNavCounts.ts (the counts)",
    "src/app/(site)/admin/loading.tsx (shows the skeleton)",
  ],
});

// ── Sign-in (AdminLoginForm) ──────────────────────────────────────────────────────────────────────────────────
const loginPage = (inner: string) => `<div class="pa-login"><div class="lcol"><h1 class="wm">Pueblo Food Map Admin</h1>${inner}</div></div>`;
type LoginOpt = { err?: boolean; sending?: boolean; failed?: boolean; passkeyBusy?: boolean; passkeyFail?: boolean; live?: boolean; value?: string };
const emailStep = (o: LoginOpt = {}) => `<div class="pa-lcard"><form onsubmit="return false" novalidate>
  <label class="pa-label" for="pa-email-${++uid}">Email</label>
  <input id="pa-email-${uid}" class="pa-in${o.err ? " bad" : ""}" type="email" placeholder="you@example.com" value="${o.value ?? ""}" style="margin-bottom:4px"${o.err ? ' aria-invalid="true"' : ""}>
  ${o.err ? `<p class="pa-err" role="alert">Enter a valid email address.</p>` : ""}
  <button type="${o.live ? "button" : "submit"}" class="pa-bfull pa-ring" style="margin-top:16px"${o.sending ? " disabled" : ""}${o.live ? say("Mockup: this would email a 6-digit code. The next step is shown beside this one.") : ""}>${o.sending ? "Sending…" : "Email me a code"}</button>
  ${o.failed ? `<p class="pa-err" role="alert" style="font-size:14px;line-height:20px">The code was not sent. Try again.</p>` : ""}
  <div class="pa-or"><span></span>or<span></span></div>
  <button type="button" class="pa-bline pa-ring"${o.passkeyBusy ? " disabled" : ""}${o.live ? say("Mockup: your device would ask for your fingerprint, face or PIN.") : ""}>${o.passkeyBusy ? "Waiting for passkey…" : "Use a passkey"}</button>
  ${o.passkeyFail ? `<p class="pa-err" role="alert">Passkey sign-in didn&apos;t work. Use an email code instead.</p>` : ""}
</form></div>`;
type CodeOpt = { err?: string; verifying?: boolean; resendIn?: number; value?: string; live?: boolean };
const codeStep = (o: CodeOpt = {}) => `<div class="pa-lcard"><p role="status">We sent a 6-digit code to <span style="font-weight:500">${ADMIN}</span>. It expires in 10 minutes.</p>
  <form onsubmit="return false" novalidate style="margin-top:16px"><label class="pa-label" for="pa-code-${++uid}">Sign-in code</label>
  <input id="pa-code-${uid}" class="pa-in code${o.err ? " bad" : ""}" type="text" inputmode="numeric" maxlength="6" placeholder="123456" value="${o.value ?? ""}"${o.err ? ' aria-invalid="true"' : ""}>
  ${o.err ? `<p class="pa-err" role="alert">${o.err}</p>` : ""}
  <button type="button" class="pa-bfull pa-ring" style="margin-top:16px"${o.verifying ? " disabled" : ""}${o.live ? say("Mockup: this would sign you in. Typing the sixth digit does it too.") : ""}>${o.verifying ? "Signing in…" : "Sign in"}</button></form>
  <div class="pa-links"><button type="button" class="pa-tl"${o.resendIn ? " disabled" : ""}${o.live && !o.resendIn ? say("Mockup: this would send a new code.") : ""}>${o.resendIn ? `Resend code (${o.resendIn}s)` : "Resend code"}</button>
  <button type="button" class="pa-tl"${o.live ? say("Mockup: this would go back to the email step.") : ""}>Use a different email</button></div></div>`;
const passkeyPrompt = (busy = false) => `<div class="pa-lcard"><p style="color:var(--color-ink-500)">Signed in as</p>
  <p style="margin-bottom:16px;font-size:18px;line-height:28px;font-weight:500;color:var(--color-sage-700)">${ADMIN}</p>
  <p style="margin-bottom:16px">Set up a passkey for faster sign-in next time? Your device will ask for a fingerprint, face, or PIN.</p>
  <button type="button" class="pa-bfull pa-ring"${busy ? " disabled" : ""}>${busy ? "Setting up…" : "Set up a passkey"}</button>
  <a class="pa-tl" href="#admin-login" style="display:flex;justify-content:center;margin-top:16px;text-align:center">Continue to admin without a passkey</a></div>`;

const loginEntry = entry({
  id: "admin-login", name: "Sign-in (AdminLoginForm)", status: "built",
  statusNote: "Live as is (#926). Use a passkey is the plain outline button with the light green tint under the pointer; the boxes have the darker ink 400 edge and are 48 tall; the small links have a 48-pixel tap area and the green ring.",
  purpose: "The only way into the admin: type your email, get a 6-digit code, type it in. A passkey (fingerprint, face or PIN) is the faster second way once it's set up. It never says whether an email belongs to an admin: everyone sees the same next step.",
  instead: [
    "It's a public form (Suggest a place, Report a problem): use the public form fields, which add the Turnstile check.",
    "It's the signed-in admin: use the Admin menu; sign-in has no menu because nobody is signed in yet.",
  ],
  versions:
    mid("Step 1, the email. Tap Email me a code or Use a passkey.", loginPage(emailStep({ live: true }))) +
    mid("Step 2, the code from the email. Typing the sixth digit signs you in by itself.", loginPage(codeStep({ live: true, resendIn: 24, value: "40" }))) +
    mid("Signed in with no passkey yet: the one-time offer to set one up.", loginPage(passkeyPrompt())),
  states:
    demo("Email box: resting, with its ink 400 edge", `<div style="width:100%"><input class="pa-in" type="email" placeholder="you@example.com" aria-label="Email, resting"></div>`) +
    demo("Email box: reached by keyboard, a green edge and ring", `<div style="width:100%"><input class="pa-in is-focus" type="email" value="${ADMIN}" aria-label="Email, keyboard"></div>`) +
    demo("Email box: not an email. The edge turns red and the line under it says what to fix.", `<div style="width:100%"><input class="pa-in bad" type="email" value="dana.example" aria-label="Email, error" aria-invalid="true"><p class="pa-err">Enter a valid email address.</p></div>`) +
    demo("Email me a code: resting, pointer over it (sage 700), keyboard", `<div style="display:flex;flex-direction:column;gap:12px;width:100%"><button type="button" class="pa-bfull pa-ring">Email me a code</button><button type="button" class="pa-bfull pa-ring is-hover">Email me a code</button><button type="button" class="pa-bfull pa-ring is-focus">Email me a code</button></div>`) +
    demo("Working: Sending…, faded and can't be pressed twice", `<div style="width:100%"><button type="button" class="pa-bfull" disabled>Sending…</button></div>`) +
    demo("Use a passkey: resting, pointer over it (sage 100), keyboard", `<div style="display:flex;flex-direction:column;gap:12px;width:100%"><button type="button" class="pa-bline pa-ring">Use a passkey</button><button type="button" class="pa-bline pa-ring is-hover">Use a passkey</button><button type="button" class="pa-bline pa-ring is-focus">Use a passkey</button></div>`) +
    demo("Wrong code: red edge and the reason", `<div style="width:100%"><input class="pa-in code bad" value="401872" aria-label="Code, error" aria-invalid="true"><p class="pa-err">That code didn't match. Try again.</p></div>`) +
    demo("Resend code: waiting out its 30 seconds (faded, no underline), ready, then reached by keyboard", `<div style="display:flex;flex-direction:column;align-items:flex-start;width:100%"><button type="button" class="pa-tl" disabled>Resend code (24s)</button><button type="button" class="pa-tl">Resend code</button><button type="button" class="pa-tl is-focus">Resend code</button></div>`),
  colors:
    sw("Bone 50", "color-bone-50", "The page behind the sign-in card") +
    sw("White", "white", "The card and the boxes") +
    swr("Ink 900", "color-ink-900", "The title and what you type") +
    swr("Ink 700", "color-ink-700", "Labels, the We sent a code line, and Use a passkey") +
    swr("Ink 400", "color-ink-400", "The example in an empty box, and the word or") +
    sw("Ink 400 edge", "color-ink-400", `The edge of each box. ${r("color-ink-400", "white", 3)} on white (edge): a box's edge is the only thing that shows where it is`) +
    swr("Sage 500", "color-sage-500", "The box edge and ring while you type in it, and every keyboard ring", "white", 3) +
    sw("Sage 600", "color-sage-600", `Email me a code and Sign in. Bone 50 words on it ${r("color-bone-50", "color-sage-600")}; with the pointer over it sage 700, ${r("color-bone-50", "color-sage-700")}`) +
    sw("Bone 300", "color-bone-300", `Use a passkey's edge, ${contrast(H("color-bone-300"), H("white")).toFixed(1)} to 1: decoration, the words carry the button`) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer on Use a passkey. Ink 700 words on it ${r("color-ink-700", "color-sage-100")}`) +
    swr("Sage 700", "color-sage-700", "Resend code, Use a different email, the email on the passkey offer") +
    swr("Danger red", "color-danger", "What went wrong, and a box's edge when it's wrong"),
  sizes: "The card is at most 384 pixels wide, lifted (the level 2 shadow), 32 pixels of padding (48 from 640 wide), corners 14, 32 pixels under the title. Boxes: 16-pixel words on a phone so the phone doesn't zoom in (14 from 768 wide), 8 by 12 pixels of padding, corners 10, 48 pixels tall. Email me a code, Sign in and Use a passkey are full width and 48 pixels tall with 16-pixel words; Resend code, Use a different email and Continue to admin without a passkey tap at 48 too. Field error lines are 12 pixels, 4 below their box.",
  wording: [
    "Each step says what happens next in plain words: Email me a code, then We sent a 6-digit code to dana@example.org. It expires in 10 minutes.",
    "Errors say what did not happen or what to do: Enter a valid email address. The code was not sent. Try again. That code didn't match. Try again. That code didn't work. Try again. That code expired. Send a new one. Too many tries. Wait a few minutes and try again.",
    "A button that's working says so: Sending…, Signing in…, Waiting for passkey…, Setting up….",
    "Never say whether an email is an admin's. The next step looks the same for every address.",
  ],
  everyone: [
    "Keyboard: the cursor starts in the code box on step 2. Enter sends either step. Every button and link shows the green ring. A missing or wrong email puts the cursor in the email box; a short, wrong or failed code puts it in the code box. While Resend code counts down a press does nothing, but the keyboard stays on it.",
    "Screen reader: each box has a real label; a wrong value is marked invalid and its reason is read out right away. The We sent a code line is announced when it appears.",
    "Touch: every button and link is 48 pixels tall. The code box opens the number pad and offers the code from a text message or email. The email box offers saved passkeys.",
    "Color is never the only sign: a red edge always comes with a written reason.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%"><input class="pa-in bad" value="dana.example" aria-label="Do example" aria-invalid="true"><p class="pa-err">Enter a valid email address.</p></div>`, "Say what to fix, under the box."],
    [`<div class="pa" style="width:100%"><input class="pa-in bad" value="dana.example" aria-label="Don't example" aria-invalid="true"><p class="pa-err">Invalid input.</p></div>`, "A vague error. Nobody knows what to change (made-up example)."],
  ),
  code: [
    "src/components/AdminLoginForm.tsx (ADMIN_PRIMARY_BUTTON and ADMIN_SECONDARY_BUTTON, full width; tapLinkClass for the small links)",
    "src/app/(site)/admin/login/page.tsx (the page around it)",
    "src/components/formClasses.ts (labelClass, inputBase, inputBorder, errorClass); src/lib/adminCardStyles.ts (signInCardClass, the lifted card)",
    "src/lib/adminAuthAllowlistPlugin.ts (the same reply for every email)",
  ],
});

// ── Admin cards and boxes (adminCardStyles.ts cardClass, the summary boxes) ───────────────────────────────────
const toReviewConfirm = (o: { busy?: boolean; live?: boolean } = {}) => confirmBox({ title: "Approve all 6 date-only updates?", body: "These only update the last-verified date. Real changes are not included.", action: "Approve 6 updates", tone: "primary", busy: o.busy ? "Approving…" : undefined, live: o.live });
const toReviewBtn = (cls = "") => `<button type="button" class="pa-bp pa-ring${cls ? ` ${cls}` : ""}">Approve all 6 date-only updates</button>`;
const toReview = (o: { open?: boolean; busy?: boolean; done?: boolean; cls?: string; live?: boolean } = {}) => `<div class="pa-card sum pa-cw"><div class="pa-row">
  <p class="pa-strong">14 to review · 11 from the data refresh, 3 from the public</p>
  ${o.live ? liveOpen(toReviewBtn()) : o.open || o.busy ? "" : toReviewBtn(o.cls)}</div>
  ${o.live ? liveBox(toReviewConfirm({ live: true }), 12) : o.open || o.busy ? `<div style="margin-top:12px">${toReviewConfirm({ busy: o.busy })}</div>` : ""}
  ${o.done ? `<p aria-live="polite" style="margin-top:4px;color:var(--color-ink-500)">Approved 6. Skipped 0.</p>` : ""}</div>`;
const boxesToReview = (live = false) => `<div class="pa-card sum"><div class="pa-row"><p class="pa-strong">3 to review: 2 photos (1 reported by a visitor) and 1 sponsor request</p>
  <a class="pa-bp pa-ring" href="#admin-cards"${live ? say("Mockup: this would open Blessing Boxes, filtered to To review.") : ""}>Show them</a></div></div>`;
const waiting = `<div class="pa-wait"><p style="font-weight:600">Waiting to publish</p><p style="margin-top:4px">These changes won&apos;t show on the public map until the next Publish.</p>
  <dl><div><dt>Hours</dt><dd><s>Tue 9am – 1pm</s> → <span style="font-weight:500">Tue 9am – 2pm</span><span class="by">Changed by ${ADMIN}</span></dd></div>
  <div><dt>Phone</dt><dd><s>(719) 555-0142</s> → <span style="font-weight:500">(719) 555-0187</span><span class="by">Changed by the data refresh</span></dd></div></dl></div>`;
const shellCard = `<div class="pa-card"><div class="pa-row atop"><span class="pa-tag t-sage">New place</span><p class="pa-meta">Nov 3, 2026, 4:12 PM</p></div>
  <div style="margin-top:12px"><p class="pa-name">Northside Free Fridge</p><p><span class="pa-fl">Address: </span>200 Sample Rd, Pueblo, CO 81003</p></div>
  <div class="pa-btns" style="margin-top:16px"><a class="pa-bp pa-ring" href="#admin-cards">Review &amp; approve</a><button type="button" class="pa-bs pa-ring">Reject</button></div></div>`;
const errorPage = (live = false) => `<div class="pa-errpage"><h1 class="wm">This page didn&apos;t load</h1><p>Nothing was changed. Try again, or go back to the Dashboard.</p>
  <div class="r"><button type="button" class="pa-bp pa-ring"${live ? say("Mockup: this would reload the page.") : ""}>Try again</button><a class="pa-tl" href="#admin-cards"${live ? say("Mockup: this would open the Dashboard.") : ""}>Go to the Dashboard</a></div></div>`;

const cardsEntry = entry({
  id: "admin-cards", name: "Admin cards and boxes (cardClass and the summary boxes)", status: "built",
  statusNote: "Live as is (#926). Every admin card, summary box, notice, empty box and failure box comes from one set of shared strings, so no page draws its own. The bulk approve now asks in a green box on the page, and an admin page that fails to load shows the admin error page.",
  purpose: "The one white card every admin queue item and summary sits in: a 14-pixel corner, a hairline edge and a faint shadow. A summary box is the same card, slimmer, with one line saying how much is waiting and one button to act on it. The clay box is the one exception: a warning that saved changes aren't on the public map yet. A list with nothing in it shows the shared empty box.",
  instead: [
    "It's one thing someone sent in or a data check found: use a change card (the next-but-one entry), which adds its tags and its decision buttons.",
    "It's a number to watch over time: use a dashboard number card.",
    "It's the whole list of places or boxes: use a table.",
  ],
  versions:
    wide("The plain card (cardClass), here holding a public suggestion. 16 pixels of padding on a phone, 24 from 640 wide.", shellCard) +
    wide("Summary on Places (ToReviewSummaryBox): how much is waiting and where it came from, and one button for the safe bulk step. Tap it: it asks in a green box on the page, Cancel first.", toReview({ live: true })) +
    wide("Summary on Blessing Boxes (BoxesToReviewBox): the count and a Show them button that turns on the To review filter.", boxesToReview(true)) +
    wide("Waiting to publish (WaitingToPublishBox), on a place's edit page: the clay warning, with each change crossed out and its new value.", waiting) +
    wide("A group on a place's or box's edit page (SuggestionsBox, BoxReviewBox): a section title (Fraunces 18) with the count over a stack of cards, 16 pixels apart.", `<div class="pa-grp" style="max-width:672px"><h3 class="wm">Suggestions to review (2)</h3><ul><li>${shellCard}</li><li><div class="pa-card"><div class="pa-row atop"><span class="pa-tag t-clay">Public report</span><p class="pa-meta">Nov 2, 2026, 9:40 AM</p></div><div style="margin-top:12px"><p class="pa-name">Northside Free Fridge</p><p><span class="pa-fl">Issue: </span>Wrong hours</p></div></div></li></ul></div>`) +
    wide("When an admin page fails to load (admin/error.tsx): the whole page, menu included, is this. Try again reloads; the error's own text is never shown.", errorPage(true)),
  states:
    demo("Summary: nothing waiting. The box doesn't show at all.", `<p style="color:var(--color-ink-500);font-size:13px;margin:0">(no box)</p>`) +
    wide("Summary: the bulk step asking, Cancel first", toReview({ open: true })) +
    wide("Summary: approving, both buttons faded", toReview({ busy: true })) +
    wide("Summary: done. The result stays on screen in the box.", toReview({ done: true })) +
    wide("Summary button: pointer over it (sage 700), then keyboard", `${toReview({ cls: "is-hover" })}${toReview({ cls: "is-focus" })}`) +
    wide("A list with nothing in it: the shared empty box, lifted like the cards, with the way out", empty(["No events yet.", "Add a one-day giveaway, a turkey drive or a pop-up distribution."], `<a class="pa-bp big pa-ring" href="#admin-cards">Add event</a>`)),
  colors:
    sw("White", "white", "Every card, the empty box and the confirm box") +
    sw("Bone 200", "color-bone-200", `The card's hairline edge. ${contrast(H("color-bone-200"), H("white")).toFixed(1)} to 1, decoration only: the shadow and the words carry the card`) +
    swr("Ink 700", "color-ink-700", "The summary line and card words") +
    swr("Ink 500", "color-ink-500", "The empty box's words") +
    swr("Ink 400", "color-ink-400", "Small capital labels (ADDRESS) and the time sent") +
    sw("Clay 100", "color-clay-100", `Waiting to publish. Clay 700 words on it ${r("color-clay-700", "color-clay-100")}; the Changed by line in ink 500 ${r("color-ink-500", "color-clay-100")}`) +
    sw("Clay 500", "color-clay-500", `Waiting to publish's edge. ${r("color-clay-500", "color-clay-100", 3)} on clay 100 (edge)`) +
    sw("Sage 600", "color-sage-600", `The one button. Bone 50 words ${r("color-bone-50", "color-sage-600")}; sage 700 under the pointer ${r("color-bone-50", "color-sage-700")}`) +
    swr("Sage 500", "color-sage-500", "The green confirm box's edge", "white", 3),
  sizes: "Corners 14 pixels. Plain card: 16 pixels of padding, 24 from 640 wide. Summary: 12 by 16. Parts of a page sit 24 pixels apart. Shadow: a 1-pixel ink line at 5% plus a 2-pixel blur at 4%. Words 14 pixels; the summary line semi-bold; labels 11-pixel capitals; a group's title Fraunces 18. Every button is 48 pixels tall. The empty box: the card shadow, 48 pixels above and below its words. The error page's title is Fraunces 20.",
  wording: [
    "A summary says the total, then where it came from: 14 to review · 11 from the data refresh, 3 from the public.",
    "Its button says how many it acts on: Approve all 6 date-only updates. It asks first: Approve all 6 date-only updates? These only update the last-verified date. Real changes are not included. Show them opens the list.",
    "Waiting to publish names each field, crosses out what's on the map now and says who changed it. The category reads as its own name (Meal Site) and hours as days and times, never the stored code; a row whose two sides read the same is left out. Everywhere else a field is named (change cards, the Places To review column, Activity) it reads as plain words through src/lib/fieldLabels.ts: Accepts SNAP, Website, Hours.",
    "The error page: This page didn't load. Nothing was changed. Try again, or go back to the Dashboard.",
  ],
  everyone: [
    "Keyboard and screen reader: a card is not itself a button; the links and buttons inside it are. The bulk result is announced when it appears. The confirm box opens with the keyboard on Cancel.",
    "Touch: the summary wraps its button under the line on a phone, never squeezing the words.",
    "Color is never the only sign: Waiting to publish has a heading, and crossed-out text is followed by an arrow and the new value.",
  ],
  dd: dodont(
    [`<div class="pa pa-cq" style="width:100%">${boxesToReview()}</div>`, "One line and one button: how many, and where to go."],
    [`<div class="pa pa-cq" style="width:100%"><div class="pa-card sum"><div class="pa-row"><p class="pa-strong">Things to review</p><span class="pa-btns"><a class="pa-bp" href="#admin-cards">Photos</a><a class="pa-bp" href="#admin-cards">Sponsors</a><a class="pa-bp" href="#admin-cards">Reports</a></span></div></div></div>`, "No count and three green buttons. Nobody knows how much is waiting or which to press (made-up example)."],
  ),
  code: [
    "src/lib/adminCardStyles.ts (cardClass, cardSlimClass, clayNoticeClass, emptyStateClass, failureBoxClass, pageBodyClass, the three buttons)",
    "src/components/ToReviewSummaryBox.tsx (asks with AdminConfirm, green), BoxesToReviewBox.tsx, WaitingToPublishBox.tsx, SourceSwitchPanel.tsx",
    "src/components/SuggestionsBox.tsx, BoxReviewBox.tsx (the groups)",
    "src/app/(site)/admin/error.tsx (the error page)",
  ],
});

// ── Publish bar (PublishPanel, PublishBotStatusBanner) ────────────────────────────────────────────────────────
type PubOpt = { review?: boolean; upToDate?: boolean; asking?: boolean; busy?: boolean; ok?: boolean; err?: boolean; cls?: string; live?: boolean };
const pubConfirm = (o: { busy?: boolean; live?: boolean } = {}) => confirmBox({ title: "Publish 2 new places and 5 edited places to the public map?", body: "1 place will be removed. This opens a change request on GitHub that merges on its own.", action: "Publish", tone: "primary", busy: o.busy ? "Publishing…" : undefined, live: o.live });
const pubBtn = (o: PubOpt) => `<button type="button" class="pa-bp pa-ring${o.cls ? ` ${o.cls}` : ""}"${o.upToDate ? " disabled" : ""}>Publish</button>`;
const pubBar = (o: PubOpt = {}) => `<section class="pa-pub pa-cw"><div class="in"><p>${o.upToDate ? "The public map is up to date." : `<strong>2 new</strong>, <strong>5 edited</strong>, <strong>1 removed</strong> since the last publish.`}</p>
  <div class="r">${o.review && !o.upToDate ? `<a class="pa-tl pa-ring" href="#admin-publish"${o.live ? say("Mockup: this would open Places, where each change can be checked.") : ""}>Review changes</a>` : ""}
  ${o.live ? liveOpen(pubBtn(o)) : o.asking || o.busy ? "" : pubBtn(o)}</div></div>
  ${o.live ? liveBox(pubConfirm({ live: true }), 12) : o.asking || o.busy ? `<div style="margin-top:12px">${pubConfirm({ busy: o.busy })}</div>` : ""}
  ${o.ok ? `<p class="ok" aria-live="polite">Published: 7 places pushed, 1 place removed to the public map. A <a class="pa-lnk" href="#admin-publish">change request</a> was opened and set to auto-merge. It can take a minute for the map to update.</p>` : ""}
  ${o.err ? `<p class="bad" role="alert">Couldn't reach GitHub to publish. Nothing was changed. Try again in a moment.</p>` : ""}</section>`;
const botBanner = (stuck: boolean) => `<section class="pa-bot${stuck ? " stuck" : ""}"${stuck ? ' role="alert"' : ""}>${stuck
  ? `<strong style="font-weight:600">Publish is stuck: merge conflict.</strong> <a class="pa-lnk" href="#admin-publish">PR #4821</a> hasn&apos;t merged, so the public map is still showing the OLD data. Fix it (or close the PR) and publish again.`
  : `Publish in progress: waiting on <a class="pa-lnk" href="#admin-publish">PR #4821</a>. The public map updates once it merges.`}</section>`;

const publishEntry = entry({
  id: "admin-publish", name: "Publish bar (PublishPanel, PublishBotStatusBanner)", status: "built",
  statusNote: "Live as is (#926). Publish is the shared green button, 48 tall, and asks in a green box on the page, Cancel first, in place of the browser's pop-up. Review changes has a 48-pixel tap area. No long dashes in the bar or the banner.",
  purpose: "Places only reach the public map when someone presses Publish. The bar says how many places are new, edited or removed since the last time, and holds the one Publish button. Above it, a banner follows the change request that Publish opens until it lands, and turns red if it gets stuck.",
  instead: [
    "It's a blessing box or an event: they show on the map as soon as they're saved, with no Publish.",
    "It's the test site: the dashboard shows a clay line in its place, Test site: publishing is turned off here.",
    "It's one place's unpublished changes: use the Waiting to publish box on that place's page.",
  ],
  versions:
    wide("On the Dashboard: the counts, a Review changes link and Publish. Tap Publish: the box opens under the sentence, with the same counts. Nothing is sent until its own Publish.", pubBar({ review: true, live: true })) +
    wide("On Places: the same bar without the link.", pubBar()) +
    wide("While the change request is on its way (the banner sits above the bar)", botBanner(false)) +
    wide("Stuck: a red edge and words, read out right away", botBanner(true)),
  states:
    wide("Publish: resting, pointer over it (sage 700), keyboard", `${pubBar({ cls: "" })}<div style="height:8px"></div>${pubBar({ cls: "is-hover" })}<div style="height:8px"></div>${pubBar({ cls: "is-focus" })}`) +
    wide("Nothing to publish: the button is faded and can't be pressed", pubBar({ upToDate: true })) +
    wide("Asking: the green box, Cancel first", pubBar({ asking: true })) +
    wide("Working: Publishing…, both buttons faded", pubBar({ busy: true })) +
    wide("Done: a green line with a link to the change request", pubBar({ ok: true })) +
    wide("Failed: a red line that says nothing changed", pubBar({ err: true })),
  colors:
    sw("White", "white", "The bar and the banner, with a bone 200 edge") +
    swr("Ink 700", "color-ink-700", "The sentence and the in-progress banner") +
    swr("Ink 900", "color-ink-900", "The counts, semi-bold, and the confirm's question") +
    swr("Sage 700", "color-sage-700", "Review changes, and the done line") +
    sw("Sage 600", "color-sage-600", `Publish. Bone 50 words ${r("color-bone-50", "color-sage-600")}; sage 700 under the pointer ${r("color-bone-50", "color-sage-700")}`) +
    swr("Sage 500", "color-sage-500", "The confirm box's edge", "white", 3) +
    swr("Danger red", "color-danger", "The failed line, and the stuck banner's words and edge"),
  sizes: "Corners 14 pixels. 16 pixels of padding (16 by 32 from 640 wide), where the sentence and the button share a row. Words 14 pixels. Publish and Review changes are 48 pixels tall, 12 pixels apart. The confirm opens full width 12 pixels under the sentence: corners 10, 16 pixels of padding, Cancel and Publish 48 tall, stacked full width on a phone (Cancel on top) and half the row each from 640. The banner sits 12 pixels above the bar.",
  wording: [
    "The bar counts what changes on the map: 2 new, 5 edited, 1 removed since the last publish. With nothing to do it says The public map is up to date.",
    "The confirm asks with the same counts: Publish 2 new places and 5 edited places to the public map? Then 1 place will be removed. (only when some are) and This opens a change request on GitHub that merges on its own.",
    "After: Published: 7 places pushed, 1 place removed to the public map, and that the map can take a minute. A failure always says whether anything changed; when it can't tell, it says so and says to reload.",
  ],
  everyone: [
    "Keyboard: Review changes, then Publish. Enter on Publish opens the box with the keyboard on Cancel; Escape closes it and returns to Publish.",
    "Screen reader: the confirm is a group named by its question; the done line is announced politely; the failed line and the stuck banner are read out at once.",
    "Color is never the only sign: stuck is written out, and the button's faded look comes with it not responding.",
  ],
  dd: dodont(
    [`<div class="pa pa-cq" style="width:100%">${pubBar({ review: true })}</div>`, "Say what will change before the button: how many new, edited and removed."],
    [`<div class="pa pa-cq" style="width:100%"><section class="pa-pub"><div class="in"><p>You have unpublished changes.</p><div class="r"><button type="button" class="pa-bp">Publish</button></div></div></section></div>`, "Vague. Nobody can tell whether this pushes one fix or removes ten places (made-up example)."],
  ),
  code: [
    "src/components/PublishPanel.tsx (primaryButtonClass, the AdminConfirm, tapLinkClass on Review changes)",
    "src/components/PublishBotStatusBanner.tsx (bannerLinkClass: the links take the banner's color)",
    "src/app/(site)/admin/page.tsx and admin/places/page.tsx (where they sit, and the test-site line)",
  ],
});

// ── Change cards (ProposalCard, SubmissionCard, PhotoReviewCard, SponsorRequestCard) ─────────────────────────
type Act = { busy?: boolean; cls?: string; live?: boolean; err?: string };
const rejectBox = (danger: string) => `<div class="pa-rej"><label class="pa-clab" for="pa-rr-${++uid}">Reason <span style="font-weight:400;text-transform:none;color:var(--color-ink-400)">(optional, for your own notes)</span></label>
  <textarea id="pa-rr-${uid}" class="pa-in" rows="2"></textarea>
  <div class="pa-btns" style="margin-top:8px"><button type="button" class="pa-bs pa-ring">Cancel</button><button type="button" class="pa-bd pa-ring">${danger}</button></div></div>`;
const proposal = (o: Act & { reject?: boolean } = {}) => `<div class="pa-card"><div class="pa-row atop"><div class="pa-btns" style="gap:8px"><span class="pa-tag t-sage">Plentiful</span><span class="pa-tag t-bone">Field update</span><span class="pa-tag t-clay">Needs a human</span></div><p class="pa-meta">Nov 4, 2026, 2:05 AM · run 318</p></div>
  <div class="pa-cols"><div><p class="pa-name">Eastside Community Pantry</p><p style="color:var(--color-ink-500)">100 Example Ave, Pueblo, CO 81001</p><p class="pa-meta">eastside-community-pantry</p>
  <dl class="pa-diff" style="margin-top:8px"><div><dt class="pa-fl">Hours</dt><dd><s>Tue 9am – 1pm</s> <span aria-hidden="true">→</span> <span class="new">Tue 9am – 2pm</span></dd></div><div><dt class="pa-fl">Phone</dt><dd><s>(719) 555-0142</s> <span aria-hidden="true">→</span> <span class="new u">(719) 555-0187</span></dd></div></dl></div>
  <div class="pv"><p class="pa-fl" style="margin-bottom:8px">Preview: public map</p><div class="pa-stand">The public list card (VenueCard) with the new details stands in here</div></div></div>
  <div class="pa-btns" style="margin-top:16px"><button type="button" class="pa-bp pa-ring${o.cls ? ` ${o.cls}` : ""}"${o.busy ? " disabled" : ""}${o.live ? say("Mockup: this would apply the change. It shows on the map at the next Publish.") : ""}>${o.busy ? "Applying…" : "Approve"}</button>${o.reject ? "" : `<button type="button" class="pa-bs pa-ring"${o.live ? ` onclick="${q("const c=this.closest('.pa-card');const s=c.querySelector('.pa-rej');s.hidden=false;s.querySelector('textarea').focus();this.hidden=true")}"` : ""}>Reject</button>`}</div>
  ${o.err ? `<p role="alert" style="margin-top:8px;color:var(--color-danger)">${o.err}</p>` : ""}
  ${o.reject || o.live ? rejectBox("Confirm reject").replace('<div class="pa-rej">', `<div class="pa-rej"${o.live ? " hidden" : ""}>`) : ""}</div>`;
const archiveCard = (live = false) => `<div class="pa-card"><div class="pa-row atop"><div class="pa-btns" style="gap:8px"><span class="pa-tag t-sage">Care and Share</span><span class="pa-tag t-bone">Remove</span></div><p class="pa-meta">Nov 4, 2026, 2:05 AM</p></div>
  <div style="margin-top:12px"><p class="pa-name">Southside Food Shelf</p><p style="color:var(--color-ink-500)">55 Sample St, Pueblo, CO 81004</p></div>
  <div style="margin-top:16px">${(live ? confirmLive : (b: string, c: string) => c)(`<button type="button" class="pa-bd pa-ring">Archive this venue</button>`, confirmBox({ title: "Archive Southside Food Shelf?", body: "It stops showing on the public map at the next publish. Its record is kept, not deleted.", action: "Archive this venue", tone: "danger", live }))}</div></div>`;
const submission = (live = false) => `<div class="pa-card"><div class="pa-row atop"><span class="pa-tag t-clay">Public report</span><p class="pa-meta">Nov 2, 2026, 9:40 AM · lee@example.com</p></div>
  <div style="margin-top:12px;display:flex;flex-direction:column;gap:4px"><p class="pa-name">Northside Free Fridge</p><p><span class="pa-fl">Address: </span>200 Sample Rd, Pueblo, CO 81003</p><p><span class="pa-fl">Issue: </span>Wrong hours</p><p><span class="pa-fl">Description: </span>The sign on the door says it opens at 10 now, not 9.</p></div>
  <div class="pa-btns" style="margin-top:16px"><button type="button" class="pa-bp pa-ring"${live ? say("Mockup: this would mark the report done.") : ""}>Mark done</button><button type="button" class="pa-bs pa-ring">Reject</button></div></div>`;
const photo = (live = false) => `<div class="pa-card"><div class="pa-row atop"><span class="pa-tag t-clay">Photo reported (2×)</span><p class="pa-meta">Nov 1, 2026, 6:18 PM</p></div>
  <div class="pa-photo"><div class="img" role="img" aria-label="Photo submitted for Elm Street Blessing Box">Photo</div><div style="display:flex;flex-direction:column;gap:4px"><p class="pa-name">Elm Street Blessing Box</p><p><span class="pa-fl">Attached to check-in: </span>filled</p><p style="color:var(--color-ink-500)">Hidden from the public card until you decide.</p></div></div>
  <div class="pa-btns" style="margin-top:16px"><button type="button" class="pa-bp pa-ring"${live ? say("Mockup: this would keep the photo on the box's card.") : ""}>Keep photo</button><button type="button" class="pa-bs pa-ring">Remove photo</button></div></div>`;
const sponsor = `<div class="pa-card"><div class="pa-row atop"><span class="pa-tag t-sage">Email confirmed</span><p class="pa-meta">Oct 30, 2026, 11:02 AM</p></div>
  <div style="margin-top:12px;display:flex;flex-direction:column;gap:4px"><p class="pa-name">Elm Street Blessing Box</p><p><span class="pa-fl">Name: </span>The Ortiz family</p><p><span class="pa-fl">Email: </span><a class="pa-lnk pa-ring" style="color:var(--color-sage-700)" href="#admin-change">ortiz.family@example.com</a></p><p style="color:var(--color-ink-500)">Approving adds them to &ldquo;Sponsored by …&rdquo; on the public card.</p></div>
  <div class="pa-btns" style="margin-top:16px"><button type="button" class="pa-bp pa-ring">Approve sponsor</button><button type="button" class="pa-bs pa-ring">Decline</button></div></div>`;
const btnRow = (html: string) => `<div class="pa-btns" style="background:#fff;padding:10px;border-radius:10px">${html}</div>`;

const changeEntry = entry({
  id: "admin-change", name: "Change cards (ProposalCard, SubmissionCard, PhotoReviewCard, SponsorRequestCard)", status: "built",
  statusNote: "Live as is (#926). One button height, 48, on all four cards; Reject, Cancel, Remove photo and Decline take the light green tint under the pointer; in every reject step Cancel comes first and the red Confirm second; Archive this venue asks in a red box on the page; every tag is fully round.",
  purpose: "One card for each thing waiting on a person: a change the weekly data check found, a place or problem the public sent in, a box photo, a sponsor request. Each card shares the white card shell and the same order: tags and when it arrived, what it is, then the decision buttons, with the yes button first.",
  instead: [
    "It's a count of everything waiting: use a summary box.",
    "It's an event someone shared: use the Sent in by the public list in Events (Lists and tables).",
    "The change needs editing before it's right: use Review as new place or Review &amp; fix link, which open the full form.",
  ],
  versions:
    wide("A data change (ProposalCard). Tags: where it came from, what kind, and how sure the sorting was. The old value is crossed out, the new one follows. From 1024 pixels wide a preview of the public card sits on the right. Tap Reject: the reason box opens in its place, with the cursor in it.", proposal({ live: true })) +
    wide("A data change that removes a place: Archive this venue asks on the page, red, Cancel first. Tap it.", archiveCard(true)) +
    wide("A public report (SubmissionCard): Mark done or Reject. The sender's email shows only here.", submission(true)) +
    wide("A reported box photo (PhotoReviewCard): the photo is big enough to judge.", photo(true)) +
    wide("A sponsor request (SponsorRequestCard); the email is a real link with the green ring.", sponsor),
  states:
    demo("Approve: resting, pointer over it (sage 700), keyboard", btnRow(`<button type="button" class="pa-bp pa-ring">Approve</button><button type="button" class="pa-bp pa-ring is-hover">Approve</button><button type="button" class="pa-bp pa-ring is-focus">Approve</button>`)) +
    demo("Working: Applying…, faded; Reject is still there", btnRow(`<button type="button" class="pa-bp" disabled>Applying…</button><button type="button" class="pa-bs">Reject</button>`)) +
    demo("Reject: resting, pointer over it (sage 100), keyboard", btnRow(`<button type="button" class="pa-bs pa-ring">Reject</button><button type="button" class="pa-bs pa-ring is-hover">Reject</button><button type="button" class="pa-bs pa-ring is-focus">Reject</button>`)) +
    demo("Confirm reject: resting, pointer over it (fills red), keyboard (a red ring)", btnRow(`<button type="button" class="pa-bd pa-ring">Confirm reject</button><button type="button" class="pa-bd is-hover">Confirm reject</button><button type="button" class="pa-bd is-focus">Confirm reject</button>`)) +
    wide("Reject opened: an optional reason, then Cancel first and Confirm reject", proposal({ reject: true })) +
    wide("Failed: what did not happen, in red under the buttons", proposal({ err: "This change was not applied. Try again." })),
  colors:
    sw("Sage 100", "color-sage-100", `Calm tags (Plentiful, New place, Email confirmed). Sage 700 words ${r("color-sage-700", "color-sage-100")}. Also the fill under the pointer on Reject and Cancel: ink 700 words ${r("color-ink-700", "color-sage-100")}`) +
    sw("Clay 100", "color-clay-100", `Tags that need a look (Needs a human, Public report, Photo reported). Clay 700 words ${r("color-clay-700", "color-clay-100")}`) +
    sw("Bone 100", "color-bone-100", `Quiet tags (Field update, Likely noise), ink 500 words ${r("color-ink-500", "color-bone-100")}`) +
    swr("Clay 700", "color-clay-700", "The crossed-out old value") +
    swr("Sage 700", "color-sage-700", "The new value") +
    swr("Ink 400", "color-ink-400", "When it arrived, the run number, and small capital labels") +
    swr("Danger red", "color-danger", "Confirm reject's and Archive this venue's words and edge, and errors") +
    sw("Danger red fill", "color-danger", `A red button under the pointer. Bone 50 words on it ${r("color-bone-50", "color-danger")}`) +
    sw("Bone 300", "color-bone-300", `Reject and Cancel edges, ${contrast(H("color-bone-300"), H("white")).toFixed(1)} to 1: decoration, the words carry the button. The reason box has the ink 400 edge of every admin text box`),
  sizes: "The card shell from Admin cards and boxes. Tags 12 pixels, 2 by 8 padding, fully round. The name 16 pixels semi-bold; the address 14; details 14; labels 11-pixel capitals. Every button is 48 pixels tall, 8 pixels apart, corners 10. The preview column is 320 pixels wide from 1024 up.",
  wording: [
    "The yes button says what it does: Approve, Approve rename, Mark done, Keep photo, Approve sponsor. A data change that removes a place says Archive this venue, and asks: Archive Southside Food Shelf? It stops showing on the public map at the next publish. Its record is kept, not deleted.",
    "No is Reject, Remove photo (a reported photo), Decline or Remove (a sponsor). Its second step says Confirm reject, Confirm remove or Confirm decline, after Cancel.",
    "The reason is optional and says who reads it: (optional, for your own notes).",
    "Errors say what did not happen, then Try again: This change was not applied. This suggestion was not rejected. This report was not marked done. The photo was not removed. The request was not declined.",
  ],
  everyone: [
    "Keyboard: the order on screen is the tab order; the preview is skipped, since it can't be used. Opening a reason step puts the cursor in its box; Cancel, or Escape anywhere in the step, closes it, clears what was typed and puts the keyboard back on the button that opened it. While its request runs, Escape does nothing.",
    "Screen reader: the arrow between old and new values is hidden, so the two values are read in order. Errors are read out at once. The reason box has a real label.",
    "Touch: the cards stack everything in one column on a phone. Every button is 48 pixels.",
    "Color is never the only sign: every tag is words, and the old value is crossed out as well as colored.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%">${btnRow(`<button type="button" class="pa-bp">Keep photo</button><button type="button" class="pa-bs">Remove photo</button>`)}</div>`, "One filled yes button first, and a plain outline for no."],
    [`<div class="pa" style="width:100%">${btnRow(`<button type="button" class="pa-bp">Keep photo</button><button type="button" class="pa-bp">Remove photo</button>`)}</div>`, "Two filled buttons. The two choices look the same, so the wrong one gets pressed (made-up example)."],
  ),
  code: [
    "src/lib/adminCardStyles.ts (cardClass, cardNameClass, tagClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass)",
    "src/components/ProposalCard.tsx (SOURCE_BADGE and LANE_BADGE tags as tones, the diff, the preview column, the Archive this venue AdminConfirm), SubmissionCard.tsx, PhotoReviewCard.tsx, SponsorRequestCard.tsx",
    "src/components/AdminConfirm.tsx (useAdminStep: the reason step's focus)",
  ],
});

// ── Admin form fields and the save button (formClasses.ts) ────────────────────────────────────────────────────
const field = (o: { label: string; req?: boolean; hint?: string; value?: string; ph?: string; err?: string; cls?: string; select?: string[]; textarea?: boolean }) => {
  const id = `pa-f-${++uid}`;
  const ctl = o.select
    ? `<select id="${id}" class="pa-in${o.err ? " bad" : ""}${o.cls ? ` ${o.cls}` : ""}">${o.select.map((x) => `<option${x === o.value ? " selected" : ""}>${x}</option>`).join("")}</select>`
    : o.textarea ? `<textarea id="${id}" class="pa-in" rows="3" placeholder="${o.ph ?? ""}">${o.value ?? ""}</textarea>`
    : `<input id="${id}" class="pa-in${o.err ? " bad" : ""}${o.cls ? ` ${o.cls}` : ""}" type="text" value="${o.value ?? ""}" placeholder="${o.ph ?? ""}"${o.err ? ` aria-invalid="true" aria-describedby="${id}-e"` : ""}>`;
  return `<div style="width:100%"><label class="pa-label" for="${id}">${o.label}${o.req ? '<span class="req" aria-hidden="true"> *</span>' : ""}${o.hint ? `<span class="hint"> ${o.hint}</span>` : ""}</label>${ctl}${o.err ? `<p class="pa-err" id="${id}-e" role="alert">${o.err}</p>` : ""}</div>`;
};
const checkbox = (label: string, on = false, cls = "") => `<label class="pa-cb${cls ? ` ${cls}` : ""}"><input type="checkbox"${on ? " checked" : ""}>${label}</label>`;
const CATS = ["Select a category", "Food Pantry", "Grocery / Supermarket", "Convenience Store", "Farm / Market", "Community Garden", "Edible Landscape", "Meal Site", "Blessing Box"];
const saveBtn = (o: { busy?: boolean; cls?: string; live?: boolean; label?: string } = {}) => `<button type="button" class="pa-bfull pa-ring${o.cls ? ` ${o.cls}` : ""}"${o.busy ? " disabled" : ""}${o.live ? say("Mockup: nothing is saved.") : ""}>${o.busy ? "Saving…" : (o.label ?? "Save changes")}</button>`;
const cancelLink = (o: { live?: boolean; busy?: boolean; where?: string; cls?: string } = {}) => `<a class="pa-bs big pa-ring${o.cls ? ` ${o.cls}` : ""}" href="#admin-forms"${o.busy ? ' aria-disabled="true" tabindex="-1" style="opacity:.6;cursor:not-allowed"' : ""}${o.live ? say(`Mockup: this would go back to ${o.where ?? "Places"} and save nothing.`) : ""}>Cancel</a>`;
const savePair = (o: { live?: boolean; busy?: boolean } = {}) => `<div class="pa-savepair">${cancelLink(o)}${saveBtn(o)}</div>`;
const eventSaveRow = (live = false) => `<div class="pa-savepair">${cancelLink({ live, where: "Events" })}<div class="two"><button type="button" class="pa-bs big pa-ring"${live ? say("Mockup: nothing is saved.") : ""}>Save draft</button><button type="button" class="pa-bp big pa-ring"${live ? say("Mockup: nothing is published.") : ""}>Publish</button></div></div>`;
const snapField = (on: number) => `<div style="width:100%"><p class="pa-label" aria-hidden="true">Accepts SNAP</p>${seg("Accepts SNAP", ["Unknown", "Yes", "No"], on)}</div>`;
const venueForm = (live = false) => `<form class="pa-form" onsubmit="return false" novalidate>
  ${field({ label: "Name", req: true, value: "Eastside Community Pantry" })}
  ${field({ label: "Category", req: true, select: CATS, value: "Food Pantry" })}
  ${field({ label: "Website", hint: "(optional)" })}
  ${snapField(1)}
  ${checkbox("Outside Pueblo County")}
  ${savePair({ live })}</form>`;

const formsEntry = entry({
  id: "admin-forms", name: "Admin form fields and the save button (formClasses.ts)", status: "built",
  statusNote: "Live as is (#926). Cancel sits beside Save on every admin form (owner's ruling: Cancel beside Save); text boxes are 48 tall with a darker ink 400 edge; tick boxes are 20 pixels in 48-tall rows; SNAP, WIC and an event's place are sliders; the event form says Cancel, not Back to events.",
  purpose: "The boxes, labels, error lines, tick boxes and the Cancel and Save row every admin form shares: Add a place and its edit page, Add event and Edit event, an event's flyer, host alert emails, and sign-in. One set of classes, so the forms look the same and can't drift apart.",
  instead: [
    "It's a public form (Suggest a place, Report a problem, Share an event): use the public form fields, with the Turnstile check.",
    "It's a search or filter above a list: use the list's own search box and filter chips (Lists and tables).",
    "It's picking one of two or three short choices: a slider (Dashboard numbers shows the period one), not a drop-down.",
  ],
  versions:
    mid("A place's edit page (AddVenueForm, shortened): label, box, a red star for required, (optional) on the others, SNAP as a slider, a tick box, then Cancel and Save changes. Cancel goes where Save would land (Places, or the To review list) and saves nothing. Tap either.", venueForm(true)) +
    mid("An event field with a hint after its label (EventForm), a larger text box, and its save row: Cancel, then Save draft and Publish. Cancel goes back to Events.", `<form class="pa-form" onsubmit="return false">${field({ label: "Host (English)", hint: "(optional)", value: "Mesa Street Community Garden" })}${field({ label: "About (English)", textarea: true, value: "Free produce and canned goods while they last. Bring a bag." })}<div style="width:100%"><p class="pa-label" aria-hidden="true">Where</p>${seg("Choose a place already on the map, or type a different address", ["On the map", "Other address"], 0)}</div>${eventSaveRow(true)}</form>`) +
    mid("A failed save: the red box at the top of the form, with the red Reload when someone else saved first", `<div class="pa-banner" role="alert"><p class="t">Someone else changed this place since you opened it. Reload to see their changes.</p><button type="button" class="pa-bd pa-ring">Reload</button></div>`) +
    mid("Any other failed save: the red line at the top of the form says what did not happen", `<div class="pa-fail" role="alert"><p class="t">The place was not saved. Try again.</p></div>`),
  states:
    demo("Box: empty, with its example in ink 400 and its ink 400 edge", field({ label: "Who told us, and how", hint: "(optional)", ph: "e.g. Heather, admin assistant, by email" })) +
    demo("Box: reached by keyboard or typing, a green edge and ring", field({ label: "Name", req: true, value: "Eastside Community Pantry", cls: "is-focus" })) +
    demo("Box: wrong. Red edge and the reason under it.", field({ label: "Name", req: true, err: "Name is required." })) +
    demo("Tick box: off, on, reached by keyboard. The whole 48-pixel row is the tap area.", `<div style="display:flex;flex-direction:column">${checkbox("Outside Pueblo County")}${checkbox("The venue told us", true)}${checkbox("Outside Pueblo County", false, "is-focus")}</div>`) +
    demo("Slider: resting, pointer over a choice (sage 100), keyboard", `<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">${seg("Accepts WIC, resting", ["Unknown", "Yes", "No"], 0)}${seg("Accepts WIC, pointer", ["Unknown", "Yes", "No"], 0, ["", "is-hover"])}${seg("Accepts WIC, keyboard", ["Unknown", "Yes", "No"], 0, ["is-focus"])}</div>`) +
    demo("Save changes: resting, pointer over it (sage 700), keyboard", `<div style="display:flex;flex-direction:column;gap:12px;width:100%">${saveBtn()}${saveBtn({ cls: "is-hover" })}${saveBtn({ cls: "is-focus" })}</div>`) +
    demo("Cancel: resting, pointer over it (sage 100), keyboard", `<div style="display:flex;flex-direction:column;gap:12px;width:100%">${cancelLink()}${cancelLink({ cls: "is-hover" })}${cancelLink({ cls: "is-focus" })}</div>`) +
    demo("Working: Saving…, faded; Cancel is off too, so nobody leaves while the save lands", `<div style="width:100%">${savePair({ busy: true })}</div>`),
  colors:
    sw("White", "white", "Every box") +
    sw("Ink 400 edge", "color-ink-400", `A box's edge at rest. ${r("color-ink-400", "white", 3)} on white (edge): the edge is the only thing that shows where the box is`) +
    swr("Ink 700", "color-ink-700", "Labels, tick box words, Cancel") +
    swr("Ink 900", "color-ink-900", "What's typed") +
    swr("Ink 400", "color-ink-400", "Examples in empty boxes, and hints after a label") +
    swr("Danger red", "color-danger", "The required star, error lines, a wrong box's edge, the failed-save box and Reload") +
    swr("Sage 500", "color-sage-500", "Edge and ring while typing; keyboard rings", "white", 3) +
    sw("Sage 600", "color-sage-600", `Save changes, Publish, the tick, the slider's chosen part. Bone 50 words ${r("color-bone-50", "color-sage-600")}; sage 700 under the pointer ${r("color-bone-50", "color-sage-700")}`) +
    sw("Sage 100", "color-sage-100", `Cancel, Save draft and a slider choice under the pointer. Ink 700 words ${r("color-ink-700", "color-sage-100")}`) +
    sw("Bone 200", "color-bone-200", `The slider's track, ink 700 words on it ${r("color-ink-700", "color-bone-200")}`),
  sizes: "Labels 14 pixels, medium, 4 above the box. Boxes full width, corners 10, 8 by 12 padding, 16-pixel words on a phone so it doesn't zoom in (14 from 768 wide), at least 48 pixels tall. Fields 24 pixels apart; a form page is one 672-pixel column. Tick boxes 20 pixels in a 48-pixel row. The slider is 48 tall. The save row: Cancel a third, Save two thirds, both 48 tall with 16-pixel words; on a new or draft event the two thirds hold Save draft and Publish, half each with 8 pixels at the sides, so Cancel, Save draft and Publish sit on one row, one line each, at 360. The Location block on a place's form: the address full width, latitude and longitude side by side under it, then the map, at most 420 wide.",
  wording: [
    "Labels are one or two words. Optional fields say (optional) in ink 400; required ones get a red star that screen readers skip (they hear required instead).",
    "Errors say what to do: Name is required. Enter a start date and time. The end must be after the start. A failed save says what did not happen: The place was not saved. Try again.",
    "The save button names the action: Add venue on a new place, Save changes on an existing one, Save draft and Publish on an event. Working: Saving….",
    "Cancel, never Back or Discard, beside Save. It saves nothing.",
  ],
  everyone: [
    "Keyboard: fields go top to bottom in screen order; Enter in a box saves (Cancel is a link, so Save stays the form's first send button). Every box, tick box, slider and button shows the green ring. After a refused save the cursor goes to the first wrong box, which stays red while it has focus. Add host keeps the keyboard on it while it adds, then puts the cursor back in the empty email box.",
    "Screen reader: every box has a real label; required boxes say so; a wrong box is marked invalid and its error is read out. A slider is a group of real radios with its own name.",
    "Touch: every box, tick box row, slider and button is 48 pixels tall.",
    "Color is never the only sign: a red edge always comes with a written error.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%">${savePair()}</div>`, "Cancel beside Save, so leaving without saving is one obvious tap."],
    [`<div class="pa" style="width:100%">${saveBtn()}</div>`, "Save alone. The only way out is the browser's back button, and nobody knows whether that keeps the changes (made-up example)."],
  ),
  code: [
    "src/components/formClasses.ts (inputBase, inputBorder, labelClass, errorClass, hintClass, requiredMarkClass, checkboxRowClass, checkboxClass, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, saveRowClass, cancelLinkProps)",
    "src/components/AddVenueForm.tsx (Cancel goes to afterSaveHref; Reload is dangerButtonClass; SNAP and WIC are AdminSegmented)",
    "src/components/EventForm.tsx (Cancel to Events; the place choice is AdminSegmented; Cancel event and Archive event sit apart under Danger zone)",
    "src/components/EventFlyerField.tsx, HostAlertsAdminPanel.tsx (the same fields and buttons)",
    "Known live issue: src/components/PublicForm.tsx (lines 33 to 42) keeps a separate copy of the field styles with the bone 300 edge; the public forms were outside #926, so the admin and public boxes now differ",
  ],
});

// ── Lists and tables (VenueListView, AllBoxesTable, EventsList, EventSubmissionsList) ─────────────────────────
const STATUS_TAG: Record<string, [string, string]> = { draft: ["Draft", "t-yel"], live: ["Live", "t-sage"], waiting: ["Live · edits waiting", "t-clay"], removed: ["Removed", "t-bone"] };
const stTag = (k: string) => `<span class="pa-tag ${STATUS_TAG[k][1]}">${STATUS_TAG[k][0]}</span>`;
const statusKey = `<dl class="pa-key">${([["draft", "New, not on the public map yet."], ["live", "On the public map, exactly as shown."], ["waiting", "Approved or saved changes the map doesn't show until Publish."], ["removed", "Taken off the map, kept for the record."]] as [string, string][]).map(([k, d]) => `<div><dt>${stTag(k)}</dt><dd>${d}</dd></div>`).join("")}</dl>`;
const chip = (label: string, on = false, cls = "") => `<button type="button" class="pa-chip pa-ring${on ? " on" : ""}${cls ? ` ${cls}` : ""}" aria-pressed="${on ? "true" : "false"}">${label}</button>`;
const placesChips = `<div class="pa-chips">${chip("All places (48)")}${chip("To review (12)", true)}${chip("Live · edits waiting (5)")}${chip("Draft (2)")}${chip("Live (39)")}${chip("Removed (3)")}</div>`;
const placesSearch = `<div class="pa-ctlrow"><div class="pa-ctl"><label class="pa-clab" for="pa-vs-${++uid}">Search</label><input id="pa-vs-${uid}" class="pa-in" type="search" placeholder="Search by name or address"></div><div class="pa-ctl"><label class="pa-clab" for="pa-vc-${uid}">Category</label><select id="pa-vc-${uid}" class="pa-in"><option>All</option><option>Food Pantry</option><option>Blessing Box</option></select></div></div>`;
// R3, the public category label: the category in its color, then SNAP and WIC in sage 700, joined by ink 400 dots.
const CAT_COLOR: Record<string, string> = { "Food Pantry": "var(--color-cat-pantry)", "Community Garden": "var(--color-cat-garden)", "Grocery / Supermarket": "var(--color-cat-grocery)" };
const catLabel = (cat: string, benefits: string[] = []) => `<span style="font-weight:600;white-space:nowrap"><span style="color:${CAT_COLOR[cat]}">${cat}</span>${benefits.map((b) => `<span aria-hidden="true" style="color:var(--color-ink-400)"> · </span><span style="color:var(--color-sage-700)">${b}</span>`).join("")}</span>`;
const vRow = (o: { name: string; cat: string; benefits?: string[]; st: string; review?: string; addr: string; ver: string; cls?: string; newPlace?: boolean }) =>
  `<tr${o.cls ? ` class="${o.cls}"` : ""}><td style="font-weight:500"><a class="nm" href="#admin-lists">${o.name}</a></td><td>${catLabel(o.cat, o.benefits)}</td><td>${o.newPlace ? `<span class="pa-btns" style="gap:4px"><span class="pa-tag t-clay">Suggested new place</span><span class="pa-tag t-clay">Public</span></span>` : stTag(o.st)}</td><td>${o.review ? `<span style="display:flex;align-items:center;gap:6px;font-size:12px;line-height:16px">${o.review}</span>` : `<span style="color:var(--color-ink-400)">—</span>`}</td><td class="m5">${o.addr}</td><td class="m5 nw">${o.ver}</td></tr>`;
const placesTable = (hoverRow = "") => `<div class="pa-tw el"><table style="min-width:680px"><thead><tr><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">To review</th><th scope="col">Address</th><th scope="col">Last verified</th></tr></thead><tbody class="hov">
  ${vRow({ name: "Eastside Community Pantry", cat: "Food Pantry", benefits: ["SNAP"], st: "waiting", review: `Hours <span class="pa-tag t-sage">Plentiful</span>`, addr: "100 Example Ave", ver: "Oct 28, 2026", cls: hoverRow })}
  ${vRow({ name: "Northside Free Fridge", cat: "Food Pantry", st: "", newPlace: true, review: `New place <span class="pa-tag t-clay">Public report</span>`, addr: "200 Sample Rd", ver: "—" })}
  ${vRow({ name: "Mesa Street Community Garden", cat: "Community Garden", st: "live", addr: "300 Mesa St", ver: "Sep 14, 2026" })}
  ${vRow({ name: "Riverside Grocery", cat: "Grocery / Supermarket", benefits: ["SNAP", "WIC"], st: "draft", addr: "410 River Ln", ver: "—" })}</tbody></table></div>`;
const BOX_ST: Record<string, [string, string]> = { ok: ["OK", "t-sage"], low: ["Low", "t-low"], empty: ["Empty", "t-empty"], problem: ["Problem", "t-clay"], quiet: ["Quiet", "t-bone"] };
const fb = (label: string, o: { on?: boolean; dis?: boolean; cls?: string } = {}) => `<button type="button" class="pa-fb pa-ring${o.cls ? ` ${o.cls}` : ""}" aria-pressed="${o.on ? "true" : "false"}"${o.dis ? " disabled" : ""}>${label}</button>`;
const boxRow = (name: string, addr: string, st: string, last: string, sponsor: string, review = "") => `<tr><td><a class="nm" href="#admin-lists">${name}</a><p class="pa-small">${addr}</p></td><td><span class="pa-tag ${BOX_ST[st][1]}">${BOX_ST[st][0]}</span></td><td class="nw">${last}</td><td>${sponsor}</td><td>${review}</td></tr>`;
const boxesTable = `<div class="pa-chips" role="group" aria-label="Filter boxes by status">${fb("All (5)")}${fb("To review (1)", { on: true })}${fb("Needs help (3)")}${fb("Empty (1)")}${fb("Problem (1)")}${fb("Low (1)")}${fb("Quiet (0)", { dis: true })}${fb("OK (2)")}</div>
  <div style="margin-top:12px"><span class="pa-clab" aria-hidden="true">Sponsor</span>${seg("Sponsor", ["Any", "Has one", "Needs one"], 0)}</div>
  <p style="margin:12px 0 8px;color:var(--color-ink-500)" aria-live="polite">Showing 5 of 5 boxes</p>
  <div class="pa-tw el"><table style="min-width:720px"><thead><tr><th scope="col">Box</th><th scope="col">Status</th><th scope="col">Last report</th><th scope="col">Sponsor</th><th scope="col">To review</th></tr></thead><tbody class="hov">
  ${boxRow("Elm Street Blessing Box", "12 Elm St", "empty", "6 days ago", "Needs a sponsor", `<span style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500"><span style="width:48px;height:48px;border-radius:6px;border:1px solid var(--color-bone-200);background:var(--color-sage-100)"></span>Photo reported (2×)</span>`)}
  ${boxRow("Maple Court Blessing Box", "88 Maple Ct", "problem", "2 days ago", "The Ortiz family")}
  ${boxRow("Hillside Blessing Box", "5 Hillside Dr", "low", "Today", "Grace Bakery, Lopez family")}
  ${boxRow("Lakeview Blessing Box", "31 Lake Rd", "ok", "1 day ago", "Lakeview Neighbors, +2 more")}</tbody></table></div>`;
const evTag: Record<string, [string, string]> = { draft: ["Draft", "t-bone2"], published: ["Published", "t-sage"], cancelled: ["Cancelled", "t-clay"], archived: ["Archived", "t-bone"] };
const eventsTable = `<a class="pa-bp big pa-ring" href="#admin-lists" style="margin-bottom:16px">Add event</a>
  <div class="pa-tw el"><table style="min-width:640px"><thead><tr><th scope="col">Event</th><th scope="col">Starts (Pueblo time)</th><th scope="col">Status</th><th scope="col"><span class="sr">Edit</span></th></tr></thead><tbody class="hov">
  ${([["Fall Turkey Drive", "Sat, Nov 21, 10:00 AM", "published"], ["Winter Coat and Food Giveaway", "Sat, Dec 12, 9:00 AM", "draft"], ["Harvest Pop-up Market", "Sat, Oct 10, 8:00 AM", "cancelled"]] as [string, string, string][]).map(([n, w, s]) => `<tr><td class="m9">${n}</td><td class="nw">${w}</td><td><span class="pa-tag ${evTag[s][1]}">${evTag[s][0]}</span></td><td style="text-align:right"><a class="nm" href="#admin-lists">Edit</a></td></tr>`).join("")}</tbody></table></div>`;
const esubBody = `<div class="fly">Flyer</div><div class="txt"><p>Hosted by Grace Neighbors Church</p><p><span class="b9">Fri, Nov 20, 5:00 PM</span> to Fri, Nov 20, 7:00 PM (Pueblo time)</p><p><span class="b9">Grace Neighbors Church, </span>700 Example Blvd, Pueblo, CO 81004</p><p>Hot soup and bread for anyone who comes.</p><p><span class="pa-lab2">Bring </span>A bowl if you have one</p><p style="color:var(--color-ink-500);overflow-wrap:anywhere">Sent by Lee Park &lt;lee@example.com&gt; on Fri, Nov 6, 3:12 PM</p></div>`;
const dotsMenu = (name: string) => `<div class="pa-dotw"><button type="button" class="dots pa-dots" aria-label="More actions for ${name}" aria-expanded="false" aria-haspopup="menu">⋮</button><div class="menu" role="menu"><button type="button" role="menuitem" data-say="Mockup: this would make a draft event and open it.">Make it a draft event</button><hr><button type="button" role="menuitem" class="dng" data-say="Mockup: this would dismiss it.">Dismiss</button></div></div>`;
const esub = `<div class="pa-esub"><div class="top"><p class="pa-name">Community Soup Night</p>${dotsMenu("Community Soup Night")}</div><div class="in" style="margin-top:12px">${esubBody}</div></div>`;

const listsEntry = entry({
  id: "admin-lists", name: "Lists and tables (VenueListView, AllBoxesTable, EventsList, EventSubmissionsList)", status: "built",
  statusNote: "Live as is (#926). Filter chips are 48 tall everywhere and take the light green tint under the pointer, as does every row that links somewhere; the three tables share one look; the Places Category column is the public's colored category words; the Boxes Sponsor filter is a slider; each event the public sent in has one three-dot menu; an empty list shows the shared empty box, with Clear filters after a filter.",
  purpose: "Every place, box and event in one table each, with chips to narrow it, a search box, and the name as the way into its edit page. Places adds a key that explains each status; Blessing Boxes sorts the boxes that need help to the top; Events lists the public's shared events above the table.",
  instead: [
    "It's one item waiting on a decision: use a change card, which has room for the details.",
    "It's a total to watch: use a dashboard number.",
    "It's picking one of two or three choices: a slider (the Sponsor filter here).",
  ],
  versions:
    wide("Places (VenueListView): the status key, the quick filters, search and category, then the table. The Category column is the colored category words, with SNAP and WIC when the place takes them. The table is 680 pixels wide, so on a phone it scrolls sideways inside its own box; the page doesn't. Point at a row.", `<div style="display:flex;flex-direction:column;gap:12px">${statusKey}${placesChips}${placesSearch}${placesTable()}<p class="pa-meta" style="margin-top:0">4 of 48 places</p></div>`) +
    wide("Blessing Boxes (AllBoxesTable): status filters with counts (an empty one can't be pressed), the Sponsor slider, then the boxes. Low is dark words on yellow.", boxesTable) +
    wide("Events (EventsList): Add event, then the table with one Edit link per row.", eventsTable) +
    wide("Sent in by the public (EventSubmissionsList): each item's two actions in one three-dot menu, Dismiss last under a line. Tap the dots.", `<h3 class="wm" style="margin-bottom:12px">Sent in by the public</h3>${esub}`),
  states:
    demo("Filter chip: resting, pointer over it (sage 100), keyboard, on, none to show", `<div class="pa-chips">${fb("Low (1)")}${fb("Low (1)", { cls: "is-hover" })}${fb("Low (1)", { cls: "is-focus" })}${fb("To review (1)", { on: true })}${fb("Quiet (0)", { dis: true })}</div>`) +
    wide("A Places row: resting, pointer over it (sage 100). The name link with the keyboard ring.", `<div class="pa-tw"><table style="min-width:520px"><tbody class="hov">${vRow({ name: "Mesa Street Community Garden", cat: "Community Garden", st: "live", addr: "300 Mesa St", ver: "Sep 14, 2026" })}${vRow({ name: "Mesa Street Community Garden", cat: "Community Garden", st: "live", addr: "300 Mesa St", ver: "Sep 14, 2026", cls: "is-hover" }).replace('class="nm"', 'class="nm is-focus"')}</tbody></table></div>`) +
    demo("Three-dot button: resting, pointer over it, keyboard", `<div style="display:flex;gap:12px;background:#fff;padding:8px;border-radius:10px"><button type="button" class="dots pa-dots" aria-label="More actions, resting">⋮</button><button type="button" class="dots pa-dots" style="background:var(--color-sage-100);color:var(--color-ink-700)" aria-label="More actions, pointer">⋮</button><button type="button" class="dots pa-dots pa-ring is-focus" aria-label="More actions, keyboard">⋮</button></div>`) +
    demo("Nothing matches a filter: the shared empty box with Clear filters", `<div style="width:100%">${empty(["No places match your search or filters."], `<button type="button" class="pa-bs pa-ring">Clear filters</button>`)}</div>`) +
    demo("Nothing there yet", `<div style="width:100%">${empty(["No blessing boxes yet.", "Add a place with the category Blessing Box and it shows up here."])}</div>`) +
    demo("Every status tag on Places, Boxes and Events: one round shape", `<div class="pa-btns">${stTag("draft")}${stTag("live")}${stTag("waiting")}${stTag("removed")}${Object.values(BOX_ST).map(([l, c]) => `<span class="pa-tag ${c}">${l}</span>`).join("")}<span class="pa-tag t-bone2">Draft</span></div>`),
  colors:
    swr("Ink 400", "color-ink-400", "Column headings in small capitals, and the count under the table") +
    swr("Sage 700", "color-sage-700", "Names (the edit links), Edit, and SNAP and WIC in the Category column") +
    swr("Ink 500", "color-ink-500", "Address and last-verified columns, the empty box's words") +
    sw("Clay 100", "color-clay-100", `Tags that need a look. Clay 700 (Live · edits waiting, Problem, Public) ${r("color-clay-700", "color-clay-100")}; danger red (Empty) ${r("color-danger", "color-clay-100")}`) +
    sw("Sage 100", "color-sage-100", `OK, Live and Published tags, sage 700 words ${r("color-sage-700", "color-sage-100")}; the chip that's on; and the fill under the pointer on rows and chips (ink 700 words ${r("color-ink-700", "color-sage-100")}, ink 500 ${r("color-ink-500", "color-sage-100")})`) +
    sw("Yellow", "color-brand-yellow", `Draft on Places and Low on Boxes. Ink 900 words ${r("color-ink-900", "color-brand-yellow")}`) +
    sw("Bone 200", "color-bone-200", `Draft on Events, ink 700 words ${r("color-ink-700", "color-bone-200")}; also the table's edge and row lines (decoration)`) +
    sw("Bone 100", "color-bone-100", `Removed, Quiet and Archived tags, ink 500 words ${r("color-ink-500", "color-bone-100")}`) +
    sw("Bone 300", "color-bone-300", `Chip edges, ${contrast(H("color-bone-300"), H("white")).toFixed(1)} to 1 on white: decoration, the words carry the chip. The search box has the ink 400 edge of every admin text box`) +
    swr("Sage 500", "color-sage-500", "The edge of the chip that's on, and keyboard rings", "white", 3),
  sizes: "Tables: 14-pixel words, cells 12 by 16 pixels, headings 11-pixel capitals over a bone 200 line, bone 200 row lines, corners 14, the level 1 shadow, at least 680 (Places), 720 (Boxes) or 640 (Events) pixels wide inside a box that scrolls sideways, so the page never does; the Box and Event name columns at least 240. Column headings, dates (Last verified, Last report, Starts), times and tags stay on one line. A row tints only if it links somewhere, and a click anywhere on it opens its link; the link stays the keyboard path. The Places status key is a flat white box with a hairline (no shadow, on purpose); the Places chips sit in three rows, status, source and lane, each wrapping on its own, with no divider. Chips are 14-pixel words, 48 tall, fully round. Tags 12 pixels, fully round, on one line. The Sponsor slider and the three-dot button (48 by 48) are 48 tall; the menu's choices are 48 tall. The Events Edit link sits in its cell as an inline link with the ring.",
  wording: [
    "Filters show their count: To review (12), Low (1). Statuses are one or two words, explained once in the Places key. The Sponsor slider says Any, Has one, Needs one.",
    "Last report reads Today, 1 day ago, 6 days ago, or No reports yet. A box with no sponsor says Needs a sponsor.",
    "Nothing found: No places match your search or filters. No boxes match these filters. Each with Clear filters. Nothing yet: No places yet. No blessing boxes yet. No events yet.",
  ],
  everyone: [
    "Keyboard: filters, then search, then each row's link. Chips say whether they're pressed; one with nothing in it is skipped. The three-dot menu opens with Enter, Space or the down arrow; the arrows move; Escape closes it.",
    "Screen reader: real tables with column headings; Showing 5 of 5 boxes is announced as filters change; the three-dot button is named after the item it belongs to; Clear filters puts the cursor back in the search box.",
    "Touch: chips, the slider and the three-dot button are 48 pixels. On a phone the wide tables scroll sideways inside their own box.",
    "Color is never the only sign: every status is a word; the category is its name in words.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%"><div class="pa-esub"><div class="top"><p class="pa-name" style="padding-top:12px">Community Soup Night</p>${dotsMenu("Community Soup Night")}</div></div></div>`, "One three-dot menu per item, the risky choice last."],
    [`<div class="pa" style="width:100%"><div class="pa-esub"><p class="pa-name">Community Soup Night</p><div class="pa-btns" style="margin-top:12px"><button type="button" class="pa-bp big">Make it a draft event</button><button type="button" class="pa-bs">Edit</button><button type="button" class="pa-bs">Dismiss</button><button type="button" class="pa-bs">Email sender</button></div></div></div>`, "A row of buttons on every item. A long list becomes a wall of buttons (made-up example)."],
  ),
  code: [
    "src/components/VenueListView.tsx (chipClass, the table strings, CategoryLabel in the Category column, emptyStateClass with Clear filters)",
    "src/components/AllBoxesTable.tsx (chipClass, AdminSegmented for Sponsor, tagClass: Low is the caution tone)",
    "src/components/EventsList.tsx",
    "src/components/EventSubmissionsList.tsx (AdminRowMenu per item)",
    "src/lib/adminCardStyles.ts (tableWrapClass, tableHeadRowClass, tableRowClass, tableLinkRowClass, tagClass, chipClass, emptyStateClass); src/components/AdminRowMenu.tsx; src/components/AdminSegmented.tsx",
    "src/lib/adminVenues.ts (DISPLAY_STATUS_LABELS, DISPLAY_STATUS_KEY)",
  ],
});

// ── Dashboard numbers (DashboardNeedsStrip, KpiCard, DailyBars, BarList, BoxReportsChart) ────────────────────
const need = (label: string, n: number, detail = "", cls = "") => `<a class="pa-need pa-ring${cls ? ` ${cls}` : ""}" href="#admin-dash"><span class="l">${label}</span><span class="n${n === 0 ? " zero" : ""}">${n}</span>${detail ? `<span class="x">${detail}</span>` : ""}</a>`;
const needsStrip = `<div class="pa-needs">${need("Places to review", 14, "3 from the public, 11 from data refresh")}${need("Waiting to publish", 5)}${need("Box photos &amp; sponsor requests", 3, "2 photos, 1 sponsor requests")}${need("Boxes empty or low", 0)}</div>`;
const spark = (pts: number[]) => { const w = 64, h = 20, mx = Math.max(...pts), mn = Math.min(...pts), rg = mx - mn || 1, st = w / (pts.length - 1); return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts.map((p, i) => `${i * st},${h - ((p - mn) / rg) * h}`).join(" ")}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`; };
const kpi = (label: string, val: string, d?: [string, "up" | "down" | "flat"], about = false, sp?: number[]) => `<div class="pa-kpi"><p class="l">${label}</p><div class="v"><p class="n">${about ? '<span class="ab">about</span> ' : ""}${val}</p>${d ? `<span class="d ${d[1]}">${d[0]}</span>` : ""}</div>${sp ? spark(sp) : ""}</div>`;
const DAILY = [12, 18, 15, 22, 9, 7, 25, 31, 28, 19, 14, 16, 20, 33, 27, 24, 18, 11, 10, 21, 26, 29, 35, 30, 22, 17, 15, 19, 28, 32];
const daily = `<svg class="pa-daily" viewBox="0 0 300 60" role="img" aria-label="Visitors per day, Oct 9 to Nov 7">${DAILY.map((v, i) => { const s = 300 / DAILY.length, bh = (v / 35) * 60; return `<rect x="${(i * s).toFixed(1)}" y="${(60 - bh).toFixed(1)}" width="${(s * 0.8).toFixed(1)}" height="${bh.toFixed(1)}" fill="currentColor"><title>Day ${i + 1}: ${v}</title></rect>`; }).join("")}</svg>`;
const bars = (items: [string, number, string][], links = false) => { const mx = Math.max(...items.map((i) => i[1])); return `<ul class="pa-bars">${items.map(([l, v, d]) => `<li>${links ? `<a class="lb pa-ring" href="#admin-dash" title="${l}">${l}</a>` : `<span class="lb" title="${l}">${l}</span>`}<span class="tr"><i style="width:${Math.max((v / mx) * 100, 4)}%"></i></span><span class="vl">${d}</span></li>`).join("")}</ul>`; };
const WEEKS: [string, number, number][] = [["Sep 14", 18, 2], ["Sep 21", 22, 1], ["Sep 28", 15, 4], ["Oct 5", 25, 0], ["Oct 12", 20, 3], ["Oct 19", 27, 2], ["Oct 26", 19, 5], ["Nov 2", 24, 1]];
const weeks = `<div class="pa-weeks">${WEEKS.map(([w, ok, tr]) => `<div><div class="bar" style="height:${((ok + tr) / 29) * 100}%" role="img" aria-label="Week of ${w}: ${ok} OK, ${tr} needing attention">${tr ? `<i class="tb" style="flex-grow:${tr}"></i>` : ""}<i class="ob" style="flex-grow:${ok}"></i></div><span>${w}</span></div>`).join("")}</div>
  <div class="pa-legend"><span><i style="background:var(--color-sage-500)"></i>OK</span><span><i style="background:var(--color-clay-500)"></i>Needs attention</span></div>`;
const period = (on = 1, cls: string[] = []) => seg("Time period", ["7 days", "30 days", "90 days"], on, cls);

const dashEntry = entry({
  id: "admin-dash", name: "Dashboard numbers (DashboardNeedsStrip, KpiCard, DailyBars, BarList, BoxReportsChart)", status: "built",
  statusNote: "Live as is (#926), with made-up figures. The Needs you cards take the light green tint under the pointer and the green keyboard ring; a number card's change wraps under the number on a phone instead of running past the edge; the time period (7, 30, 90 days) is a slider, still kept in the page address.",
  purpose: "The Dashboard's numbers: under the greeting, the period slider, then the four Needs you cards (what's waiting on a person, each one a way into that list), then plain number cards with the change since the last period, and small charts: visitors per day and ranked bars (where people came from, which places were opened, what they searched). Blessing box reports per week sit on the Blessing Boxes page.",
  instead: [
    "It's one thing to act on: use a change card or a list, not a number.",
    "It needs exact rows: use a table; these charts only show the shape.",
  ],
  versions:
    wide("The period slider under the greeting (DashboardPeriodPicker). Pick one: on the site the page reloads its numbers for that period and the address keeps it (?period=7d).", `<h2 class="wm" style="font-size:20px;line-height:28px;margin-bottom:12px">Hi dana</h2>${period()}`) +
    wide("Needs you (DashboardNeedsStrip): one column on a phone, two from 640 pixels, four from 1024. Each card is a link. Point at one.", needsStrip) +
    wide("Number cards (KpiCard), two across on a phone, four from 640. about marks a sampled number; the change is green when up, red when down; new when there was nothing before. On a narrow card the change drops under the number.", `<div class="pa-kgrid">${kpi("Visitors", "214", ["+12.5%", "up"], true)}${kpi("Page views", "12655", ["-3.1%", "down"], true)}${kpi("Near me taps", "96", ["new", "up"], false, [2, 5, 4, 8, 7, 11, 9])}${kpi("On a phone", "81%", undefined, true)}</div>`) +
    wide("Visitors per day (DailyBars), inside its section card: a section title (Fraunces 18) and a group heading (Public Sans 14 semi-bold)", `<section class="pa-sec"><h3 class="wm">Visitors</h3><div style="margin-top:12px"><h4 class="pa-gt">Visitors per day</h4>${daily}</div></section>`) +
    mid("Ranked bars (BarList). Plain names, or links to a place's edit page with the green ring.", `<h4 class="pa-gt">How people found the site</h4>${bars([["Google", 58, "58 visits"], ["Facebook", 21, "21 visits"], ["Direct", 17, "17 visits"], ["pueblo-example.org", 6, "6 visits"]])}<h4 class="pa-gt" style="margin-top:16px">Most opened places</h4>${bars([["Eastside Community Pantry", 41, "41 opens"], ["Mesa Street Community Garden", 23, "23 opens"]], true)}`) +
    mid("Box reports per week (BoxReportsChart), on the Blessing Boxes page: OK in green, needs attention in clay, 8 weeks", weeks),
  states:
    demo("Needs you card: resting", need("Waiting to publish", 5)) +
    demo("Pointer over it: sage 100", need("Waiting to publish", 5, "", "is-hover")) +
    demo("Reached by keyboard: the green ring", need("Waiting to publish", 5, "", "is-focus")) +
    demo("Nothing waiting: the number turns ink 500", need("Boxes empty or low", 0)) +
    demo("Period slider: resting, pointer over 7 days, keyboard", `<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">${period()}${period(1, ["is-hover"])}${period(1, ["", "is-focus"])}</div>`) +
    demo("Change since last period: up, down, new, no comparison", `<div style="display:flex;gap:16px;font-size:12px;font-weight:500"><span style="color:var(--color-sage-700)">+12.5%</span><span style="color:var(--color-danger)">-3.1%</span><span style="color:var(--color-sage-700)">new</span><span style="color:var(--color-ink-500);font-weight:400">—</span></div>`) +
    demo("No data yet", `<p style="color:var(--color-ink-500);margin:0">No visitor data yet for this period.</p>`),
  colors:
    swr("Ink 500", "color-ink-500", "Card labels in small capitals, about, the breakdown line, a zero, chart legends") +
    swr("Ink 900", "color-ink-900", "The numbers") +
    swr("Sage 700", "color-sage-700", "Up and new; place-name links") +
    swr("Danger red", "color-danger", "Down") +
    swr("Sage 500", "color-sage-500", "Sparkline, daily bars, OK in the weekly chart, keyboard rings", "white", 3) +
    swr("Clay 500", "color-clay-500", "Needs attention in the weekly chart", "white", 3) +
    sw("Sage 600", "color-sage-600", `Ranked bars, on a bone 100 track: ${r("color-sage-600", "color-bone-100", 3)} (edge). Also the period you picked, bone 50 words ${r("color-bone-50", "color-sage-600")}`) +
    sw("Bone 200", "color-bone-200", `The period slider's track, ink 700 words ${r("color-ink-700", "color-bone-200")}`) +
    swr("Ink 400", "color-ink-400", "Week labels, 10 pixels") +
    sw("Sage 100", "color-sage-100", `Fill under the pointer on a Needs you card and a period. Ink 900 numbers ${r("color-ink-900", "color-sage-100")}, ink 500 labels ${r("color-ink-500", "color-sage-100")}`),
  sizes: "Tiles: corners 14, 16 pixels of padding at every width (section cards 24 from 640 wide), the card shadow, 12 pixels apart; a Needs you card is at least 48 tall. Labels 12-pixel capitals; numbers 24 pixels semi-bold; changes 12. The page title (the greeting) is Fraunces 20, section titles Fraunces 18, group headings Public Sans 14 semi-bold. The period slider is 48 tall. Sparkline 64 by 20. Daily bars 64 pixels tall, full width. Ranked bars: names 112 pixels wide (cut with … when long), an 8-pixel track, values in a 64-pixel column. Weekly chart 128 pixels tall, week labels 10 pixels.",
  wording: [
    "Labels name the thing in plain words: Places to review, Waiting to publish, Boxes empty or low, Near me taps, Phone page load.",
    "Sampled numbers say about. Changes are a percent with a sign, or new. Missing numbers show —.",
    "Periods: 7 days, 30 days, 90 days. Empty charts say why: No visitor data yet for this period. No box reports in the last 8 weeks.",
  ],
  everyone: [
    "Keyboard: each Needs you card is one link with the green ring. The period slider is three real radios: the arrow keys move between them.",
    "Screen reader: the slider is a group called Time period; the daily chart is one picture with a summary (Visitors per day, Oct 9 to Nov 7); each week's bar says its counts (Week of Oct 26: 19 OK, 5 needing attention). The sparkline is hidden: the number says it all.",
    "Touch: every Needs you card and the slider are at least 48 pixels tall.",
    "Color is never the only sign: up and down carry a + or -; the weekly chart has a legend in words.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%">${kpi("Visitors", "214", ["+12.5%", "up"], true)}</div>`, "The number big, the change small beside it, and about when it's sampled."],
    [`<div class="pa" style="width:100%"><div class="pa-kpi"><p class="l">Visitors</p><div class="v"><p class="n" style="color:var(--color-sage-700)">214</p></div></div></div>`, "Coloring the number itself to say good or bad, with no sign. Color alone doesn't tell anyone it went up (made-up example)."],
  ),
  code: [
    "src/components/DashboardNeedsStrip.tsx (tileCardClass, the sage 100 hover, focusRingClass)",
    "src/components/KpiCard.tsx (tileCardClass, tileLabelClass; the number row wraps)",
    "src/components/DashboardPeriodPicker.tsx (the period slider, AdminSegmented; keeps the other address values)",
    "src/components/DailyBars.tsx, BarList.tsx; src/components/BoxReportsChart.tsx (on admin/boxes/page.tsx)",
    "src/app/(site)/admin/page.tsx (labels and layout)",
  ],
});

// ── On-page confirm (AdminConfirm) ────────────────────────────────────────────────────────────────────────────
const removeConfirm = (o: { busy?: boolean; err?: boolean; live?: boolean } = {}) => confirmBox({ title: "Remove Eastside Community Pantry from the map?", body: "It will stop appearing on the next publish. Its record is kept, not deleted, and this can be reviewed later.", action: "Remove from map", tone: "danger", busy: o.busy ? "Removing…" : undefined, err: o.err ? "The place was not removed. Try again." : undefined, live: o.live });
const removeBtn = (cls = "") => `<button type="button" class="pa-bd pa-ring${cls ? ` ${cls}` : ""}">Remove from map</button>`;
const dangerZone = (inner: string) => `<div class="pa-danger"><h3 class="wm">Danger zone</h3>${inner}</div>`;
const eventDanger = (live = false) => dangerZone(`<div style="display:flex;flex-direction:column;gap:12px;align-items:stretch"><div><button type="button" class="pa-bd pa-ring"${live ? say("Mockup: this would open the cancellation note.") : ""}>Cancel event</button></div>${confirmLive(`<button type="button" class="pa-bd pa-ring">Archive event</button>`, confirmBox({ title: "Archive this event?", body: "It leaves the map and the list of live events, and stays in the admin history.", action: "Archive event", tone: "danger", live }))}</div>`);
const flyerConfirm = () => `<div style="display:flex;flex-direction:column;gap:12px"><div class="pa-esub" style="padding:8px;max-width:180px"><div class="fly" style="height:120px">Flyer</div></div><div><button type="button" class="pa-bs pa-ring">Replace image</button></div>${confirmLive(`<button type="button" class="pa-bd pa-ring">Remove</button>`, confirmBox({ title: "Remove this flyer?", body: "The event stays. Only the picture is removed.", action: "Remove flyer", tone: "danger", live: true }))}</div>`;

const confirmEntry = entry({
  id: "admin-confirm", name: "On-page confirm (AdminConfirm)", status: "built",
  statusNote: "Live as is (#926). Every risky admin action asks in a box on the page, right where its button was, Cancel first (owner's ruling: say what will happen, safe button first; never the browser's pop-up). The admin has no browser pop-up left.",
  purpose: "Asks before an admin action that changes what the public sees or can't easily be undone. The first press hides the button and opens the box in its place: the question names the thing, one line says what happens and what doesn't, then Cancel first and the action. Nothing is sent until the action button is pressed. Six places use it: Remove from map, Archive this venue, Publish, Approve all date-only updates, Archive event and Remove this flyer.",
  instead: [
    "It needs a reason typed (Reject, Remove photo, Decline): the reason step on the change card, which opens in place the same way, Cancel first.",
    "It's easy to undo (Hide a check-in, Remove a host email): it acts at once.",
    "It's on the public site: the photo report there still uses the browser's pop-up (DESIGN.md Known drift).",
  ],
  versions:
    mid("Remove from map, alone under Danger zone at the foot of a place's edit page. Tap it: the box opens on the page, Cancel first.", dangerZone(confirmLive(removeBtn(), removeConfirm({ live: true })))) +
    mid("Archive event and Cancel event sit apart under Danger zone on an event's edit page. Tap Archive event. (Cancel event opens a step instead: the cancellation note, then Keep event first and the red Confirm cancel event.)", eventDanger(true)) +
    mid("Remove this flyer, under an event's flyer. Tap Remove.", flyerConfirm()) +
    mid("Publish and Approve all use the green version (see Publish bar and Admin cards). Open:", pubConfirm()),
  states:
    demo("Remove from map: resting, pointer over it (fills red), keyboard (a red ring)", `<div class="pa-btns">${removeBtn()}${removeBtn("is-hover")}${removeBtn("is-focus")}</div>`) +
    mid("Open: the keyboard starts on Cancel", removeConfirm()) +
    mid("Working: Removing…, both buttons faded, Escape does nothing", removeConfirm({ busy: true })) +
    mid("Failed: what did not happen, in red under the buttons", removeConfirm({ err: true })) +
    demo("Already off the map: a plain line, no button and no Danger zone heading", `<p style="color:var(--color-ink-500);margin:0">This place is removed from the map.</p>`),
  colors:
    swr("Danger red", "color-danger", "The red box's edge, the red action's words and edge, errors") +
    sw("Danger red fill", "color-danger", `A red action under the pointer. Bone 50 words on it ${r("color-bone-50", "color-danger")}`) +
    swr("Sage 500", "color-sage-500", "The green box's edge", "white", 3) +
    sw("Sage 600", "color-sage-600", `The green action (Publish, Approve). Bone 50 words ${r("color-bone-50", "color-sage-600")}`) +
    swr("Ink 900", "color-ink-900", "The question") +
    swr("Ink 700", "color-ink-700", "What happens, and Cancel") +
    sw("Bone 300", "color-bone-300", `Cancel's edge, decoration (${contrast(H("color-bone-300"), H("white")).toFixed(1)} to 1): its word carries it`),
  sizes: "The box: white, a 1-pixel edge, corners 10, 16 pixels of padding, 8 between its parts. The question 16 pixels medium; the line under it 14. Cancel and the action are both 48 pixels tall with 14-pixel words: stacked full width on a phone, Cancel on top (at half a phone's width Remove from map wrapped), half the row each from 640 wide. Danger zone: a bone 200 line, 24 pixels above its title (Fraunces 18), 12 below.",
  wording: [
    "The question names the thing: Remove Eastside Community Pantry from the map? Archive Southside Food Shelf? Archive this event? Remove this flyer? Publish 2 new places and 5 edited places to the public map? Approve all 6 date-only updates?",
    "The line says exactly what happens and what doesn't: it stops appearing on the next publish; the record is kept, not deleted. The event stays. Only the picture is removed.",
    "The action button names the action, never Yes or OK: Remove from map, Archive this venue, Archive event, Remove flyer, Publish, Approve 6 updates. Working: Removing…, Archiving…, Publishing…, Approving….",
    "On a place's page the red button says what it does to the public: Remove from map, never Archive or Delete. A failure says what did not happen: The place was not removed. Try again.",
  ],
  everyone: [
    "Keyboard: the box opens with the keyboard on Cancel, so Enter right away never removes anything; Escape closes it (unless it's working) and Cancel returns the keyboard to the button that opened it. Both buttons are plain buttons, so Enter in a form never presses them by accident.",
    "Screen reader: the box is a labelled group read from its question; errors are read out at once.",
    "Touch: both buttons are 48 pixels; full width on a phone, side by side from 640 wide.",
    "Color is never the only sign: the action says what it does in words; red and green only back it up.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%">${removeConfirm()}</div>`, "Name the place and say what happens; the safe button first."],
    [`<div class="pa" style="width:100%"><div class="pa-confirm"><p class="t">Are you sure?</p><div class="two"><button type="button" class="pa-bd">Yes</button><button type="button" class="pa-bs">No</button></div></div></div>`, "Are you sure? Yes / No. Nobody knows what Yes does, and the risky button comes first (made-up example)."],
  ),
  code: [
    "src/components/AdminConfirm.tsx (AdminConfirm, useAdminConfirm; useAdminStep for the reason steps)",
    "src/components/ArchiveVenueButton.tsx and the Danger zone of src/app/(site)/admin/venues/[id]/edit/page.tsx",
    "Also used in ProposalCard.tsx (Archive this venue), PublishPanel.tsx, ToReviewSummaryBox.tsx, EventForm.tsx (Archive event) and EventFlyerField.tsx (Remove this flyer)",
  ],
});

const all: [string, string, string][] = [
  ["admin-nav", "Admin menu", adminNavEntry],
  ["admin-login", "Sign-in", loginEntry],
  ["admin-cards", "Cards and boxes", cardsEntry],
  ["admin-publish", "Publish bar", publishEntry],
  ["admin-change", "Change cards", changeEntry],
  ["admin-forms", "Form fields", formsEntry],
  ["admin-lists", "Lists and tables", listsEntry],
  ["admin-dash", "Dashboard numbers", dashEntry],
  ["admin-confirm", "On-page confirm", confirmEntry],
];

export const pages: Page[] = [{
  slug: "components-admin", route: "DESIGN.md → Components (admin)", title: "Design system: Components, admin", area: "Design system", nav: "Components",
  blurb: "The admin's pieces as built: menu, sign-in, cards, publish bar, change cards, form fields, lists, dashboard numbers and the on-page confirm.",
  changed: [
    "Everything here is now built on the admin (#926), drawn from one set of shared parts so the pages can't drift apart.",
    "The light green tint (sage 100) under the pointer everywhere a grey was: menu tabs, Use a passkey, Reject and Cancel, rows, filter chips, the Needs you cards.",
    "One button height, 48 pixels, and 48-pixel text boxes, tick box rows, chips and links. The green keyboard ring on everything you can reach.",
    "Cancel beside Save on every form. Every risky action asks in a box on the page, Cancel first: Remove from map, Archive this venue, Publish, Approve all, Archive event, Remove this flyer.",
    "One three-dot menu per event sent in by the public; sliders for the Dashboard period, SNAP and WIC, an event's place, the Boxes Sponsor filter and a host email's language.",
    "Every page has a title at one size, section titles one size smaller. Errors say what did not happen and what to do, with no long dashes; a page that fails to load shows the admin error page.",
  ],
  kept: ["Only staff see these pages, after signing in.", "The admin is English only.", "The phone view is 360 pixels wide.", "Every person, place and number is made up."],
  check: [
    "Points decided in the build for you to see, and overrule if you want: 1. Cancel comes before the red button in every Reject, Remove photo and Decline step.",
    "2. Publish, Approve all, Archive this venue, Archive event and Remove this flyer ask on the page like Remove from map; Publish and Approve all keep a green button, the removals red.",
    "3. Every button is 48 pixels tall: one height, not two.",
    "4. The Places table's Category column uses the colored category words, as on the public card.",
    "5. Text box edges are darker (ink 400 in place of bone 300), on the admin only.",
    "6. The Low tag on Blessing Boxes is dark words on yellow, like Draft.",
    "7. Every admin tag is fully round.",
    "8. The event form says Cancel in place of Back to events, and Add place has Cancel too.",
    "9. Add place, the one orange button, has no pointer change and the green keyboard ring in place of the orange one.",
    "Places rows: with the green tint under the pointer, the Live tag's own sage 100 fill disappears into the row; its words still read (7.5 to 1).",
  ],
  html: `<div class="head"><h1>Components, admin</h1></div>
  ${toc([["components.html", "← Components"], ...all.map(([id, n]) => [`#${id}`, n] as [string, string])])}
  ${all.map(([, , h]) => h).join("")}`,
}];
