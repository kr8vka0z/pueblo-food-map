/**
 * MapWrapper chrome layout tests — issues #97, #95 (partial), #96, #99
 *
 * #97: EN/ES toggle renders in the top-left cluster beside the wordmark,
 *      not in a standalone top-right mount.
 *
 * These tests mount only the sub-components in isolation (Wordmark + LanguageToggle
 * as siblings in a container) to verify layout without needing the full MapWrapper,
 * which requires Mapbox WebGL.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/lib/LocaleContext";
import LanguageToggle from "@/components/LanguageToggle";
import Wordmark from "@/components/Wordmark";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderTopLeftCluster() {
  return render(
    <LocaleProvider>
      {/* Simulate the top-left container from MapWrapper */}
      <div
        data-testid="top-left-cluster"
        style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8, alignItems: "center" }}
      >
        <Wordmark onClick={vi.fn()} locale="en" size="sm" selfPositioned={false} />
        <LanguageToggle />
      </div>
    </LocaleProvider>,
  );
}

// ─── #97: Language toggle position ───────────────────────────────────────────

describe("#97 — LanguageToggle in top-left cluster with Wordmark", () => {
  test("Wordmark and LanguageToggle are siblings inside the top-left container", () => {
    renderTopLeftCluster();
    const cluster = screen.getByTestId("top-left-cluster");
    // Both should be children of the same container
    const wordmark = screen.getByRole("button", { name: /Pueblo Food Map/i });
    const enBtn = screen.getByRole("button", { name: /english/i });
    expect(cluster.contains(wordmark)).toBe(true);
    expect(cluster.contains(enBtn)).toBe(true);
  });

  test("EN button is present in the cluster", () => {
    renderTopLeftCluster();
    expect(screen.getByRole("button", { name: /english/i })).toBeDefined();
  });

  test("ES button is present in the cluster", () => {
    renderTopLeftCluster();
    expect(screen.getByRole("button", { name: /spanish/i })).toBeDefined();
  });

  test("language toggle still switches locale after move", async () => {
    const user = userEvent.setup();
    renderTopLeftCluster();
    const esBtn = screen.getByRole("button", { name: /spanish/i });
    await user.click(esBtn);
    expect(esBtn.getAttribute("aria-pressed")).toBe("true");
    const enBtn = screen.getByRole("button", { name: /english/i });
    expect(enBtn.getAttribute("aria-pressed")).toBe("false");
  });

  test("Wordmark does NOT carry absolute positioning classes when selfPositioned=false", () => {
    const { container } = render(
      <LocaleProvider>
        <Wordmark onClick={vi.fn()} locale="en" size="sm" selfPositioned={false} />
      </LocaleProvider>,
    );
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    // Should NOT have self-positioning classes
    expect(btn!.className).not.toMatch(/\babsolute\b/);
    expect(btn!.className).not.toMatch(/\btop-4\b/);
    expect(btn!.className).not.toMatch(/\bleft-4\b/);
  });

  test("Wordmark retains absolute positioning classes when selfPositioned=true (default)", () => {
    const { container } = render(
      <LocaleProvider>
        <Wordmark onClick={vi.fn()} locale="en" size="sm" />
      </LocaleProvider>,
    );
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn!.className).toMatch(/\babsolute\b/);
    expect(btn!.className).toMatch(/\btop-4\b/);
    expect(btn!.className).toMatch(/\bleft-4\b/);
  });
});
