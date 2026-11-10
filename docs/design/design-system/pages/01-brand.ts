// Design system: Brand and feel. The feel ("Civic Editorial", from DESIGN.md Overview), who it's for, the concrete
// reference behind the look, the logo rules, the settled brand decisions, the mission and vision word for word from
// the About page, the four draft brand values, the five building principles, and the one-line voice. Mission, vision and values live in the brand
// note in the knowledge base (private: never name its path on this public page). CSS: mock.css "patterns-brand".
import { b, dsSec, hex, ratio, sw, toc, ul, type Page, type Token } from "../lib";

const PAPER = hex("color-bone-50");
const r = (fg: Token | "white", bg: Token | "white", need: 4.5 | 3 = 4.5) => ratio(fg === "white" ? "#FFFFFF" : hex(fg), bg === "white" ? "#FFFFFF" : hex(bg), need);
/** The wordmark as the site draws it: live text, Fraunces 700, 0.04em letter spacing (globals.css @utility wordmark). */
const wm = (cls = "") => `<span class="pb-wm${cls ? ` ${cls}` : ""}">Pueblo Food Map</span>`;
/** The app icon's pin mark (src/app/apple-icon.png, public/icons/): an orange pin with a white edge and a white dot,
 *  on sage 600. Drawn here so no new image file is needed. */
const pinMark = (size = 96) => `<svg class="pb-pinmark" width="${size}" height="${size}" viewBox="0 0 96 96" role="img" aria-label="The app icon: an orange map pin on green"><rect width="96" height="96" rx="20" fill="var(--color-sage-600)"/><path d="M48 18c-11.6 0-21 9.2-21 20.6C27 54 48 78 48 78s21-24 21-39.4C69 27.2 59.6 18 48 18z" fill="var(--color-brand-orange)" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><circle cx="48" cy="38" r="8" fill="#fff"/></svg>`;
const proposed = `<span class="pb-prop">Draft: to review with the Pueblo Food Project team</span>`;

const feel = dsSec({
  id: "feel", name: "The feel: Civic Editorial",
  body: `<p class="dsp">“Think of a well-typeset community bulletin printed on cream paper: readable at a glance, trustworthy, not slick.” (DESIGN.md, Overview)</p>
  <div class="bfeel"><div class="pb-feelcard">${wm("md")}<small>A free, community-built map of food resources across Pueblo County.</small></div>
  <div class="bf-words">${["Readable at a glance", "Trustworthy", "Not slick", "Warm cream paper", "Plain words"].map((w) => `<span>${w}</span>`).join("")}<p class="pnote">It is never: a glossy app with cool greys, a dark mode, or decorative pictures. Every color is warm, and the only pictures are the ones people send in.</p></div></div>
  <h3>Two looks, one family</h3>${ul([
    "<b>Public site:</b> the map fills the screen, with a search bar on top and the bottom bar under the thumb. Everything else is a card or a single column of text.",
    "<b>Admin:</b> the same paper, fonts and greens, with denser lists and forms. Staff are getting work done.",
  ])}`,
});

const who = dsSec({
  id: "who", name: "Who it's for",
  body: `<div class="bwho">${[
    ["Neighbors looking for food", "People facing food insecurity in Pueblo County. Often on an older Android phone, on slow or metered data, using one hand, in English or Spanish. They want the nearest place that's open, and how to get there."],
    ["Neighbors who help", "People who suggest a place, fill or check a blessing box, share a food event, or report something that's wrong."],
    ["Partners and food-bank staff", "On the admin: keeping places, boxes and events right, and reviewing what the public and the weekly data check send in."],
  ].map(([t, d]) => `<div><b>${t}</b><small>${d}</small></div>`).join("")}</div>
  <p class="dssz">The baseline phone is 360 pixels wide, two to three years old, on a slow connection (DESIGN.md, Low-end device guardrails). Every page on this site is checked at that size.</p>`,
});

const reference = dsSec({
  id: "reference", name: "The look comes from",
  purpose: "A community bulletin printed on cream paper. DESIGN.md calls the mix Civic Editorial: an editorial display serif for headlines, over the plain, high-contrast body type of a public-service site.",
  body: `<div class="pb-bulletin"><b class="pb-bh">Food Pantry</b><p>Bring a bag. Fresh produce on the first Saturday of each month while it lasts.</p><small>Fraunces for headlines · Public Sans for everything else · bone 50 paper</small></div>
  ${ul([
    "<b>Headlines</b> in Fraunces, a display serif: the wordmark, place names, page titles. Never for running text at 16 pixels or smaller.",
    "<b>Everything else</b> in Public Sans, with the plain posture of a public-service site: high contrast, nothing decorative. Body words aim for 7 to 1; ink 700 on the paper is " + r("color-ink-700", "color-bone-50", 4.5) + ".",
    "<b>Warm neutrals:</b> the paper is bone 50 (" + PAPER + "), the words are warm inks, never a cool grey.",
    "<b>The map is the picture.</b> Category colors on the pins do the work photos would do on another site.",
  ])}`,
});

const logo = dsSec({
  id: "logo", name: "Logo",
  note: `A logo is being chosen: see <a href="logo.html">Logo options</a>.`,
  purpose: "The logo is the name itself, set in Fraunces. It is live text, not a picture, so it is sharp on every screen and costs no data. The app icon is the brand's pin.",
  body: `<div class="pb-logos">
    <figure><div class="pb-lg map">${wm("lg navy outline")}</div><figcaption><b>On the welcome screen</b> Navy, bold, with a thin white outline because the live map shows through behind it. 36 pixels on phones, 60 from 768 pixels wide. Navy on the cream paper: ${r("color-brand-navy", "color-bone-50")}.</figcaption></figure>
    <figure><div class="pb-lg paper"><span class="pb-wm sm ink">Pueblo Food Map Admin</span></div><figcaption><b>The admin's top bar</b> Pueblo Food Map Admin, the same lettering at regular weight, ink 900, 24 pixels: ${r("color-ink-900", "color-bone-50")}.</figcaption></figure>
    <figure><div class="pb-lg sage">${pinMark()}</div><figcaption><b>On green: the pin, not the name</b> The live site never sets the name on sage. On green the brand is the app icon: an orange pin with a white edge and a white dot on sage 600. The white edge on sage: ${r("white", "color-sage-600", 3)}.</figcaption></figure>
  </div>
  <h3>Rules</h3>${ul([
    "Always Fraunces with its 0.04em spacing, from the shared <code>wordmark</code> style: bold on the welcome screen, regular in the admin. Never another font, never stretched or squashed.",
    "Navy on light paper; ink 900 in the admin. No other colors, no gradients, no shadows. The one effect is the welcome screen's thin white outline over the map.",
    "On sage, use the pin mark. The pale wordmark on green in this kit's left menu is a mockup choice only; the live site doesn't have it.",
    "Sized to stay on one line: 36 pixels fits a 375-pixel phone (Wordmark.tsx), which is why phones get the smaller size.",
    "Keep it clear of pins and the map's edge. Nothing overlaps it.",
  ])}
  <h3>Known live issue</h3>${ul([
    "The link preview image (public/og-image.png) runs the word Map past the cream half onto the green map, under a pin, and has a gradient stripe along its top. It breaks the last two rules; listed, not changed here.",
  ])}`,
});

const CATS: [string, Token][] = [["Food Pantry", "color-cat-pantry"], ["Grocery / Supermarket", "color-cat-grocery"], ["Convenience Store", "color-cat-convenience"], ["Farm / Market", "color-cat-farm"], ["Community Garden", "color-cat-garden"], ["Edible Landscape", "color-cat-landscape"], ["Meal Site", "color-cat-meal"], ["Blessing Box", "color-cat-blessing"]];
const decisions = dsSec({
  id: "decisions", name: "Settled brand decisions",
  note: "Already decided and live. They change only on a new ruling.",
  body: `<ol class="frules">
    <li><b>One orange action per screen.</b> Orange means “find food”. It is on the welcome screen's Find food near me (one button per language, the same action), Try again when the phone couldn't find you, and the Filters panel's Show 24 places. The one owner-approved exception is the event card's Get directions, with the event star pin and the happening-today strip. Navy words on orange: ${r("color-brand-navy", "color-brand-orange")}.</li>
    <li><b>Category colors.</b> Each of the eight kinds of place has its own color, on its pin and on its words, so a pantry and a garden can be told apart at arm's length. Nothing else uses them, and grocery's blue is never a link.</li>
    <li><b>No decorative pictures.</b> No photos, illustrations or hero images. The only pictures are ones people send in: a blessing box's approved photos and an event's flyer, and they load only when that card opens.</li>
    <li><b>The map is the product.</b> Everything around it (the search bar, the bottom bar, the cards) helps someone find food and get there, and stays under a tenth of the screen when nothing is open.</li>
  </ol>
  <h3>The eight category colors</h3><p class="dssz">Each one carries words on the cream paper (the category line under a place's name), so each needs 4.5 to 1.</p>
  <ul class="sws">${CATS.map(([n, t]) => sw(n, t, `${r(t, "color-bone-50")} on bone 50`)).join("")}</ul>`,
});

const mission = dsSec({
  id: "mission", name: "Mission, vision and values",
  note: "Kyle kept the mission and vision exactly as the About page says them (2026-11-08). They are copied here word for word from the live page. The four brand values are drafts (2026-11-09) until Kyle goes over them with the Pueblo Food Project team. All three live in the brand note in the knowledge base.",
  body: `<div class="bmvv"><div><h3>Mission</h3><p class="bbig">Pueblo Food Map puts every free and low-cost food resource in Pueblo County on one mobile-friendly map — so anyone, in any neighborhood, can find what they need in minutes.</p><small>About page, Our mission. <span class="pb-flag">Breaks a ruling: long dash</span> The brand note has a comma there instead.</small></div>
  <div><h3>Vision</h3><p class="bbig">A Pueblo County where no one goes hungry because they couldn't find the resources already available in their community.</p><small>About page, Our vision.</small></div></div>
  <h3>Brand values ${proposed}</h3><div class="bvals">${[
    ["Dignity first.", "Looking for food is normal. Nobody has to explain themselves or prove anything."],
    ["Neighbors helping neighbors.", "Made in Pueblo, for Pueblo, alongside the pantries and volunteers already doing the work."],
    ["Everyone is welcome.", "Every neighborhood, both languages, any phone."],
    ["Worth trusting.", "We say what we know and admit what we don't, so no one makes a wasted trip."],
  ].map(([t, d]) => `<div><b>${t}</b><small>${d}</small></div>`).join("")}</div>
  <h3>How we build</h3><p class="dssz">These guide how the site is made, not what the brand stands for (Kyle, 2026-11-09).</p><div class="bvals">${[
    ["Find it in minutes.", "The map comes first, and every screen helps someone find food and get there."],
    ["Works on the phone people have.", "Built for an older Android on slow data, used one-handed."],
    ["Right, or it says so.", "Hours and details are checked against their sources, and anything unsure is marked “call ahead” instead of guessed."],
    ["Plain words, in English and Spanish.", "No forms to qualify, no judgment, no jargon."],
    ["Private by default.", "No sign-up, no name asked to look for food, and no IP addresses, emails or form contents in our logs."],
  ].map(([t, d]) => `<div><b>${t}</b><small>${d}</small></div>`).join("")}</div>`,
});

const voice = dsSec({
  id: "voice", name: "How we sound",
  purpose: "“A well-typeset community bulletin on cream paper: readable at a glance, trustworthy, not slick.” (the brand note's voice in one line)",
  body: `${ul([
    "<b>“Plain, warm, second person. Talk to one neighbour.”</b> (DESIGN.md, Voice and copy)",
    "<b>Say place,</b> never venue, to the public. Spanish says lugar, and tú, not usted.",
    "<b>Short sentences, common words.</b> SNAP and WIC are fine: that's what people call them.",
    "<b>No long dashes</b> in anything a person reads. An exclamation mark only on a thank-you.",
  ])}
  <div class="bvoice"><div class="yes"><b>Sounds like us (live)</b><p>No problem, you can still find food. Tap any pin on the map to see hours and directions.</p></div><div class="no"><b>Doesn't (made up)</b><p>Unlock a world of nourishing possibilities with our seamless food discovery experience!</p></div></div>
  <p class="dssz">The full mission, vision, values and voice: the brand note in the knowledge base.</p>`,
});

const parts = [feel, who, reference, logo, decisions, mission, voice];
const items: [string, string][] = [["#feel", "The feel"], ["#who", "Who it's for"], ["#reference", "The look comes from"], ["#logo", "Logo"], ["#decisions", "Settled decisions"], ["#mission", "Mission, vision, values"], ["#voice", "How we sound"], ["foundations.html", "Foundations →"]];

export const pages: Page[] = [{
  slug: "brand", route: "DESIGN.md → Overview", title: "Design system: Brand and feel", area: "Design system", nav: "Brand",
  blurb: "Civic Editorial: who it's for, where the look comes from, the logo rules, the settled decisions, the mission and vision, the draft brand values, how we build, and how we sound.",
  changed: [
    "The opening section of the design system, filled in from DESIGN.md, the About page and the brand note in the knowledge base.",
    "Four brand values are new: drafts until you go over them with the Pueblo Food Project team.",
    "The five earlier values moved to How we build: they describe how the site is made (your call, 2026-11-09).",
  ],
  kept: [
    "The mission and vision, word for word as the About page says them (your call, 2026-11-08). The mission's long dash is flagged; the brand note has a comma there.",
    "The settled decisions: one orange action per screen, the category colors, no decorative pictures, the map is the product.",
  ],
  check: [
    "The logo: on green, the brand shows as the pin, never the name. Agree?",
  ],
  html: `<div class="head"><h1>Brand and feel</h1>${b("wn", "Draft")}</div>${toc(items)}${parts.join("")}`,
}];
