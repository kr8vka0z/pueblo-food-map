// Design system: Components, admin. The staff-only admin pieces (signed in with Better Auth), in the same entry
// layout Kyle approved on the main Components page (pages/03-components.ts): status tag; what it's for and when to
// use something else; versions as working pieces; states as stills that also react to a real pointer and Tab;
// shared colors (with contrast ratios) and sizes; wording; works for everyone; one live Do and one live Don't; the
// code file. Replicas copy the real classes, words and sizes from src/components/ (CSS in mock.css, block
// "admin", classes prefixed pa-). Every person, email, place and number here is made up.
import { contrast, dodont, hex, ratio, STATUS, sw, toc, type Page, type Status, type Token } from "../lib";

function entry(o: {
  id: string; name: string; status: Status; statusNote?: string; purpose: string; instead: string[];
  versions: string; states: string; colors: string; sizes: string; wording: string[]; everyone: string[];
  dd: string; code: string[]; extra?: string;
}) {
  return `<section class="ds" id="${o.id}">
  <div class="dsh"><h2>${o.name}</h2><span class="st ${o.status}">${STATUS[o.status]}</span></div>
  ${o.statusNote ? `<p class="dsnote">${o.statusNote}</p>` : ""}
  <p class="dsp">${o.purpose}</p>
  <h3>Use something else when</h3><ul>${o.instead.map((i) => `<li>${i}</li>`).join("")}</ul>
  <h3>Versions</h3><div class="dsrow">${o.versions}</div>${o.extra ?? ""}
  <h3>States</h3><div class="dsrow">${o.states}</div>
  <h3>Shared colors and sizes</h3><ul class="sws">${o.colors}</ul><p class="dssz">${o.sizes}</p>
  <h3>Wording</h3><ul>${o.wording.map((i) => `<li>${i}</li>`).join("")}</ul>
  <h3>Works for everyone</h3><ul>${o.everyone.map((i) => `<li>${i}</li>`).join("")}</ul>
  <h3>Do and don't</h3>${o.dd}
  <h3>Lives in</h3><ul class="dscode">${o.code.map((c) => `<li><code>${c}</code></li>`).join("")}</ul>
</section>`;
}

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
const newTag = `<span class="pa-tagnew">Not built yet</span>`;
let uid = 0; // unique ids for label/box pairs

// Made-up people, places and addresses. 555-01xx numbers are reserved for fiction; example.com and example.org
// are reserved for examples.
const ADMIN = "dana@example.org";

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
  id: "admin-nav", name: "Admin menu (AdminNav)", status: "changing",
  statusNote: "What changes: the pointer-over fill on a menu item becomes a light green tint (sage 100) in place of the grey (bone 200). Everything else is the menu as it is live today.",
  purpose: "The top of every admin page except sign-in: the title, who is signed in, and one row of tabs (Dashboard, Blessing Boxes, Places, Events) with a small count of things waiting on each. Add place sits at the end of the row. The owner's account also sees Activity.",
  instead: [
    "It's a step inside one page (a filter, a sort, a time period): it goes on that page, not in the menu.",
    "It's a queue that belongs to a tab (photos, sponsor requests, data changes): it shows as that tab's count and its To review filter, not as a new tab. That is how Photo review, Sponsor requests and Data refresh were folded in.",
    "It's a second main action: there is only one orange button in the admin, Add place. Anything else uses the green button inside its page.",
  ],
  versions:
    wide("At this width the title and signed-in line share a row; on a phone (try the Phone view) they stack and the tabs wrap onto two lines. Tap any tab or Add place. Point at a tab to see the proposed green tint.", adminNav({ live: true, active: "Places" })) +
    wide("The owner's account: Activity appears at the end. Every other account never gets it in its page at all.", adminNav({ owner: true, active: "Dashboard" })) +
    wide("While the next page loads: the same title and tabs, no email, no counts, nothing lit, so nothing jumps when the real menu arrives.", adminNav({ skeleton: true })),
  states:
    demo("Resting", navCell("Places", 12, false)) +
    demo("Pointer over it: light green tint (proposed). Point at it to see it. Live today: a grey fill, bone 200.", navCell("Places", 12, false, "is-hover")) +
    demo("Live today, for comparison: the grey fill", navCell("Places", 12, false, "is-livehover")) +
    demo("Reached by keyboard: a green ring with a white gap", navCell("Places", 12, false, "is-focus")) +
    demo("The page you're on: green fill, light words", navCell("Places", 12, true)) +
    demo("Add place: resting, pointer over it (fades to 90%), keyboard (an orange ring)", `<div style="display:flex;gap:12px;flex-wrap:wrap;background:#fff;padding:8px;border-radius:10px"><a class="pa-add" href="#admin-nav">Add place</a><a class="pa-add is-hover" href="#admin-nav">Add place</a><a class="pa-add is-focus" href="#admin-nav">Add place</a></div>`),
  colors:
    sw("White", "white", "The menu's background, with a bone 200 line under it") +
    swr("Ink 900", "color-ink-900", "The title, in Fraunces") +
    swr("Ink 500", "color-ink-500", "Tab words at rest, and the Signed in as line") +
    swr("Sage 700", "color-sage-700", "The signed-in email") +
    sw("Sage 600", "color-sage-600", `The page you're on. Bone 50 words on it ${r("color-bone-50", "color-sage-600")}`) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer (proposed; live is bone 200). Ink 500 words on it ${r("color-ink-500", "color-sage-100")}; live, on bone 200, ${r("color-ink-500", "color-bone-200")}`) +
    sw("Clay 100", "color-clay-100", `The count pill. Clay 700 numbers on it ${r("color-clay-700", "color-clay-100")}`) +
    sw("Orange", "color-brand-orange", `Add place, the admin's one orange button (owner-approved, DESIGN.md). Navy words on it ${r("color-brand-navy", "color-brand-orange")}. Its keyboard ring is orange too: ${r("color-brand-orange", "white", 3)} on white (edge), under the 3 to 1 an edge needs`) +
    swr("Sage 500", "color-sage-500", "Keyboard ring on the tabs", "white", 3),
  sizes: "Title 24 pixels in Fraunces. Every tab and Add place is 48 pixels tall; tabs are 12 pixels in from each side, 4 pixels apart, corners 10 pixels. Words 14 pixels, medium weight (Add place bold). The count pill is 16 pixels tall and at least 18 wide. 16 pixels of padding on a phone, 32 from 640 pixels wide, where the title and the signed-in line share one row.",
  wording: [
    "Tabs are one or two words, the same on every page: Dashboard, Blessing Boxes, Places, Events, Activity. The admin is English only.",
    "A count shows only when something is waiting; no pill means nothing to do. Blessing Boxes counts photos plus sponsor requests; Places counts data changes plus public suggestions.",
    "Signed in as, then the full email. The main action says what it makes: Add place.",
  ],
  everyone: [
    "Keyboard: every tab is a real link; Tab moves along the row, Enter opens it. Each shows the green ring.",
    "Screen reader: the row is a navigation landmark called Admin; the page you're on is announced as the current page, not only by its fill.",
    "Touch: every tab and Add place is 48 pixels tall. The row wraps rather than scrolling sideways on a 360-pixel phone.",
    "Color is never the only sign: the current page also says so to screen readers, and a count is a number, not a dot.",
  ],
  dd: dodont(
    [`<div class="pa pa-cq" style="width:100%">${adminNav({ active: "Places" })}</div>`, "One orange button, at the end of the row. The tabs carry counts, not more buttons."],
    [`<div class="pa pa-cq" style="width:100%"><header class="pa-head"><nav aria-label="Don't example" style="padding-top:12px">${navLink("Places", 12, true)}<a class="pa-add" href="#admin-nav">Publish</a><a class="pa-add" href="#admin-nav">Add place</a><a class="pa-add" href="#admin-nav">Add event</a></nav></header></div>`, "Several orange buttons in the menu. Orange is the one main action, so three of them means none stands out."],
  ),
  code: [
    "src/components/AdminNav.tsx (AdminNav and AdminNavSkeleton). Proposed change: navLinkInactive's hover:bg-[var(--color-bone-200)] becomes sage 100",
    "Known live issue: primaryButtonClass (Add place) uses focus-visible:ring-[var(--color-brand-orange)], 2.3 to 1 on the white menu, under the 3 to 1 a keyboard ring needs",
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
  ${o.failed ? `<p class="pa-err" role="alert">Something went wrong sending the code. Try again.</p>` : ""}
  <div class="pa-or"><span></span>or<span></span></div>
  <button type="button" class="pa-bline"${o.passkeyBusy ? " disabled" : ""}${o.live ? say("Mockup: your device would ask for your fingerprint, face or PIN.") : ""}>${o.passkeyBusy ? "Waiting for passkey…" : "Use a passkey"}</button>
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
  <a class="pa-tl" href="#admin-login" style="display:block;margin-top:16px;min-height:0;text-align:center">Continue to admin without a passkey</a></div>`;

const loginEntry = entry({
  id: "admin-login", name: "Sign-in (AdminLoginForm)", status: "changing",
  statusNote: "What changes: the pointer-over fill on Use a passkey becomes sage 100 in place of sage 50 (round 2 showed sage 50 reads as grey). Everything else is sign-in as it is live today.",
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
    demo("Email box: resting", `<div style="width:100%"><input class="pa-in" type="email" placeholder="you@example.com" aria-label="Email, resting"></div>`) +
    demo("Email box: reached by keyboard, a green edge and ring", `<div style="width:100%"><input class="pa-in is-focus" type="email" value="${ADMIN}" aria-label="Email, keyboard"></div>`) +
    demo("Email box: not an email. The edge turns red and the line under it says what to fix.", `<div style="width:100%"><input class="pa-in bad" type="email" value="dana.example" aria-label="Email, error" aria-invalid="true"><p class="pa-err">Enter a valid email address.</p></div>`) +
    demo("Email me a code: resting, pointer over it (sage 700), keyboard", `<div style="display:flex;flex-direction:column;gap:12px;width:100%"><button type="button" class="pa-bfull pa-ring">Email me a code</button><button type="button" class="pa-bfull pa-ring is-hover">Email me a code</button><button type="button" class="pa-bfull pa-ring is-focus">Email me a code</button></div>`) +
    demo("Working: Sending…, faded and can't be pressed twice", `<div style="width:100%"><button type="button" class="pa-bfull" disabled>Sending…</button></div>`) +
    demo("Use a passkey: resting, pointer over it (sage 100, proposed; point at it), live today (sage 50), keyboard", `<div style="display:flex;flex-direction:column;gap:12px;width:100%"><button type="button" class="pa-bline">Use a passkey</button><button type="button" class="pa-bline is-hover">Use a passkey</button><button type="button" class="pa-bline is-livehover">Use a passkey</button><button type="button" class="pa-bline is-focus">Use a passkey</button></div>`) +
    demo("Wrong code: red edge and the reason", `<div style="width:100%"><input class="pa-in code bad" value="401872" aria-label="Code, error" aria-invalid="true"><p class="pa-err">That code didn't match. Try again.</p></div>`) +
    demo("Resend code: waiting out its 30 seconds (faded, no underline), then ready", `<div style="display:flex;flex-direction:column;align-items:flex-start;width:100%"><button type="button" class="pa-tl" disabled>Resend code (24s)</button><button type="button" class="pa-tl">Resend code</button></div>`),
  colors:
    sw("Bone 50", "color-bone-50", "The page behind the sign-in card") +
    sw("White", "white", "The card and the boxes") +
    swr("Ink 900", "color-ink-900", "The title and what you type") +
    swr("Ink 700", "color-ink-700", "Labels and the We sent a code line") +
    swr("Ink 400", "color-ink-400", "The example in an empty box, and the word or") +
    sw("Bone 300", "color-bone-300", `The edge of each box. ${r("color-bone-300", "white", 3)} on white (edge): under 3 to 1, and a box's edge is the only thing that shows where it is`) +
    swr("Sage 500", "color-sage-500", "The box edge and ring while you type in it; the Use a passkey edge", "white", 3) +
    sw("Sage 600", "color-sage-600", `Email me a code and Sign in. Bone 50 words on it ${r("color-bone-50", "color-sage-600")}; with the pointer over it sage 700, ${r("color-bone-50", "color-sage-700")}. Sage 600 is also the Use a passkey words, ${r("color-sage-600", "white")} on white`) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer on Use a passkey (proposed; live is sage 50). Sage 600 words on it ${r("color-sage-600", "color-sage-100")}; on sage 50 ${r("color-sage-600", "color-sage-50")}`) +
    swr("Sage 700", "color-sage-700", "Resend code, Use a different email, the email on the passkey offer") +
    swr("Danger red", "color-danger", "What went wrong, and a box's edge when it's wrong"),
  sizes: "The card is at most 384 pixels wide, 32 pixels of padding (48 from 640 wide), corners 14, 32 pixels under the title. Boxes: 16-pixel words on a phone so the phone doesn't zoom in (14 from 768 wide), 8 by 12 pixels of padding, corners 10, about 42 pixels tall. Email me a code, Sign in and Use a passkey are full width and 48 pixels tall; Resend code and Use a different email are 48 tall too. Error lines are 12 pixels, 4 below their box.",
  wording: [
    "Each step says what happens next in plain words: Email me a code, then We sent a 6-digit code to dana@example.org. It expires in 10 minutes.",
    "Errors say what to do: Enter a valid email address. That code didn't match. Try again. That code expired. Send a new one. Too many tries. Wait a few minutes and try again.",
    "A button that's working says so: Sending…, Signing in…, Waiting for passkey…, Setting up….",
    "Never say whether an email is an admin's. The next step looks the same for every address.",
  ],
  everyone: [
    "Keyboard: the cursor starts in the code box on step 2. Enter sends either step.",
    "Screen reader: each box has a real label; a wrong value is marked invalid and its reason is read out right away. The We sent a code line is announced when it appears.",
    "Touch: every button is 48 pixels tall. The code box opens the number pad and offers the code from a text message or email. The email box offers saved passkeys.",
    "Color is never the only sign: a red edge always comes with a written reason.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%"><input class="pa-in bad" value="dana.example" aria-label="Do example" aria-invalid="true"><p class="pa-err">Enter a valid email address.</p></div>`, "Say what to fix, under the box."],
    [`<div class="pa" style="width:100%"><input class="pa-in bad" value="dana.example" aria-label="Don't example" aria-invalid="true"><p class="pa-err">Invalid input.</p></div>`, "A vague error. Nobody knows what to change."],
  ),
  code: [
    "src/components/AdminLoginForm.tsx. Proposed change: secondaryButtonClass's hover:bg-[var(--color-sage-50)] becomes sage 100 (round 2 found sage 50 reads as grey, mock.css bottom bar note)",
    "src/app/(site)/admin/login/page.tsx (the page around it)",
    "src/components/formClasses.ts (labelClass, inputBase, errorClass)",
    "src/lib/adminAuthAllowlistPlugin.ts (the same reply for every email)",
  ],
});

// ── Admin cards and boxes (adminCardStyles.ts cardClass, the summary boxes) ───────────────────────────────────
const toReview = (o: { busy?: boolean; done?: boolean; cls?: string; live?: boolean } = {}) => `<div class="pa-card sum"><div class="pa-row">
  <p class="pa-strong">14 to review · 11 from the data refresh, 3 from the public</p>
  <button type="button" class="pa-bp pa-ring${o.cls ? ` ${o.cls}` : ""}"${o.busy ? " disabled" : ""}${o.live ? say("Mockup: this asks first, in the browser's own box, then approves every date-only update.") : ""}>${o.busy ? "Approving…" : "Approve all 6 date-only updates"}</button></div>
  ${o.done ? `<p aria-live="polite" style="margin-top:4px;color:var(--color-ink-500)">Approved 6. Skipped 0.</p>` : ""}</div>`;
const boxesToReview = (live = false) => `<div class="pa-card sum"><div class="pa-row"><p class="pa-strong">3 to review: 2 photos (1 reported by a visitor) and 1 sponsor request</p>
  <a class="pa-bp pa-ring tall" href="#admin-cards"${live ? say("Mockup: this would open Blessing Boxes, filtered to To review.") : ""}>Show them</a></div></div>`;
const waiting = `<div class="pa-wait"><p style="font-weight:600">Waiting to publish</p><p style="margin-top:4px">These changes won&apos;t show on the public map until the next Publish.</p>
  <dl><div><dt>Hours</dt><dd><s>Tue 9am – 1pm</s> → <span style="font-weight:500">Tue 9am – 2pm</span><span class="by">Changed by ${ADMIN}</span></dd></div>
  <div><dt>Phone</dt><dd><s>(719) 555-0142</s> → <span style="font-weight:500">(719) 555-0187</span><span class="by">Changed by the data refresh</span></dd></div></dl></div>`;
const shellCard = `<div class="pa-card"><div class="pa-row atop"><span class="pa-tag t-sage">New place</span><p class="pa-meta">Nov 3, 2026, 4:12 PM</p></div>
  <div style="margin-top:12px"><p class="pa-name">Northside Free Fridge</p><p><span class="pa-fl">Address: </span>200 Sample Rd, Pueblo, CO 81003</p></div>
  <div class="pa-btns" style="margin-top:16px"><a class="pa-bp pa-ring" href="#admin-cards">Review &amp; approve</a><button type="button" class="pa-bs pa-ring">Reject</button></div></div>`;

const cardsEntry = entry({
  id: "admin-cards", name: "Admin cards and boxes (cardClass and the summary boxes)", status: "built",
  statusNote: "Live as is. The buttons inside the review cards are in the next entries.",
  purpose: "The one white card every admin queue item and summary sits in: a 14-pixel corner, a hairline edge and a faint shadow. A summary box is the same card, slimmer, with one line saying how much is waiting and one button to act on it. The clay box is the one exception: a warning that saved changes aren't on the public map yet.",
  instead: [
    "It's one thing someone sent in or a data check found: use a change card (the next-but-one entry), which adds its tags and its decision buttons.",
    "It's a number to watch over time: use a dashboard number card.",
    "It's the whole list of places or boxes: use a table.",
  ],
  versions:
    wide("The plain card (cardClass), here holding a public suggestion. 16 pixels of padding on a phone, 24 from 640 wide.", shellCard) +
    wide("Summary on Places (ToReviewSummaryBox): how much is waiting and where it came from, and one button for the safe bulk step. Tap it.", toReview({ live: true })) +
    wide("Summary on Blessing Boxes (BoxesToReviewBox): the count and a Show them button that turns on the To review filter.", boxesToReview(true)) +
    wide("Waiting to publish (WaitingToPublishBox), on a place's edit page: the clay warning, with each change crossed out and its new value.", waiting) +
    wide("A group on a place's or box's edit page (SuggestionsBox, BoxReviewBox): a small heading with the count over a stack of cards, 16 pixels apart.", `<div class="pa-grp" style="max-width:672px"><h2>Suggestions to review (2)</h2><ul><li>${shellCard}</li><li><div class="pa-card"><div class="pa-row atop"><span class="pa-tag t-clay">Public report</span><p class="pa-meta">Nov 2, 2026, 9:40 AM</p></div><div style="margin-top:12px"><p class="pa-name">Northside Free Fridge</p><p><span class="pa-fl">Issue: </span>Wrong hours</p></div></div></li></ul></div>`),
  states:
    demo("Summary: nothing waiting. The box doesn't show at all.", `<p style="color:var(--color-ink-500);font-size:13px;margin:0">(no box)</p>`) +
    wide("Summary: the bulk button while it works, Approving…, faded", toReview({ busy: true })) +
    wide("Summary: done. The result stays on screen in the box.", toReview({ done: true })) +
    wide("Summary button: pointer over it (sage 700), then keyboard", `${toReview({ cls: "is-hover" })}${toReview({ cls: "is-focus" })}`),
  colors:
    sw("White", "white", "Every card") +
    sw("Bone 200", "color-bone-200", `The card's hairline edge. ${contrast(H("color-bone-200"), H("white")).toFixed(1)} to 1, decoration only: the shadow and the words carry the card`) +
    swr("Ink 700", "color-ink-700", "The summary line and card words") +
    swr("Ink 400", "color-ink-400", "Small capital labels (ADDRESS) and the time sent") +
    sw("Clay 100", "color-clay-100", `Waiting to publish. Clay 700 words on it ${r("color-clay-700", "color-clay-100")}; the Changed by line in ink 500 ${r("color-ink-500", "color-clay-100")}`) +
    sw("Clay 500", "color-clay-500", `Waiting to publish's edge. ${r("color-clay-500", "color-clay-100", 3)} on clay 100 (edge)`) +
    sw("Sage 600", "color-sage-600", `The one button. Bone 50 words ${r("color-bone-50", "color-sage-600")}; sage 700 under the pointer ${r("color-bone-50", "color-sage-700")}`),
  sizes: "Corners 14 pixels. Plain card: 16 pixels of padding, 24 from 640 wide. Summary: 12 by 16, with 16 below it. Shadow: a 1-pixel ink line at 5% plus a 2-pixel blur at 4%. Words 14 pixels; the summary line semi-bold; labels 11-pixel capitals. The Show them button is 48 pixels tall; the bulk Approve button is 36 (a known issue below).",
  wording: [
    "A summary says the total, then where it came from: 14 to review · 11 from the data refresh, 3 from the public.",
    "Its button says how many it acts on: Approve all 6 date-only updates. Show them opens the list.",
    "Waiting to publish names each field, crosses out what's on the map now and says who changed it.",
  ],
  everyone: [
    "Keyboard and screen reader: a card is not itself a button; the links and buttons inside it are. The bulk result is announced when it appears.",
    "Touch: the summary wraps its button under the line on a phone, never squeezing the words.",
    "Color is never the only sign: Waiting to publish has a heading, and crossed-out text is followed by an arrow and the new value.",
  ],
  dd: dodont(
    [`<div class="pa pa-cq" style="width:100%">${boxesToReview()}</div>`, "One line and one button: how many, and where to go."],
    [`<div class="pa pa-cq" style="width:100%"><div class="pa-card sum"><div class="pa-row"><p class="pa-strong">Things to review</p><span class="pa-btns"><a class="pa-bp tall" href="#admin-cards">Photos</a><a class="pa-bp tall" href="#admin-cards">Sponsors</a><a class="pa-bp tall" href="#admin-cards">Reports</a></span></div></div></div>`, "No count and three green buttons. Nobody knows how much is waiting or which to press."],
  ),
  code: [
    "src/lib/adminCardStyles.ts (cardClass, fieldLabelClass, the button sets)",
    "src/components/ToReviewSummaryBox.tsx (its own slimmer cardClass copy). Known live issues: its button is primaryButtonClass with no min-h-12, about 36 pixels tall, under the 48-pixel floor; it asks with window.confirm (the risky-action ruling would apply here too, for the parent to decide)",
    "src/components/BoxesToReviewBox.tsx (another cardClass copy), WaitingToPublishBox.tsx",
    "src/components/SuggestionsBox.tsx, BoxReviewBox.tsx (the groups)",
  ],
});

// ── Publish bar (PublishPanel, PublishBotStatusBanner) ────────────────────────────────────────────────────────
type PubOpt = { review?: boolean; upToDate?: boolean; busy?: boolean; ok?: boolean; err?: boolean; cls?: string; live?: boolean };
const pubBar = (o: PubOpt = {}) => `<section class="pa-pub"><div class="in"><p>${o.upToDate ? "The public map is up to date." : `<strong>2 new</strong>, <strong>5 edited</strong>, <strong>1 removed</strong> since the last publish.`}</p>
  <div class="r">${o.review && !o.upToDate ? `<a class="pa-lnk" href="#admin-publish" style="color:var(--color-sage-700)"${o.live ? say("Mockup: this would open Places, where each change can be checked.") : ""}>Review changes</a>` : ""}
  <button type="button" class="pa-bp pa-ring${o.cls ? ` ${o.cls}` : ""}"${o.upToDate || o.busy ? " disabled" : ""}${o.live ? say("Mockup: this asks first in the browser's own box (Publish 2 new places and 5 edited places to the public map? 1 place will be removed. This opens a change request that auto-merges.), then publishes.") : ""}>${o.busy ? "Publishing…" : "Publish"}</button></div></div>
  ${o.ok ? `<p class="ok" aria-live="polite">Published — 7 places pushed, 1 place removed to the public map. A <a class="pa-lnk" href="#admin-publish">change request</a> was opened and set to auto-merge. It can take a minute for the map to update.</p>` : ""}
  ${o.err ? `<p class="bad" role="alert">Couldn't reach GitHub to publish. Nothing was changed — try again in a moment.</p>` : ""}</section>`;
const botBanner = (stuck: boolean) => `<section class="pa-bot${stuck ? " stuck" : ""}"${stuck ? ' role="alert"' : ""}>${stuck
  ? `<strong style="font-weight:600">Publish is stuck: merge conflict —</strong> <a class="pa-lnk" href="#admin-publish">PR #4821</a>. The public map is still showing the OLD data. Fix it (or close the PR) and publish again.`
  : `Publish in progress — waiting on <a class="pa-lnk" href="#admin-publish">PR #4821</a>. The public map updates once it merges.`}</section>`;

const publishEntry = entry({
  id: "admin-publish", name: "Publish bar (PublishPanel, PublishBotStatusBanner)", status: "built",
  statusNote: "Live as is.",
  purpose: "Places only reach the public map when someone presses Publish. The bar says how many places are new, edited or removed since the last time, and holds the one Publish button. Above it, a banner follows the change request that Publish opens until it lands, and turns red if it gets stuck.",
  instead: [
    "It's a blessing box or an event: they show on the map as soon as they're saved, with no Publish.",
    "It's the test site: the dashboard shows a clay line in its place, Test site: publishing is turned off here.",
    "It's one place's unpublished changes: use the Waiting to publish box on that place's page.",
  ],
  versions:
    wide("On the Dashboard: the counts, a Review changes link and Publish. Tap either.", pubBar({ review: true, live: true })) +
    wide("On Places: the same bar without the link.", pubBar()) +
    wide("While the change request is on its way (the banner sits above the bar)", botBanner(false)) +
    wide("Stuck: a red edge and words, read out right away", botBanner(true)),
  states:
    wide("Publish: resting, pointer over it (sage 700), keyboard", `${pubBar({ cls: "" })}<div style="height:8px"></div>${pubBar({ cls: "is-hover" })}<div style="height:8px"></div>${pubBar({ cls: "is-focus" })}`) +
    wide("Nothing to publish: the button is faded and can't be pressed", pubBar({ upToDate: true })) +
    wide("Working: Publishing…, faded", pubBar({ busy: true })) +
    wide("Done: a green line with a link to the change request", pubBar({ ok: true })) +
    wide("Failed: a red line that says nothing changed", pubBar({ err: true })),
  colors:
    sw("White", "white", "The bar and the banner, with a bone 200 edge") +
    swr("Ink 700", "color-ink-700", "The sentence and the in-progress banner") +
    swr("Ink 900", "color-ink-900", "The counts, semi-bold") +
    swr("Sage 700", "color-sage-700", "Review changes, and the done line") +
    sw("Sage 600", "color-sage-600", `Publish. Bone 50 words ${r("color-bone-50", "color-sage-600")}; sage 700 under the pointer ${r("color-bone-50", "color-sage-700")}`) +
    swr("Danger red", "color-danger", "The failed line, and the stuck banner's words and edge"),
  sizes: "Corners 14 pixels. 16 pixels of padding (16 by 32 from 640 wide), where the sentence and the button share a row. Words 14 pixels. Publish is about 36 pixels tall, with 12 pixels between it and Review changes. The banner sits 12 pixels above the bar.",
  wording: [
    "The bar counts what changes on the map: 2 new, 5 edited, 1 removed since the last publish. With nothing to do it says The public map is up to date.",
    "Before publishing, the browser asks with the same counts, so nothing is a surprise.",
    "After: what went out (7 places pushed, 1 place removed) and that the map can take a minute. A failure always says whether anything changed.",
  ],
  everyone: [
    "Keyboard: Review changes, then Publish. Enter presses it.",
    "Screen reader: the done line is announced politely; the failed line and the stuck banner are read out at once.",
    "Color is never the only sign: stuck is written out, and the button's faded look comes with it not responding.",
  ],
  dd: dodont(
    [`<div class="pa pa-cq" style="width:100%">${pubBar({ review: true })}</div>`, "Say what will change before the button: how many new, edited and removed."],
    [`<div class="pa pa-cq" style="width:100%"><section class="pa-pub"><div class="in"><p>You have unpublished changes.</p><div class="r"><button type="button" class="pa-bp">Publish</button></div></div></section></div>`, "Vague. Nobody can tell whether this pushes one fix or removes ten places."],
  ),
  code: [
    "src/components/PublishPanel.tsx. Known live issues: its primaryButtonClass (line 89) has no min-h-12, so Publish is about 36 pixels tall, under the 48-pixel floor; Review changes has no 48-pixel tap area; it asks with window.confirm (line 156; the risky-action ruling would apply here too, for the parent to decide)",
    "src/components/PublishBotStatusBanner.tsx",
    "src/app/(site)/admin/page.tsx and admin/places/page.tsx (where they sit, and the test-site line)",
  ],
});

// ── Change cards (ProposalCard, SubmissionCard, PhotoReviewCard, SponsorRequestCard) ─────────────────────────
type Act = { busy?: boolean; cls?: string; live?: boolean; err?: string };
const rejectBox = (danger: string, tall = false) => `<div class="pa-rej"><label class="pa-fl" for="pa-rr-${++uid}" style="display:block;margin-bottom:4px">Reason <span style="font-weight:400;text-transform:none;color:var(--color-ink-400)">(optional, for your own notes)</span></label>
  <textarea id="pa-rr-${uid}" class="pa-in" rows="2"></textarea>
  <div class="pa-btns" style="margin-top:8px"><button type="button" class="pa-bd pa-ring${tall ? " tall" : ""}">${danger}</button><button type="button" class="pa-bs pa-ring${tall ? " tall" : ""}">Cancel</button></div></div>`;
const proposal = (o: Act & { reject?: boolean } = {}) => `<div class="pa-card"><div class="pa-row atop"><div class="pa-btns" style="gap:8px"><span class="pa-tag t-sage">Plentiful</span><span class="pa-tag t-bone">Field update</span><span class="pa-tag t-clay">Needs a human</span></div><p class="pa-meta">Nov 4, 2026, 2:05 AM · run 318</p></div>
  <div class="pa-cols"><div><p class="pa-name">Eastside Community Pantry</p><p class="pa-small">100 Example Ave, Pueblo, CO 81001</p><p class="pa-meta">eastside-community-pantry</p>
  <dl class="pa-diff" style="margin-top:8px"><div><dt class="pa-fl">Hours</dt><dd><s>Tue 9am – 1pm</s> <span aria-hidden="true">→</span> <span class="new">Tue 9am – 2pm</span></dd></div><div><dt class="pa-fl">Phone</dt><dd><s>(719) 555-0142</s> <span aria-hidden="true">→</span> <span class="new u">(719) 555-0187</span></dd></div></dl></div>
  <div class="pv"><p class="pa-fl" style="margin-bottom:8px">Preview — public map</p><div class="pa-stand">The public list card (VenueCard) with the new details stands in here</div></div></div>
  <div class="pa-btns" style="margin-top:16px"><button type="button" class="pa-bp pa-ring${o.cls ? ` ${o.cls}` : ""}"${o.busy ? " disabled" : ""}${o.live ? say("Mockup: this would apply the change. It shows on the map at the next Publish.") : ""}>${o.busy ? "Applying…" : "Approve"}</button>${o.reject ? "" : `<button type="button" class="pa-bs pa-ring"${o.live ? ` onclick="${q("this.closest('.pa-card').querySelector('.pa-rej').hidden=false;this.remove()")}"` : ""}>Reject</button>`}</div>
  ${o.err ? `<p role="alert" style="margin-top:8px;color:var(--color-danger)">${o.err}</p>` : ""}
  ${o.reject || o.live ? rejectBox("Confirm reject").replace('<div class="pa-rej">', `<div class="pa-rej"${o.live ? " hidden" : ""}>`) : ""}</div>`;
const submission = (live = false) => `<div class="pa-card"><div class="pa-row atop"><span class="pa-tag t-clay">Public report</span><p class="pa-meta">Nov 2, 2026, 9:40 AM · lee@example.com</p></div>
  <div style="margin-top:12px;display:flex;flex-direction:column;gap:4px"><p class="pa-name">Northside Free Fridge</p><p><span class="pa-fl">Address: </span>200 Sample Rd, Pueblo, CO 81003</p><p><span class="pa-fl">Issue: </span>Wrong hours</p><p><span class="pa-fl">Description: </span>The sign on the door says it opens at 10 now, not 9.</p></div>
  <div class="pa-btns" style="margin-top:16px"><button type="button" class="pa-bp pa-ring"${live ? say("Mockup: this would mark the report done.") : ""}>Mark done</button><button type="button" class="pa-bs pa-ring">Reject</button></div></div>`;
const photo = (live = false) => `<div class="pa-card"><div class="pa-row atop"><span class="pa-tag t-clay">Photo reported (2×)</span><p class="pa-meta">Nov 1, 2026, 6:18 PM</p></div>
  <div class="pa-photo"><div class="img" role="img" aria-label="Photo submitted for Elm Street Blessing Box">Photo</div><div style="display:flex;flex-direction:column;gap:4px"><p class="pa-name">Elm Street Blessing Box</p><p><span class="pa-fl">Attached to check-in: </span>filled</p><p style="color:var(--color-ink-500)">Hidden from the public card until you decide.</p></div></div>
  <div class="pa-btns" style="margin-top:16px"><button type="button" class="pa-bp pa-ring tall"${live ? say("Mockup: this would keep the photo on the box's card.") : ""}>Keep photo</button><button type="button" class="pa-bs pa-ring tall">Remove photo</button></div></div>`;
const sponsor = `<div class="pa-card"><div class="pa-row atop"><span class="pa-tag t-sage">Email confirmed</span><p class="pa-meta">Oct 30, 2026, 11:02 AM</p></div>
  <div style="margin-top:12px;display:flex;flex-direction:column;gap:4px"><p class="pa-name">Elm Street Blessing Box</p><p><span class="pa-fl">Name: </span>The Ortiz family</p><p><span class="pa-fl">Email: </span><a class="u" href="#admin-change">ortiz.family@example.com</a></p><p style="color:var(--color-ink-500)">Approving adds them to &ldquo;Sponsored by …&rdquo; on the public card.</p></div>
  <div class="pa-btns" style="margin-top:16px"><button type="button" class="pa-bp pa-ring tall">Approve sponsor</button><button type="button" class="pa-bs pa-ring tall">Decline</button></div></div>`;
const btnRow = (html: string) => `<div class="pa-btns" style="background:#fff;padding:10px;border-radius:10px">${html}</div>`;

const changeEntry = entry({
  id: "admin-change", name: "Change cards (ProposalCard, SubmissionCard, PhotoReviewCard, SponsorRequestCard)", status: "changing",
  statusNote: "What changes: the pointer-over fill on Reject, Cancel, Remove photo and Decline becomes the light green tint (sage 100) in place of the grey (bone 100). Everything else is the cards as they are live today.",
  purpose: "One card for each thing waiting on a person: a change the weekly data check found, a place or problem the public sent in, a box photo, a sponsor request. Each card shares the white card shell and the same order: tags and when it arrived, what it is, then the decision buttons, with the yes button first.",
  instead: [
    "It's a count of everything waiting: use a summary box.",
    "It's an event someone shared: use the Sent in by the public list in Events (Lists and tables).",
    "The change needs editing before it's right: use Review as new place or Review &amp; fix link, which open the full form.",
  ],
  versions:
    wide("A data change (ProposalCard). Tags: where it came from, what kind, and how sure the sorting was. The old value is crossed out, the new one follows. From 1024 pixels wide a preview of the public card sits on the right. Tap Reject to open the reason box.", proposal({ live: true })) +
    wide("A public report (SubmissionCard): Mark done or Reject. The sender's email shows only here.", submission(true)) +
    wide("A reported box photo (PhotoReviewCard): the photo is big enough to judge. Its buttons are 48 pixels tall.", photo(true)) +
    wide("A sponsor request (SponsorRequestCard), 48-pixel buttons too.", sponsor),
  states:
    demo("Approve: resting, pointer over it (sage 700), keyboard", btnRow(`<button type="button" class="pa-bp pa-ring">Approve</button><button type="button" class="pa-bp pa-ring is-hover">Approve</button><button type="button" class="pa-bp pa-ring is-focus">Approve</button>`)) +
    demo("Working: Applying…, faded; Reject is still there", btnRow(`<button type="button" class="pa-bp" disabled>Applying…</button><button type="button" class="pa-bs">Reject</button>`)) +
    demo("Reject: resting, pointer over it (sage 100, proposed; point at it), live today (bone 100), keyboard", btnRow(`<button type="button" class="pa-bs pa-ring">Reject</button><button type="button" class="pa-bs pa-ring is-hover">Reject</button><button type="button" class="pa-bs pa-ring is-livehover">Reject</button><button type="button" class="pa-bs pa-ring is-focus">Reject</button>`)) +
    demo("Confirm reject: resting, pointer over it (fills red), keyboard (a red ring)", btnRow(`<button type="button" class="pa-bd pa-ring">Confirm reject</button><button type="button" class="pa-bd is-hover">Confirm reject</button><button type="button" class="pa-bd is-focus">Confirm reject</button>`)) +
    wide("Reject opened: an optional reason, then Confirm reject and Cancel", proposal({ reject: true })) +
    wide("Failed: the reason in red under the buttons", proposal({ err: "Something went wrong. This wasn't approved. Try again." })),
  colors:
    sw("Sage 100", "color-sage-100", `Calm tags (Plentiful, New place, Email confirmed). Sage 700 words ${r("color-sage-700", "color-sage-100")}. Also the proposed fill under the pointer on Reject and Cancel: ink 700 words ${r("color-ink-700", "color-sage-100")}`) +
    sw("Clay 100", "color-clay-100", `Tags that need a look (Needs a human, Public report, Photo reported). Clay 700 words ${r("color-clay-700", "color-clay-100")}`) +
    sw("Bone 100", "color-bone-100", `Quiet tags (Field update, Likely noise), ink 500 words ${r("color-ink-500", "color-bone-100")}; live, the fill under the pointer on Reject, ink 700 ${r("color-ink-700", "color-bone-100")}`) +
    swr("Clay 700", "color-clay-700", "The crossed-out old value") +
    swr("Sage 700", "color-sage-700", "The new value") +
    swr("Ink 400", "color-ink-400", "When it arrived, the run number, and small capital labels") +
    swr("Danger red", "color-danger", "Confirm reject's words and edge, and errors") +
    sw("Danger red fill", "color-danger", `Confirm reject under the pointer. Bone 50 words on it ${r("color-bone-50", "color-danger")}`) +
    sw("Bone 300", "color-bone-300", `Reject and Cancel edges, ${contrast(H("color-bone-300"), H("white")).toFixed(1)} to 1: decoration, the words carry the button. The reason box's edge is the same color and fails, see Admin form fields`),
  sizes: "The card shell from Admin cards and boxes. Tags 12 pixels, 2 by 6 padding, 4-pixel corners. The name 16 pixels semi-bold; details 14; labels 11-pixel capitals. Buttons 8 pixels apart, corners 10. On data changes and public reports Approve is about 36 pixels tall and Reject about 34; on photos and sponsor requests every button is 48. The preview column is 320 pixels wide from 1024 up.",
  wording: [
    "The yes button says what it does: Approve, Approve rename, Mark done, Keep photo, Approve sponsor. A data change that removes a place says Archive this venue.",
    "No is Reject, Remove photo (a reported photo), Decline or Remove (a sponsor). Its second step says Confirm reject, Confirm remove or Confirm decline.",
    "The reason is optional and says who reads it: (optional, for your own notes).",
    "Errors say whether anything happened: Something went wrong. This wasn't rejected. Try again.",
  ],
  everyone: [
    "Keyboard: the order on screen is the tab order; the preview is skipped, since it can't be used.",
    "Screen reader: the arrow between old and new values is hidden, so the two values are read in order. Errors are read out at once. The reason box has a real label.",
    "Touch: the cards stack everything in one column on a phone. Photo and sponsor buttons are 48 pixels; the shorter ones are a known issue below.",
    "Color is never the only sign: every tag is words, and the old value is crossed out as well as colored.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%">${btnRow(`<button type="button" class="pa-bp tall">Keep photo</button><button type="button" class="pa-bs tall">Remove photo</button>`)}</div>`, "One filled yes button first, and a plain outline for no."],
    [`<div class="pa" style="width:100%">${btnRow(`<button type="button" class="pa-bp tall">Keep photo</button><button type="button" class="pa-bp tall">Remove photo</button>`)}</div>`, "Two filled buttons. The two choices look the same, so the wrong one gets pressed."],
  ),
  code: [
    "src/lib/adminCardStyles.ts (cardClass and both button sets). Proposed change: secondaryButtonClass and secondaryButtonTallClass's hover:bg-[var(--color-bone-100)] becomes sage 100",
    "src/components/ProposalCard.tsx (SOURCE_BADGE and LANE_BADGE tags, the diff, the preview column), SubmissionCard.tsx, PhotoReviewCard.tsx, SponsorRequestCard.tsx",
    "Known live issue: ProposalCard and SubmissionCard use the short button set (no min-h-12): Approve about 36 pixels, Reject and Confirm reject about 34, under the 48-pixel floor. PhotoReviewCard and SponsorRequestCard use the 48-pixel set. The adminCardStyles.ts header says the split was kept on purpose until someone decides",
    "Known live issue: in every reject step the red Confirm button comes before Cancel; the risky-action ruling puts the safe button first (for the parent to decide). A data change that removes a place asks with window.confirm (ProposalCard.tsx:261)",
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
const saveBtn = (o: { busy?: boolean; cls?: string; live?: boolean } = {}) => `<button type="button" class="pa-bfull pa-ring${o.cls ? ` ${o.cls}` : ""}"${o.busy ? " disabled" : ""}${o.live ? say("Mockup: nothing is saved.") : ""}>${o.busy ? "Saving…" : "Save changes"}</button>`;
const savePair = (live = false) => `<div class="pa-savepair"><a class="pa-bs pa-ring" href="#admin-forms"${live ? say("Mockup: this would go back to Places and save nothing.") : ""}>Cancel</a>${saveBtn({ live })}</div>`;
const venueForm = (live = false, proposed = false) => `<form class="pa-form" onsubmit="return false" novalidate>
  ${field({ label: "Name", req: true, value: "Eastside Community Pantry" })}
  ${field({ label: "Category", req: true, select: CATS, value: "Food Pantry" })}
  ${field({ label: "Website" })}
  ${checkbox("Outside Pueblo County")}
  ${proposed ? `<div>${newTag}${savePair(live)}</div>` : saveBtn({ live })}</form>`;

const formsEntry = entry({
  id: "admin-forms", name: "Admin form fields and the save button (formClasses.ts)", status: "changing",
  statusNote: "What changes: Save changes on a place's edit page gets a Cancel beside it (owner's ruling: Cancel beside Save). Everything else is the fields as they are live today.",
  purpose: "The boxes, labels, error lines and green save button every admin form shares: Add a place and its edit page, Events, and sign-in. One set of classes, so the forms look the same and can't drift apart.",
  instead: [
    "It's a public form (Suggest a place, Report a problem, Share an event): use the public form fields, with the Turnstile check.",
    "It's a search or filter above a list: use the list's own search box and filter chips (Lists and tables).",
    "It's picking one of two or three short choices: a slider, not a drop-down.",
  ],
  versions:
    mid("A place's edit page today (AddVenueForm, shortened): label, box, a red star for required, the green Save changes at the end with nothing beside it.", venueForm(true)) +
    mid("The ruling version: Cancel beside Save changes. Cancel goes back to Places and saves nothing. Tap either.", venueForm(true, true)) +
    mid("An event field with a hint after its label (EventForm), and a larger text box", `<form class="pa-form" onsubmit="return false">${field({ label: "Host (English)", hint: "who is running it", value: "Mesa Street Community Garden" })}${field({ label: "About (English)", textarea: true, value: "Free produce and canned goods while they last. Bring a bag." })}</form>`) +
    mid("A failed save: the red box at the top of the form, with Reload when someone else saved first", `<div class="pa-banner" role="alert"><p class="t">Someone else changed this place since you opened it. Reload to see their changes.</p><button type="button" class="pa-reload">Reload</button></div>`),
  states:
    demo("Box: empty, with its example in ink 400", field({ label: "Who told us, and how", hint: "(optional)", ph: "e.g. Heather, admin assistant, by email" })) +
    demo("Box: reached by keyboard or typing, a green edge and ring", field({ label: "Name", req: true, value: "Eastside Community Pantry", cls: "is-focus" })) +
    demo("Box: wrong. Red edge and the reason under it.", field({ label: "Name", req: true, err: "Name is required." })) +
    demo("Tick box: off, on", `<div style="display:flex;flex-direction:column;gap:8px">${checkbox("Outside Pueblo County")}${checkbox("The venue told us", true)}</div>`) +
    demo("Save changes: resting, pointer over it (sage 700), keyboard", `<div style="display:flex;flex-direction:column;gap:12px;width:100%">${saveBtn()}${saveBtn({ cls: "is-hover" })}${saveBtn({ cls: "is-focus" })}</div>`) +
    demo("Working: Saving…, faded, can't be pressed twice", `<div style="width:100%">${saveBtn({ busy: true })}</div>`) +
    demo("Cancel (ruling version): resting, pointer over it (sage 100), keyboard", `<div style="display:flex;flex-direction:column;gap:12px;width:100%"><a class="pa-bs pa-ring" style="height:48px;font-size:16px" href="#admin-forms">Cancel</a><a class="pa-bs pa-ring is-hover" style="height:48px;font-size:16px" href="#admin-forms">Cancel</a><a class="pa-bs pa-ring is-focus" style="height:48px;font-size:16px" href="#admin-forms">Cancel</a></div>`),
  colors:
    sw("White", "white", "Every box") +
    sw("Bone 300", "color-bone-300", `A box's edge at rest. ${r("color-bone-300", "white", 3)} on white (edge): under 3 to 1, and the edge is the only thing that shows where the box is`) +
    swr("Ink 700", "color-ink-700", "Labels") +
    swr("Ink 900", "color-ink-900", "What's typed") +
    swr("Ink 400", "color-ink-400", "Examples in empty boxes, and hints after a label") +
    swr("Danger red", "color-danger", "The required star, error lines, a wrong box's edge, the failed-save box") +
    swr("Sage 500", "color-sage-500", "Edge and ring while typing; tick color", "white", 3) +
    sw("Sage 600", "color-sage-600", `Save changes. Bone 50 words ${r("color-bone-50", "color-sage-600")}; sage 700 under the pointer ${r("color-bone-50", "color-sage-700")}`) +
    sw("Sage 100", "color-sage-100", `Cancel under the pointer (ruling version). Ink 700 words ${r("color-ink-700", "color-sage-100")}`),
  sizes: "Labels 14 pixels, medium, 4 above the box. Boxes full width, corners 10, 8 by 12 padding, 16-pixel words on a phone so it doesn't zoom in (14 from 768 wide): about 42 pixels tall on a phone, 38 on a computer. Fields 24 pixels apart; admin forms stop at 672 pixels wide. Save changes is full width and 48 tall. Tick boxes are 16 pixels. In the ruling version Cancel takes a third of the row and Save two thirds, both 48 tall.",
  wording: [
    "Labels are one or two words. Optional fields say (optional) in ink 400; required ones get a red star that screen readers skip (they hear required instead).",
    "Errors say what to do: Name is required. Enter a start date and time. The end must be after the start.",
    "The save button names the action: Add venue on a new place, Save changes on an existing one, Save draft and Publish on an event. Working: Saving….",
    "Cancel, never Back or Discard, beside Save.",
  ],
  everyone: [
    "Keyboard: fields go top to bottom in screen order; Enter saves. Every box shows the green ring.",
    "Screen reader: every box has a real label; required boxes say so; a wrong box is marked invalid and its error is read out.",
    "Touch: Save changes is 48 pixels tall. The boxes and tick boxes are smaller, see Lives in.",
    "Color is never the only sign: a red edge always comes with a written error.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%">${savePair()}</div>`, "Cancel beside Save, so leaving without saving is one obvious tap."],
    [`<div class="pa" style="width:100%">${saveBtn()}</div>`, "Save alone. The only way out is the browser's back button, and nobody knows whether that keeps the changes."],
  ),
  code: [
    "src/components/formClasses.ts (inputBase, inputBorder, labelClass, errorClass, ADMIN_PRIMARY_BUTTON)",
    "src/components/AddVenueForm.tsx. Ruling change: the submit button (line 1368) is Save changes on its own, with no Cancel beside it",
    "src/components/EventForm.tsx. Live as is: Save sits beside a Back to events link (line 693), not a button called Cancel",
    "Known live issue: src/components/PublicForm.tsx (lines 33 to 42) keeps a second, separate copy of the same field styles (INPUT_BASE, ERROR_CLASS, LABEL_CLASS) that can drift from formClasses.ts",
    "Known live issue: inputBorder's bone-300 edge is 1.6 to 1 on white, under 3 to 1 (the same edge is in PublicForm.tsx, VenueListView.tsx controlInputClass, AllBoxesTable.tsx and the reject reason boxes)",
    "Known live issue: inputBase has no min-h-12, so boxes are about 42 pixels on a phone; AddVenueForm's tick boxes are w-4 h-4 (16 pixels) with a label row about 20 tall; the Reload button's hover is bone-100, a grey",
  ],
});

// ── Lists and tables (VenueListView, AllBoxesTable, EventsList, EventSubmissionsList) ─────────────────────────
const STATUS_TAG: Record<string, [string, string]> = { draft: ["Draft", "t-yel"], live: ["Live", "t-sage"], waiting: ["Live · edits waiting", "t-clay"], removed: ["Removed", "t-bone"] };
const stTag = (k: string) => `<span class="pa-tag round ${STATUS_TAG[k][1]}">${STATUS_TAG[k][0]}</span>`;
const statusKey = `<dl class="pa-key">${([["draft", "New, not on the public map yet."], ["live", "On the public map, exactly as shown."], ["waiting", "Approved or saved changes the map doesn't show until Publish."], ["removed", "Taken off the map, kept for the record."]] as [string, string][]).map(([k, d]) => `<div><dt>${stTag(k)}</dt><dd>${d}</dd></div>`).join("")}</dl>`;
const chip = (label: string, on = false, cls = "") => `<button type="button" class="pa-chip${on ? " on" : ""}${cls ? ` ${cls}` : ""}">${label}</button>`;
const placesChips = `<div class="pa-chips">${chip("All places (48)")}${chip("To review (12)", true)}${chip("Live · edits waiting (5)")}${chip("Draft (2)")}${chip("Live (39)")}${chip("Removed (3)")}</div>`;
const placesSearch = `<div class="pa-ctlrow"><div class="pa-ctl"><label class="pa-fl" for="pa-vs-${++uid}">Search</label><input id="pa-vs-${uid}" class="pa-in" type="search" placeholder="Search by name or address"></div><div class="pa-ctl"><label class="pa-fl" for="pa-vc-${uid}">Category</label><select id="pa-vc-${uid}" class="pa-in"><option>All</option><option>Food Pantry</option><option>Blessing Box</option></select></div></div>`;
const vRow = (o: { name: string; cat: string; st: string; review?: string; addr: string; ver: string; cls?: string; newPlace?: boolean }) =>
  `<tr${o.cls ? ` class="${o.cls}"` : ""}><td style="font-weight:500"><a class="nm" href="#admin-lists">${o.name}</a></td><td>${o.cat}</td><td>${o.newPlace ? `<span class="pa-btns" style="gap:4px"><span class="pa-tag round t-clay">Suggested new place</span><span class="pa-tag round t-clay">Public</span></span>` : stTag(o.st)}</td><td>${o.review ? `<span style="display:flex;align-items:center;gap:6px;font-size:12px;line-height:16px">${o.review}</span>` : `<span style="color:var(--color-ink-400)">—</span>`}</td><td class="m5">${o.addr}</td><td class="m5">${o.ver}</td></tr>`;
const placesTable = (hoverRow = "") => `<div class="pa-tw el"><table style="min-width:680px"><thead class="cap"><tr><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">To review</th><th scope="col">Address</th><th scope="col">Last verified</th></tr></thead><tbody class="b2 hov">
  ${vRow({ name: "Eastside Community Pantry", cat: "Food Pantry", st: "waiting", review: `Hours <span class="pa-tag t-sage" style="padding:2px 4px">Plentiful</span>`, addr: "100 Example Ave", ver: "Oct 28, 2026", cls: hoverRow })}
  ${vRow({ name: "Northside Free Fridge", cat: "Food Pantry", st: "", newPlace: true, review: `New place <span class="pa-tag t-clay" style="padding:2px 4px">Public report</span>`, addr: "200 Sample Rd", ver: "—" })}
  ${vRow({ name: "Mesa Street Community Garden", cat: "Community Garden", st: "live", addr: "300 Mesa St", ver: "Sep 14, 2026" })}
  ${vRow({ name: "Riverside Grocery", cat: "Grocery / Supermarket", st: "draft", addr: "410 River Ln", ver: "—" })}</tbody></table></div>`;
const BOX_ST: Record<string, [string, string]> = { ok: ["OK", "t-sage"], low: ["Low", "t-low"], empty: ["Empty", "t-empty"], problem: ["Problem", "t-clay"], quiet: ["Quiet", "t-bone"] };
const fb = (label: string, o: { on?: boolean; dis?: boolean; cls?: string } = {}) => `<button type="button" class="pa-fb${o.cls ? ` ${o.cls}` : ""}" aria-pressed="${o.on ? "true" : "false"}"${o.dis ? " disabled" : ""}>${label}</button>`;
const boxRow = (name: string, addr: string, st: string, last: string, sponsor: string, review = "") => `<tr><td><a class="nm" href="#admin-lists">${name}</a><p class="pa-small">${addr}</p></td><td><span class="pa-tag ${BOX_ST[st][1]}">${BOX_ST[st][0]}</span></td><td>${last}</td><td>${sponsor}</td><td>${review}</td></tr>`;
const boxesTable = `<div class="pa-chips" role="group" aria-label="Filter boxes by status">${fb("All (5)")}${fb("To review (1)", { on: true })}${fb("Needs help (3)")}${fb("Empty (1)")}${fb("Problem (1)")}${fb("Low (1)")}${fb("Quiet (0)", { dis: true })}${fb("OK (2)")}</div>
  <p style="margin:12px 0 8px;color:var(--color-ink-500)" aria-live="polite">Showing 5 of 5 boxes</p>
  <div class="pa-tw el"><table style="min-width:560px"><thead class="cap xs"><tr><th scope="col">Box</th><th scope="col">Status</th><th scope="col">Last report</th><th scope="col">Sponsor</th><th scope="col">To review</th></tr></thead><tbody>
  ${boxRow("Elm Street Blessing Box", "12 Elm St", "empty", "6 days ago", "Needs a sponsor", `<span style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500"><span style="width:48px;height:48px;border-radius:4px;border:1px solid var(--color-bone-200);background:var(--color-sage-100)"></span>Photo reported (2×)</span>`)}
  ${boxRow("Maple Court Blessing Box", "88 Maple Ct", "problem", "2 days ago", "The Ortiz family")}
  ${boxRow("Hillside Blessing Box", "5 Hillside Dr", "low", "Today", "Grace Bakery, Lopez family")}
  ${boxRow("Lakeview Blessing Box", "31 Lake Rd", "ok", "1 day ago", "Lakeview Neighbors, +2 more")}</tbody></table></div>`;
const evTag: Record<string, [string, string]> = { draft: ["Draft", "t-bone2"], published: ["Published", "t-sage"], cancelled: ["Cancelled", "t-clay"], archived: ["Archived", "t-bone"] };
const eventsTable = `<a class="pa-bp big pa-ring" href="#admin-lists" style="margin-bottom:16px">Add event</a>
  <div class="pa-tw"><table style="min-width:32rem"><thead class="plain"><tr><th scope="col">Event</th><th scope="col">Starts (Pueblo time)</th><th scope="col">Status</th><th scope="col"><span class="sr">Edit</span></th></tr></thead><tbody>
  ${([["Fall Turkey Drive", "Sat, Nov 21, 10:00 AM", "published"], ["Winter Coat and Food Giveaway", "Sat, Dec 12, 9:00 AM", "draft"], ["Harvest Pop-up Market", "Sat, Oct 10, 8:00 AM", "cancelled"]] as [string, string, string][]).map(([n, w, s]) => `<tr><td class="m9">${n}</td><td>${w}</td><td><span class="pa-tag round ${evTag[s][1]}">${evTag[s][0]}</span></td><td style="text-align:right"><a class="pa-tl" style="display:inline-flex;align-items:center" href="#admin-lists" aria-label="Edit ${n}">Edit</a></td></tr>`).join("")}</tbody></table></div>`;
const esubBody = `<div class="fly">Flyer</div><div class="txt"><h4>Community Soup Night</h4><p>Hosted by Grace Neighbors Church</p><p><span class="b9">Fri, Nov 20, 5:00 PM</span> to Fri, Nov 20, 7:00 PM (Pueblo time)</p><p><span class="b9">Grace Neighbors Church, </span>700 Example Blvd, Pueblo, CO 81004</p><p>Hot soup and bread for anyone who comes.</p><p><span class="pa-lab2">Bring </span>A bowl if you have one</p><p style="color:var(--color-ink-500)">Sent by Lee Park &lt;lee@example.com&gt; on Fri, Nov 6, 3:12 PM</p></div>`;
const esubToday = (live = false) => `<div class="pa-esub"><div class="in">${esubBody}</div><div class="pa-btns" style="margin-top:12px;gap:12px"><button type="button" class="pa-bp big pa-ring"${live ? say("Mockup: this would make a draft event and open it.") : ""}>Make it a draft event</button><button type="button" class="pa-bs ev pa-ring"${live ? say("Mockup: this would dismiss it.") : ""}>Dismiss</button></div></div>`;
const dotsMenu = (name: string) => `<div class="pa-dotw"><button type="button" class="dots pa-dots" aria-label="More for ${name}" aria-expanded="false" aria-haspopup="menu">⋮</button><div class="menu" role="menu"><button type="button" role="menuitem" data-say="Mockup: this would make a draft event and open it.">Make it a draft event</button><hr><button type="button" role="menuitem" class="dng" data-say="Mockup: this would dismiss it.">Dismiss</button></div></div>`;
const esubDots = `<div class="pa-esub"><div class="in">${esubBody}${dotsMenu("Community Soup Night")}</div></div>`;

const listsEntry = entry({
  id: "admin-lists", name: "Lists and tables (VenueListView, AllBoxesTable, EventsList, EventSubmissionsList)", status: "changing",
  statusNote: "What changes: the pointer-over fill on a Places row and on the filter chips becomes the light green tint (sage 100) in place of the grey (bone 100); the public's shared events keep their two actions in one three-dot menu per item (owner's ruling: per-row actions in one three-dot menu). Everything else is the lists as they are live today.",
  purpose: "Every place, box and event in one table each, with chips to narrow it, a search box, and the name as the way into its edit page. Places adds a key that explains each status; Blessing Boxes sorts the boxes that need help to the top; Events lists the public's shared events above the table.",
  instead: [
    "It's one item waiting on a decision: use a change card, which has room for the details.",
    "It's a total to watch: use a dashboard number.",
    "It's picking one of two or three views: a slider.",
  ],
  versions:
    wide("Places (VenueListView): the status key, the quick filters, search and category, then the table. The table is 680 pixels wide, so on a phone it scrolls sideways inside its own box; the page doesn't. Point at a row.", `<div style="display:flex;flex-direction:column;gap:12px">${statusKey}${placesChips}${placesSearch}${placesTable()}<p class="pa-meta" style="margin-top:0">4 of 48 places</p></div>`) +
    wide("Blessing Boxes (AllBoxesTable): status filters with counts (an empty one can't be pressed), then the boxes. The Low tag is the known contrast failure below.", boxesTable) +
    wide("Events (EventsList): Add event, then the table with one Edit link per row.", eventsTable) +
    wide("Sent in by the public (EventSubmissionsList), live today: two buttons on each item.", `<h3 class="wm" style="font-size:18px;line-height:28px;margin-bottom:12px">Sent in by the public</h3>${esubToday(true)}`) +
    wide("Ruling version: both actions in one three-dot menu, Dismiss last under a line. Tap the dots.", `${newTag}${esubDots}`),
  states:
    demo("Places filter chip: resting, pointer over it (sage 100, proposed; point at it), live today (bone 100), keyboard, on", `<div class="pa-chips">${chip("Draft (2)")}${chip("Draft (2)", false, "is-hover")}${chip("Draft (2)", false, "is-livehover")}${chip("Draft (2)", false, "is-focus")}${chip("To review (12)", true)}</div>`) +
    demo("Boxes filter: resting, pointer over it (sage 100, proposed), live today, keyboard, on, none to show", `<div class="pa-chips">${fb("Low (1)")}${fb("Low (1)", { cls: "is-hover" })}${fb("Low (1)", { cls: "is-livehover" })}${fb("Low (1)", { cls: "is-focus" })}${fb("To review (1)", { on: true })}${fb("Quiet (0)", { dis: true })}</div>`) +
    wide("A Places row: resting, pointer over it (sage 100, proposed), live today (bone 100). The name link with the keyboard ring.", `<div class="pa-tw"><table style="min-width:520px"><tbody class="b2">${vRow({ name: "Mesa Street Community Garden", cat: "Community Garden", st: "live", addr: "300 Mesa St", ver: "Sep 14, 2026" })}${vRow({ name: "Mesa Street Community Garden", cat: "Community Garden", st: "live", addr: "300 Mesa St", ver: "Sep 14, 2026", cls: "is-hover" })}${vRow({ name: "Mesa Street Community Garden", cat: "Community Garden", st: "live", addr: "300 Mesa St", ver: "Sep 14, 2026", cls: "is-livehover" }).replace('class="nm"', 'class="nm is-focus"')}</tbody></table></div>`) +
    demo("Nothing matches", `<p style="width:100%;border-radius:14px;border:1px solid var(--color-bone-200);background:#fff;padding:48px 16px;text-align:center;color:var(--color-ink-500)">No venues match your search.</p>`) +
    demo("Every status tag on Places and Boxes", `<div class="pa-btns">${stTag("draft")}${stTag("live")}${stTag("waiting")}${stTag("removed")}${Object.values(BOX_ST).map(([l, c]) => `<span class="pa-tag ${c}">${l}</span>`).join("")}</div>`),
  colors:
    swr("Ink 400", "color-ink-400", "Column headings in small capitals, and the count under the table") +
    swr("Sage 700", "color-sage-700", "Names (the edit links) and Edit") +
    swr("Ink 500", "color-ink-500", "Address and last-verified columns") +
    sw("Clay 100", "color-clay-100", `Tags that need a look. Clay 700 (Live · edits waiting, Problem, Public) ${r("color-clay-700", "color-clay-100")}; danger red (Empty) ${r("color-danger", "color-clay-100")}; <b>warning amber (Low) ${r("color-warning", "color-clay-100")}, under 4.5 to 1</b>`) +
    sw("Sage 100", "color-sage-100", `OK, Live and Published tags, sage 700 words ${r("color-sage-700", "color-sage-100")}; the chip that's on; and the proposed fill under the pointer on rows and chips (ink 700 words ${r("color-ink-700", "color-sage-100")}, ink 500 ${r("color-ink-500", "color-sage-100")})`) +
    sw("Yellow", "color-brand-yellow", `Draft on Places. Ink 900 words ${r("color-ink-900", "color-brand-yellow")}`) +
    sw("Bone 200", "color-bone-200", `Draft on Events, ink 700 words ${r("color-ink-700", "color-bone-200")}; also the table's edge and row lines (decoration)`) +
    sw("Bone 100", "color-bone-100", `Removed, Quiet and Archived tags, ink 500 words ${r("color-ink-500", "color-bone-100")}; live, the fill under the pointer`) +
    sw("Bone 300", "color-bone-300", `Chip and search box edges, ${r("color-bone-300", "white", 3)} on white (edge)`) +
    swr("Sage 500", "color-sage-500", "The edge of the chip that's on, and keyboard rings", "white", 3),
  sizes: "Tables: 14-pixel words, cells 12 by 16 pixels, headings 11 or 12-pixel capitals, corners 14, at least 680 (Places), 560 (Boxes) or 512 (Events) pixels wide inside a box that scrolls sideways. Places chips are 12-pixel words, about 26 pixels tall; Boxes filters are 14-pixel words, 48 tall. Tags 12 pixels: fully round on Places and Events, 4-pixel corners on Boxes. Edit links and shared-event buttons are 48 tall. Three-dot button (ruling version) 48 by 48.",
  wording: [
    "Filters show their count: To review (12), Low (1). Statuses are one or two words, explained once in the Places key.",
    "Last report reads Today, 1 day ago, 6 days ago, or No reports yet. A box with no sponsor says Needs a sponsor.",
    "Nothing found: No venues match your search. No boxes match these filters.",
  ],
  everyone: [
    "Keyboard: filters, then search, then each row's link. Box filters say whether they're pressed; one with nothing in it is skipped.",
    "Screen reader: real tables with column headings; Showing 5 of 5 boxes is announced as filters change; Edit links name their event (Edit Fall Turkey Drive).",
    "Touch: Boxes filters and Edit links are 48 pixels. On a phone the wide tables scroll sideways inside their own box.",
    "Color is never the only sign: every status is a word.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%"><div class="pa-esub"><div class="pa-row atop"><h4 style="font-size:16px;line-height:24px;font-weight:600;color:var(--color-ink-900);padding-top:12px">Community Soup Night</h4>${dotsMenu("Community Soup Night")}</div></div></div>`, "One three-dot menu per item, the risky choice last."],
    [`<div class="pa" style="width:100%"><div class="pa-esub"><h4 style="font-size:16px;font-weight:600;color:var(--color-ink-900)">Community Soup Night</h4><div class="pa-btns" style="margin-top:12px"><button type="button" class="pa-bp big">Make it a draft event</button><button type="button" class="pa-bs ev">Edit</button><button type="button" class="pa-bs ev">Dismiss</button><button type="button" class="pa-bs ev">Email sender</button></div></div></div>`, "A row of buttons on every item. A long list becomes a wall of buttons."],
  ),
  code: [
    "src/components/VenueListView.tsx. Proposed change: the rows' hover:bg-[var(--color-bone-100)] and filterChipClass's hover:bg-[var(--color-bone-100)] become sage 100. Known live issue: filterChipClass chips are about 26 pixels tall (px-3 py-1 text-xs), under the 48-pixel floor. Open question: the Category column is plain ink 700 words; the category-label ruling (colored words, as on the place card) may or may not apply to a table cell",
    "src/components/AllBoxesTable.tsx. Known live issue: the Low tag (line 37) is warning amber on clay 100, 4.0 to 1, under the 4.5 to 1 words need. Its filter buttons' hover is bone-100 too",
    "src/components/EventsList.tsx",
    "src/components/EventSubmissionsList.tsx. Ruling change: Make it a draft event and Dismiss move into one three-dot menu per item",
    "src/lib/adminVenues.ts (DISPLAY_STATUS_LABELS, DISPLAY_STATUS_KEY)",
  ],
});

// ── Dashboard numbers (DashboardNeedsStrip, KpiCard, DailyBars, BarList, BoxReportsChart) ────────────────────
const need = (label: string, n: number, detail = "", cls = "") => `<a class="pa-need${cls ? ` ${cls}` : ""}" href="#admin-dash"><span class="l">${label}</span><span class="n${n === 0 ? " zero" : ""}">${n}</span>${detail ? `<span class="x">${detail}</span>` : ""}</a>`;
const needsStrip = `<div class="pa-needs">${need("Places to review", 14, "3 from the public, 11 from data refresh")}${need("Waiting to publish", 5)}${need("Box photos &amp; sponsor requests", 3, "2 photos, 1 sponsor requests")}${need("Boxes empty or low", 0)}</div>`;
const spark = (pts: number[]) => { const w = 64, h = 20, mx = Math.max(...pts), mn = Math.min(...pts), rg = mx - mn || 1, st = w / (pts.length - 1); return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts.map((p, i) => `${i * st},${h - ((p - mn) / rg) * h}`).join(" ")}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`; };
const kpi = (label: string, val: string, d?: [string, "up" | "down" | "flat"], about = false, sp?: number[]) => `<div class="pa-kpi"><p class="l">${label}</p><div class="v"><p class="n">${about ? '<span class="ab">about</span>' : ""}${val}</p>${d ? `<span class="d ${d[1]}">${d[0]}</span>` : ""}</div>${sp ? spark(sp) : ""}</div>`;
const DAILY = [12, 18, 15, 22, 9, 7, 25, 31, 28, 19, 14, 16, 20, 33, 27, 24, 18, 11, 10, 21, 26, 29, 35, 30, 22, 17, 15, 19, 28, 32];
const daily = `<svg class="pa-daily" viewBox="0 0 300 60" role="img" aria-label="Visitors per day, Oct 9 to Nov 7">${DAILY.map((v, i) => { const s = 300 / DAILY.length, bh = (v / 35) * 60; return `<rect x="${(i * s).toFixed(1)}" y="${(60 - bh).toFixed(1)}" width="${(s * 0.8).toFixed(1)}" height="${bh.toFixed(1)}" fill="currentColor"><title>Day ${i + 1}: ${v}</title></rect>`; }).join("")}</svg>`;
const bars = (items: [string, number, string][], links = false) => { const mx = Math.max(...items.map((i) => i[1])); return `<ul class="pa-bars">${items.map(([l, v, d]) => `<li>${links ? `<a class="lb" href="#admin-dash" title="${l}">${l}</a>` : `<span class="lb" title="${l}">${l}</span>`}<span class="tr"><i style="width:${Math.max((v / mx) * 100, 4)}%"></i></span><span class="vl">${d}</span></li>`).join("")}</ul>`; };
const WEEKS: [string, number, number][] = [["Sep 14", 18, 2], ["Sep 21", 22, 1], ["Sep 28", 15, 4], ["Oct 5", 25, 0], ["Oct 12", 20, 3], ["Oct 19", 27, 2], ["Oct 26", 19, 5], ["Nov 2", 24, 1]];
const weeks = `<div class="pa-weeks">${WEEKS.map(([w, ok, tr]) => `<div><div class="bar" style="height:${((ok + tr) / 29) * 100}%" role="img" aria-label="Week of ${w}: ${ok} OK, ${tr} needing attention">${tr ? `<i class="tb" style="flex-grow:${tr}"></i>` : ""}<i class="ob" style="flex-grow:${ok}"></i></div><span>${w}</span></div>`).join("")}</div>
  <div class="pa-legend"><span><i style="background:var(--color-sage-500)"></i>OK</span><span><i style="background:var(--color-clay-500)"></i>Needs attention</span></div>`;

const dashEntry = entry({
  id: "admin-dash", name: "Dashboard numbers (DashboardNeedsStrip, KpiCard, DailyBars, BarList, BoxReportsChart)", status: "changing",
  statusNote: "What changes: the pointer-over fill on the Needs you cards becomes the light green tint (sage 100) in place of the grey (bone 100). Everything else is the numbers as they are live today, with made-up figures.",
  purpose: "The Dashboard's numbers: first the four Needs you cards (what's waiting on a person, each one a way into that list), then plain number cards with the change since the last period, and three small charts: visitors per day, ranked bars (where people came from, which places were opened, what they searched), and blessing box reports per week.",
  instead: [
    "It's one thing to act on: use a change card or a list, not a number.",
    "It needs exact rows: use a table; these charts only show the shape.",
  ],
  versions:
    wide("Needs you (DashboardNeedsStrip): one column on a phone, two from 640 pixels, four from 1024. Each card is a link. Point at one.", needsStrip) +
    wide("Number cards (KpiCard), two across on a phone, four from 640. about marks a sampled number; the change is green when up, red when down; new when there was nothing before.", `<div class="pa-kgrid">${kpi("Visitors", "214", ["+12.5%", "up"], true)}${kpi("Page views", "655", ["-3.1%", "down"], true)}${kpi("Near me taps", "96", ["new", "up"], false, [2, 5, 4, 8, 7, 11, 9])}${kpi("On a phone", "81%", undefined, true)}</div>`) +
    wide("Visitors per day (DailyBars), inside its section card", `<section class="pa-sec"><h2 class="wm">Visitors</h2><div style="margin-top:12px"><h3>Visitors per day</h3>${daily}</div></section>`) +
    mid("Ranked bars (BarList). Plain names, or links to a place's edit page.", `<h3 style="font-size:14px;font-weight:500;margin-bottom:4px">How people found the site</h3>${bars([["Google", 58, "58 visits"], ["Facebook", 21, "21 visits"], ["Direct", 17, "17 visits"], ["pueblo-example.org", 6, "6 visits"]])}<h3 style="font-size:14px;font-weight:500;margin:16px 0 4px">Most opened places</h3>${bars([["Eastside Community Pantry", 41, "41 opens"], ["Mesa Street Community Garden", 23, "23 opens"]], true)}`) +
    mid("Box reports per week (BoxReportsChart): OK in green, needs attention in clay, 8 weeks", weeks),
  states:
    demo("Needs you card: resting", need("Waiting to publish", 5)) +
    demo("Pointer over it: sage 100 (proposed; point at it). Live today: bone 100.", need("Waiting to publish", 5, "", "is-hover")) +
    demo("Live today, for comparison", need("Waiting to publish", 5, "", "is-livehover")) +
    demo("Reached by keyboard: the browser's own outline (no green ring on this card)", need("Waiting to publish", 5, "", "is-focus")) +
    demo("Nothing waiting: the number turns ink 500", need("Boxes empty or low", 0)) +
    demo("Change since last period: up, down, new, no comparison", `<div style="display:flex;gap:16px;font-size:12px;font-weight:500"><span style="color:var(--color-sage-700)">+12.5%</span><span style="color:var(--color-danger)">-3.1%</span><span style="color:var(--color-sage-700)">new</span><span style="color:var(--color-ink-500);font-weight:400">—</span></div>`) +
    demo("No data yet", `<p style="color:var(--color-ink-500);margin:0">No visitor data yet for this period.</p>`),
  colors:
    swr("Ink 500", "color-ink-500", "Card labels in small capitals, about, the breakdown line, a zero, chart legends") +
    swr("Ink 900", "color-ink-900", "The numbers") +
    swr("Sage 700", "color-sage-700", "Up and new; place-name links") +
    swr("Danger red", "color-danger", "Down") +
    swr("Sage 500", "color-sage-500", "Sparkline, daily bars and OK in the weekly chart", "white", 3) +
    swr("Clay 500", "color-clay-500", "Needs attention in the weekly chart", "white", 3) +
    sw("Sage 600", "color-sage-600", `Ranked bars, on a bone 100 track: ${r("color-sage-600", "color-bone-100", 3)} (edge)`) +
    swr("Ink 400", "color-ink-400", "Week labels, 10 pixels") +
    sw("Sage 100", "color-sage-100", `Fill under the pointer on a Needs you card (proposed; live is bone 100). Ink 900 numbers ${r("color-ink-900", "color-sage-100")}, ink 500 labels ${r("color-ink-500", "color-sage-100")}`),
  sizes: "Cards: corners 14, 16 pixels of padding (section cards 24 from 640 wide), the card shadow, 12 pixels apart. Labels 12-pixel capitals; numbers 24 pixels semi-bold; changes 12. Sparkline 64 by 20. Daily bars 64 pixels tall, full width. Ranked bars: names 112 pixels wide (cut with … when long), an 8-pixel track, values in a 64-pixel column. Weekly chart 128 pixels tall, week labels 10 pixels.",
  wording: [
    "Labels name the thing in plain words: Places to review, Waiting to publish, Boxes empty or low, Near me taps, Phone page load.",
    "Sampled numbers say about. Changes are a percent with a sign, or new. Missing numbers show —.",
    "Empty charts say why: No visitor data yet for this period. No box reports in the last 8 weeks.",
  ],
  everyone: [
    "Keyboard: each Needs you card is one link; it shows the browser's own outline, not the green ring.",
    "Screen reader: the daily chart is one picture with a summary (Visitors per day, Oct 9 to Nov 7); each week's bar says its counts (Week of Oct 26: 19 OK, 5 needing attention). The sparkline is hidden: the number says it all.",
    "Touch: every Needs you card is far taller than 48 pixels.",
    "Color is never the only sign: up and down carry a + or -; the weekly chart has a legend in words.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%">${kpi("Visitors", "214", ["+12.5%", "up"], true)}</div>`, "The number big, the change small beside it, and about when it's sampled."],
    [`<div class="pa" style="width:100%"><div class="pa-kpi"><p class="l">Visitors</p><div class="v"><p class="n" style="color:var(--color-sage-700)">214</p></div></div></div>`, "Coloring the number itself to say good or bad, with no sign. Color alone doesn't tell anyone it went up."],
  ),
  code: [
    "src/components/DashboardNeedsStrip.tsx. Proposed change: hover:bg-[var(--color-bone-100)] becomes sage 100. Known live issue: no focus-visible style, so the keyboard sees only the browser's outline",
    "src/components/KpiCard.tsx. Known live issue, seen in this copy at 360 wide and not yet checked on the site: two cards across a phone leave about 110 pixels inside each, and about 655 -3.1% needs about 130, so it runs past the card's edge (the number row doesn't wrap)",
    "src/components/DailyBars.tsx, BoxReportsChart.tsx",
    "src/components/BarList.tsx",
    "src/app/(site)/admin/page.tsx (labels and layout)",
  ],
});

// ── Archive confirm (ArchiveVenueButton) ──────────────────────────────────────────────────────────────────────
const ARCHIVE_TEXT = 'Remove "Eastside Community Pantry" from the map? It will stop appearing on the next publish, but its record is kept, not deleted, and this can be reviewed later.';
const archiveBtn = (o: { busy?: boolean; cls?: string; live?: boolean } = {}) => `<button type="button" class="pa-bd pa-ring${o.cls ? ` ${o.cls}` : ""}"${o.busy ? " disabled" : ""}${o.live ? ` onclick="${q(`if(confirm(${JSON.stringify(ARCHIVE_TEXT)}))this.closest('.pa').querySelector('.pa-note').hidden=false`)}"` : ""}>${o.busy ? "Removing…" : "Remove from map"}</button>`;
const dangerZone = (inner: string) => `<div class="pa-danger"><h2>Danger zone</h2>${inner}</div>`;
const ruleConfirm = (live = false) => `<div class="pa-confirm" role="group" aria-labelledby="pa-cf-${++uid}"><p class="t" id="pa-cf-${uid}">Remove Eastside Community Pantry from the map?</p>
  <p>It will stop appearing on the next publish. Its record is kept, not deleted, and this can be reviewed later.</p>
  <div class="two"><button type="button" class="pa-bs tall pa-ring"${live ? ` onclick="${q("const z=this.closest('.pa-danger');z.querySelector('.pa-confirm').hidden=true;z.querySelector('.open').hidden=false")}"` : ""}>Cancel</button><button type="button" class="pa-bd tall pa-ring"${live ? say("Mockup: nothing is removed.") : ""}>Remove from map</button></div></div>`;
const ruleLive = dangerZone(`<button type="button" class="pa-bd tall wide4 pa-ring open" onclick="${q("this.hidden=true;this.closest('.pa-danger').querySelector('.pa-confirm').hidden=false")}">Remove from map</button>${ruleConfirm(true).replace('<div class="pa-confirm"', '<div class="pa-confirm" hidden')}`);

const archiveEntry = entry({
  id: "admin-archive", name: "Archive confirm (ArchiveVenueButton)", status: "changing",
  statusNote: "What changes: the browser's own pop-up question becomes a box on the page that says exactly what happens, with Cancel first (owner's ruling for a risky action: say what will happen, safe button first). The red button itself stays.",
  purpose: "Takes a place off the public map without deleting it. It sits alone under Danger zone at the foot of a place's edit page. Because it changes what the public sees, it asks first.",
  instead: [
    "It's a data check suggesting a place closed: use its change card (Archive this venue), so the reason stays with it.",
    "It's an event: Archive event on the event's page. A cancelled event uses Cancel event, which keeps it on the map with a note.",
    "It's a box that stopped being used: the same button; the box shows Removed from service in its list.",
  ],
  versions:
    mid("Live today. Tap it: the browser's own box asks, with the live words (nothing is removed here).", `<div class="pa">${dangerZone(archiveBtn({ live: true }))}<p class="pa-note" hidden style="margin-top:8px;color:var(--color-ink-500)">Mockup: nothing is removed.</p></div>`) +
    mid("Live today, drawn: what the browser's box looks like. Its look, its buttons and their order are the browser's, not ours.", `<div class="pa-native" role="img" aria-label="The browser's confirm box"><b>pueblofoodmap.com says</b>${ARCHIVE_TEXT}<div class="nb"><span>Cancel</span><span class="ok">OK</span></div></div>`) +
    mid("Ruling version. Tap Remove from map: the box opens on the page, Cancel first.", `${newTag}${ruleLive}`) +
    mid("Ruling version, open", `${newTag}${dangerZone(ruleConfirm())}`),
  states:
    demo("Remove from map: resting, pointer over it (fills red), keyboard (a red ring)", `<div class="pa-btns">${archiveBtn()}${archiveBtn({ cls: "is-hover" })}${archiveBtn({ cls: "is-focus" })}</div>`) +
    demo("Working: Removing…, faded", archiveBtn({ busy: true })) +
    demo("Failed: the reason in red under the button", `<div>${archiveBtn()}<p role="alert" style="margin-top:8px;color:var(--color-danger)">Something went wrong. The venue was not removed. Try again.</p></div>`) +
    demo("Already off the map: a plain line, no button", `<p style="color:var(--color-ink-500);margin:0">This venue is removed from the map.</p>`),
  colors:
    swr("Danger red", "color-danger", "The button's words and edge, the ruling box's edge, errors") +
    sw("Danger red fill", "color-danger", `The button under the pointer. Bone 50 words ${r("color-bone-50", "color-danger")}`) +
    swr("Ink 700", "color-ink-700", "Danger zone heading and the ruling box's words") +
    swr("Ink 900", "color-ink-900", "The ruling box's question") +
    swr("Ink 500", "color-ink-500", "This venue is removed from the map") +
    sw("Bone 300", "color-bone-300", `Cancel's edge in the ruling box, decoration (${contrast(H("color-bone-300"), H("white")).toFixed(1)} to 1): its word carries it`),
  sizes: "Danger zone: a bone 200 line, 24 pixels above the heading (14 pixels, semi-bold), 8 below. The live button: 14-pixel words, 6 by 12 padding, corners 10, about 34 pixels tall. Ruling version: the box has a 1-pixel red edge, corners 10, 16 pixels of padding; Cancel and Remove from map share the row half and half, both 48 pixels tall.",
  wording: [
    "The button says what it does to the public: Remove from map, not Archive or Delete.",
    "The question names the place and says exactly what happens and what doesn't: it stops appearing on the next publish; the record is kept, not deleted.",
    "Working: Removing…. Failed: Something went wrong. The venue was not removed. Try again.",
  ],
  everyone: [
    "Keyboard: in the ruling version the box opens right after the button; Cancel comes first, so Enter on the first button never removes anything.",
    "Screen reader: the ruling box is a labelled group read from its question; errors are read out at once. The browser's own box today is read by the browser.",
    "Touch: the ruling version's buttons are 48 pixels, side by side, half the row each.",
    "Color is never the only sign: the button and the box say Remove from map in words.",
  ],
  dd: dodont(
    [`<div class="pa" style="width:100%">${ruleConfirm()}</div>`, "Name the place and say what happens; the safe button first."],
    [`<div class="pa" style="width:100%"><div class="pa-confirm"><p class="t">Are you sure?</p><div class="two"><button type="button" class="pa-bd tall">Yes</button><button type="button" class="pa-bs tall">No</button></div></div></div>`, "Are you sure? Yes / No. Nobody knows what Yes does, and the risky button comes first."],
  ),
  code: [
    "src/components/ArchiveVenueButton.tsx. Ruling change: window.confirm (line 58) becomes an on-page confirm, Cancel first. Known live issue: its dangerButtonClass (line 42) has no min-h-12, so the button is about 34 pixels tall",
    "src/app/(site)/admin/venues/[id]/edit/page.tsx (the Danger zone around it)",
    "The same browser box asks in ProposalCard.tsx (line 261), PublishPanel.tsx (156), ToReviewSummaryBox.tsx (77), EventForm.tsx (372, Archive event) and EventFlyerField.tsx (137, Remove this flyer?). Not changed here; the same ruling would apply, for the owner to decide",
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
  ["admin-archive", "Archive confirm", archiveEntry],
];

export const pages: Page[] = [{
  slug: "components-admin", route: "DESIGN.md → Components (admin)", title: "Design system: Components, admin", area: "Design system", nav: "Components",
  blurb: "The admin's pieces: menu, sign-in, cards, publish bar, change cards, form fields, lists, dashboard numbers and the archive confirm.",
  changed: [
    "Grey pointer-over fills become the light green tint (sage 100), as on the public map: menu tabs, Use a passkey, Reject and Cancel, Places rows and filter chips, Boxes filters, the Needs you cards.",
    "Save changes on a place's edit page gets a Cancel beside it.",
    "The public's shared events keep their two actions in one three-dot menu per item.",
    "Remove from map asks with a box on the page, Cancel first, in place of the browser's pop-up.",
    "Everything else is what's live, with made-up people, places and numbers.",
  ],
  kept: ["Only staff see these pages, after signing in.", "The admin is English only.", "The phone view is 360 pixels wide."],
  check: [
    "The Low tag on Blessing Boxes is 4.0 to 1, under 4.5: shown as it is, not recolored.",
    "Shared events: the two buttons are each item's decision, like Approve and Reject on a change card. The three-dot ruling is applied here; say if they should stay as buttons.",
    "Archive confirm: the ruling version beside today's browser pop-up.",
    "Places rows: with the green tint under the pointer, the Live tag's own sage 100 fill disappears into the row; its words still read (7.5 to 1).",
  ],
  html: `<div class="head"><h1>Components, admin</h1></div>
  ${toc([["components.html", "← Components"], ...all.map(([id, n]) => [`#${id}`, n] as [string, string])])}
  ${all.map(([, , h]) => h).join("")}`,
}];
