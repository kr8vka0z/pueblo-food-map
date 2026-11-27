/**
 * LinkifyText — turns plain-text emails, phone/SMS numbers, and bare domains in
 * FAQ answers and form fallbacks into accessible links (#958) without storing
 * HTML in i18n strings (so FAQPage JSON-LD stays plain text).
 */

import type { ReactNode } from "react";

const TOKEN_RE =
  /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b|\b898-211\b|\b2-1-1\b|\bcoloradowicsignup\.com\b)/g;

const LINK_CLASS =
  "underline text-[var(--color-sage-700)] hover:text-[var(--color-sage-600)] transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded";

function hrefFor(token: string): { href: string; external?: boolean } {
  if (token.includes("@")) return { href: `mailto:${token}` };
  if (token === "898-211") return { href: "sms:898211" };
  if (token === "2-1-1") return { href: "tel:211" };
  if (token === "coloradowicsignup.com") return { href: "https://coloradowicsignup.com", external: true };
  const digits = token.replace(/\D/g, "");
  return { href: `tel:+1${digits}` };
}

export default function LinkifyText({ text }: { text: string }): ReactNode {
  const parts = text.split(TOKEN_RE);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const { href, external } = hrefFor(part);
    return (
      <a
        key={`${i}-${part}`}
        href={href}
        className={LINK_CLASS}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {part}
      </a>
    );
  });
}
