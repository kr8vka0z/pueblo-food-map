import { expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";

export type FormTestType = "feedback" | "report" | "suggest";
export type FormTestLocale = "en" | "es";

/**
 * Accessible submit names per form and locale.
 * Turnstile enables submit asynchronously; centralizing names keeps ES coverage aligned
 * across the three form test suites when copy changes.
 */
const SUBMIT_BUTTON_NAMES: Record<
  FormTestType,
  Record<FormTestLocale, RegExp>
> = {
  feedback: {
    en: /Send feedback/i,
    es: /Enviar comentario/i,
  },
  report: {
    en: /Submit report/i,
    es: /Enviar reporte/i,
  },
  suggest: {
    en: /Submit suggestion/i,
    es: /Enviar sugerencia/i,
  },
};

export function getSubmitButtonName(
  formType: FormTestType,
  locale: FormTestLocale = "en",
): RegExp {
  return SUBMIT_BUTTON_NAMES[formType][locale];
}

/**
 * Turnstile resolves after mount in every form test.
 * We poll the locale aware submit button so ES tests do not duplicate wait logic per file.
 */
export async function waitForSubmitEnabled(
  formType: FormTestType,
  locale: FormTestLocale = "en",
) {
  const name = getSubmitButtonName(formType, locale);
  await waitFor(() => {
    const btn = screen.getByRole("button", { name });
    expect(btn).toBeDefined();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });
}

/**
 * Turnstile failure copy comes from i18n, not a single English string.
 * EN checks alert fragments; ES checks a stable substring from the dictionary.
 */
export async function expectTurnstileError(locale: FormTestLocale = "en") {
  await waitFor(() => {
    if (locale === "es") {
      expect(screen.getByText(/No pudimos verificar/i)).toBeDefined();
      return;
    }
    const alerts = screen.getAllByRole("alert");
    const turnstileAlert = alerts.find(
      (el) =>
        el.textContent?.includes("verify") &&
        el.textContent?.includes("human"),
    );
    expect(turnstileAlert).toBeDefined();
  });
}
