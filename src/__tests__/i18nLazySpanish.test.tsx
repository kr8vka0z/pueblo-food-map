/**
 * #723: English-tree pages don't download the Spanish strings. Switching
 * language must wait for them, so the visitor never sees English mixed in or
 * a raw key, and then switch fully.
 */
import { afterEach, describe, expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18N_DICTIONARIES, _unloadSpanishForTest, hasSpanish, loadSpanish, t } from "@/lib/i18n";
import esClient from "@/lib/i18n.es";
import { LocaleProvider, useLocale } from "@/lib/LocaleContext";

describe("Spanish loads before an English-tree visitor switches (#723)", () => {
  afterEach(() => loadSpanish());

  function Heading() {
    const { locale, setLocale } = useLocale();
    return (
      <button onClick={() => setLocale("es")}>{t("search.placeholder", locale)}</button>
    );
  }

  test("stays fully English until the Spanish file has loaded, then switches", async () => {
    _unloadSpanishForTest();
    render(
      <LocaleProvider>
        <Heading />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(hasSpanish()).toBe(false);
    expect(screen.getByRole("button").textContent).toBe(I18N_DICTIONARIES.en["search.placeholder"]);
    expect(await screen.findByText(esClient["search.placeholder"])).toBeTruthy();
    expect(document.cookie).toContain("pfm-locale=es");
  });

  // Choosing English while Spanish is still downloading must win: the late
  // download must not switch the page (or the cookie) back to Spanish.
  test.each([
    ["the toggle", () => undefined],
    ["a saved Spanish cookie", () => { document.cookie = "pfm-locale=es; path=/"; }],
  ])("a newer English choice beats a pending Spanish load (%s)", async (_, setup) => {
    _unloadSpanishForTest();
    document.cookie = "pfm-locale=en; path=/";
    setup();
    function Toggle() {
      const { locale, setLocale } = useLocale();
      return (
        <>
          <span data-testid="locale">{locale}</span>
          <button onClick={() => setLocale("es")}>es</button>
          <button onClick={() => setLocale("en")}>en</button>
        </>
      );
    }
    render(
      <LocaleProvider>
        <Toggle />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "es" }));
    fireEvent.click(screen.getByRole("button", { name: "en" }));
    await loadSpanish();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(document.cookie).toContain("pfm-locale=en");
  });
});
