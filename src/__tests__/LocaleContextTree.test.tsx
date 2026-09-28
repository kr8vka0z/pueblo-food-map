/**
 * LocaleContext's `tree` field (#689 PR 2) — the route tree a page was
 * served from, fixed for the provider's lifetime, distinct from the
 * switchable `locale`. See LocaleContext.tsx's own comment on the field.
 */
import { describe, test, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LocaleProvider, useLocale } from "@/lib/LocaleContext";

function Probe() {
  const { locale, tree, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="tree">{tree}</span>
      <button onClick={() => setLocale(locale === "en" ? "es" : "en")}>toggle</button>
    </div>
  );
}

describe("LocaleContext tree", () => {
  test("no initialLocale: tree is en, matching the default locale", () => {
    const { getByTestId } = render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(getByTestId("tree").textContent).toBe("en");
    expect(getByTestId("locale").textContent).toBe("en");
  });

  test('initialLocale="es": tree is es and stays es even after setLocale("en")', () => {
    const { getByTestId } = render(
      <LocaleProvider initialLocale="es">
        <Probe />
      </LocaleProvider>,
    );
    expect(getByTestId("tree").textContent).toBe("es");
    // tree must not track a client-side setLocale call — it reflects the
    // route the page was served from, not the visitor's toggle.
    fireEvent.click(getByTestId("tree").parentElement!.querySelector("button")!);
    expect(getByTestId("tree").textContent).toBe("es");
    expect(getByTestId("locale").textContent).toBe("en");
  });

  test("no initialLocale: locale can still be switched client-side while tree stays en", () => {
    const { getByTestId } = render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    fireEvent.click(getByTestId("tree").parentElement!.querySelector("button")!);
    expect(getByTestId("locale").textContent).toBe("es");
    expect(getByTestId("tree").textContent).toBe("en");
  });
});
