/**
 * Turnstile global Window augmentation.
 *
 * Cloudflare Turnstile injects `window.turnstile` at runtime via the CF script
 * tag. This file is the single declaration — previously duplicated in
 * FeedbackForm, ReportForm, and SuggestForm (#166 8.6).
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          /**
           * Controls when the widget becomes visible. "interaction-only"
           * (BoxCheckinPanel, 2026-09-18) keeps it invisible unless Cloudflare
           * decides an interactive challenge is actually needed — the default
           * "always" (ReportForm/SuggestForm/FeedbackForm) shows the widget's
           * chrome immediately even for a pass-through check.
           */
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

// WHY an empty export: TypeScript treats this file as a module (not a plain
// script) only when it has at least one import/export. The empty export
// makes the global augmentation apply everywhere without explicit imports.
export {};
