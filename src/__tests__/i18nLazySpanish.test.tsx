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
});
