/**
 * displayNameHygiene.ts — sanitizes/validates the "Cared for by ..." display
 * name a box-adoption applicant submits (Blessing Boxes slice 6). Added in
 * the 2026-09-18 security review (item 11): this value is published
 * PUBLICLY on a box's card once approved, unlike every other free-text
 * field in this slice (email/note stay private forever), so it gets its
 * own hygiene pass rather than reusing the plain trim+length-cap every
 * other field uses.
 *
 * WHY reject CR/LF outright rather than stripping them: this value later
 * flows into an outbound email (sendAdopterApprovedEmail's `displayName`
 * var) and a public web page. Silently stripping a newline would let a
 * submission that tried to inject one pass validation looking clean, while
 * a value that legitimately never had one becomes indistinguishable from
 * one that did — rejecting outright is the only way the caller can tell,
 * and it costs a legitimate applicant nothing (a name has no reason to
 * contain a line break). This check runs BEFORE the character strip below,
 * not after — stripping first would erase the very thing being rejected.
 *
 * WHY strip (not reject) bidi/zero-width/other control characters: unlike a
 * newline these can't break the destinations this value flows into (no
 * line-oriented format here); they're a rendering-spoofing risk (a bidi
 * override can make a name display reversed, the same trick used to
 * disguise a phishing filename) rather than an injection risk. Quietly
 * removing them and validating what's left is friendlier to a false
 * positive (an invisible character picked up by accident, e.g. from a
 * mobile keyboard's autocomplete).
 *
 * WHY refuse (not strip) a URL-looking string: "Cared for by
 * http://spam.example" on a public card is an unmoderated ad placement no
 * admin review step is designed to catch (an admin reviews for identity/
 * appropriateness, not for whether a plain-looking name is secretly a
 * link). Refusing makes the applicant fix it, rather than silently
 * publishing a link-shaped name with just the scheme stripped off.
 */

/** A CR or LF anywhere in the raw input — checked before anything else, see this file's own header. */
const CR_LF_RE = /[\r\n]/;

/** C0 (0x00-0x1F, 0x7F) and C1 (0x80-0x9F) control characters. */
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/g;

/** Unicode bidi controls (U+202A-U+202E, U+2066-U+2069, U+200E, U+200F, U+061C) and zero-width characters (U+200B-U+200D, U+2060, U+FEFF). */
const BIDI_AND_ZERO_WIDTH_RE = /[​-‏‪-‮⁠⁦-⁩﻿؜]/g;

const URL_LIKE_RE = /https?:\/\/|www\./i;

/**
 * Returns the cleaned display name, or null if the input is invalid (a raw
 * CR/LF, empty after cleaning, or URL-looking once cleaned). Callers still
 * own their own length cap (FIELD_LIMITS.BOX_ADOPTER_DISPLAY_NAME) — this
 * function only handles character-level hygiene, not length.
 */
export function sanitizeDisplayName(raw: string): string | null {
  if (CR_LF_RE.test(raw)) return null;

  const cleaned = raw.replace(CONTROL_CHARS_RE, "").replace(BIDI_AND_ZERO_WIDTH_RE, "").trim();
  if (!cleaned) return null;
  if (URL_LIKE_RE.test(cleaned)) return null;

  return cleaned;
}
