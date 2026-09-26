"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Check } from "lucide-react";
import { shareVenue } from "@/lib/share";
import { t, type Locale } from "@/lib/i18n";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

interface ShareButtonProps {
  venueId: string;
  venueName?: string;
  locale?: Locale;
  size?: number;
  /** See share.ts's venueShareUrl — a blessing box shares /box/<id>, not /venue/<id>. */
  isBox?: boolean;
}

export default function ShareButton({
  venueId,
  venueName,
  locale = "en",
  size = 20,
  isBox = false,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const label = venueName
    ? t("share.label", locale, { name: venueName })
    : t("share.labelGeneric", locale);

  async function handleClick() {
    const result = await shareVenue({
      venueId,
      title: venueName ?? "Pueblo Food Map",
      text: venueName ? `${venueName} — Pueblo Food Map` : "Pueblo Food Map",
      isBox,
    });
    if (result === "copied") {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      setCopied(true);
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 2000);
    }
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleClick}
      className={
        // 48px hit area (#233's floor); same negative-margin technique as
        // FavoriteButton (mobile review #12). Callers space these with gap-4
        // so the -m-1 overlap still leaves 8px between neighbouring hit areas.
        "shrink-0 flex items-center justify-center w-12 h-12 -m-1 rounded-md transition-colors " +
        "hover:bg-[var(--color-bone-100)] " +
        "text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] " +
        PRESS_FEEDBACK + " " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
      }
    >
      {copied ? (
        <Check size={size} aria-hidden style={{ color: "var(--color-sage-600)" }} />
      ) : (
        <Share2 size={size} aria-hidden />
      )}
      {copied && (
        <span className="sr-only" role="status">
          {t("share.copied", locale)}
        </span>
      )}
    </button>
  );
}
