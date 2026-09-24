/**
 * Tests for PublishBotStatusBanner (#598).
 *
 * Covers: the failing vs. non-failing wording split, the PR link's href/
 * target/rel, and that only the failing state carries role="alert" (a
 * pending/passing/unknown in-progress state is informational, not an
 * error).
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import PublishBotStatusBanner from "@/components/PublishBotStatusBanner";

describe("PublishBotStatusBanner", () => {
  test("checksState 'failing' shows the stuck-publish message with role=alert", () => {
    render(<PublishBotStatusBanner prNumber={42} prUrl="https://github.com/kr8vka0z/pueblo-food-map/pull/42" checksState="failing" />);

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/publish is stuck/i)).toBeDefined();
    expect(screen.getByText(/checks failed/i)).toBeDefined();
    const link = screen.getByRole("link", { name: /PR #42/ });
    expect(link.getAttribute("href")).toBe("https://github.com/kr8vka0z/pueblo-food-map/pull/42");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test.each(["pending", "passing", "unknown"] as const)(
    "checksState '%s' shows the in-progress message, no role=alert",
    (checksState) => {
      render(<PublishBotStatusBanner prNumber={7} prUrl="https://github.com/kr8vka0z/pueblo-food-map/pull/7" checksState={checksState} />);

      expect(screen.getByText(/publish in progress/i)).toBeDefined();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByRole("link", { name: /PR #7/ }).getAttribute("href")).toBe(
        "https://github.com/kr8vka0z/pueblo-food-map/pull/7",
      );
    },
  );
});
