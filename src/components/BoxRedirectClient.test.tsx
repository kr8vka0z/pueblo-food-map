/**
 * BoxRedirectClient tests (fix, PR review 2026-09-18): a JS-disabled visitor
 * never runs the router.replace effect, so BoxRedirectClient.tsx's own
 * header — its no-JS fallback link is what gets them to the map at all.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

import BoxRedirectClient from "@/components/BoxRedirectClient";

beforeEach(() => {
  mockReplace.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BoxRedirectClient", () => {
  test("calls router.replace to the box's map deep link on mount", () => {
    render(<BoxRedirectClient id="box-1" name="Test Blessing Box" />);
    expect(mockReplace).toHaveBeenCalledWith("/?venue=box-1");
  });

  test("renders a real <a> link to the same destination, for a JS-disabled visitor router.replace never reaches", () => {
    render(<BoxRedirectClient id="box-1" name="Test Blessing Box" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/?venue=box-1");
  });

  test("encodes the id in both the redirect and the fallback link", () => {
    render(<BoxRedirectClient id="box/weird id" name="Test Box" />);
    expect(mockReplace).toHaveBeenCalledWith(`/?venue=${encodeURIComponent("box/weird id")}`);
    expect(screen.getByRole("link").getAttribute("href")).toBe(`/?venue=${encodeURIComponent("box/weird id")}`);
  });
});
