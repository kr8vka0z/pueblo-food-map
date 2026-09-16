import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageTopNav from "@/components/PageTopNav";

describe("PageTopNav — Back to map + Back to menu (Kyle, 2026-09-16)", () => {
  test("links back to the map and to the map with the Menu open", () => {
    render(<PageTopNav locale="en" />);
    expect(screen.getByRole("link", { name: /Back to map/ }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: /Back to menu/ }).getAttribute("href")).toBe("/?menu=1");
  });

  test("ES labels", () => {
    render(<PageTopNav locale="es" />);
    expect(screen.getByRole("link", { name: /Volver al mapa/ })).toBeDefined();
    expect(screen.getByRole("link", { name: /Volver al menú/ })).toBeDefined();
  });
});
