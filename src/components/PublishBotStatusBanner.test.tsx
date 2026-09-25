/**
 * Tests for PublishBotStatusBanner (#598).
 *
 * Covers: the three-state (`stuck_conflict` / `stuck_checks` / `in_progress`)
 * wording split, the PR link's href/target/rel, and that only a stuck state
 * carries role="alert" (in-progress is informational, not an error).
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import PublishBotStatusBanner from "@/components/PublishBotStatusBanner";

describe("PublishBotStatusBanner", () => {
  test("state 'stuck_conflict' shows the merge-conflict message with role=alert", () => {
    render(<PublishBotStatusBanner prNumber={42} prUrl="https://github.com/kr8vka0z/pueblo-food-map/pull/42" state="stuck_conflict" />);

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/publish is stuck/i)).toBeDefined();
    expect(screen.getByText(/merge conflict/i)).toBeDefined();
    const link = screen.getByRole("link", { name: /PR #42/ });
    expect(link.getAttribute("href")).toBe("https://github.com/kr8vka0z/pueblo-food-map/pull/42");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("state 'stuck_checks' shows the checks-stuck message with role=alert", () => {
    render(<PublishBotStatusBanner prNumber={42} prUrl="https://github.com/kr8vka0z/pueblo-food-map/pull/42" state="stuck_checks" />);

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/publish is stuck/i)).toBeDefined();
    expect(screen.getByText(/checks failing or pending too long/i)).toBeDefined();
  });

  test("state 'in_progress' shows the in-progress message, no role=alert", () => {
    render(<PublishBotStatusBanner prNumber={7} prUrl="https://github.com/kr8vka0z/pueblo-food-map/pull/7" state="in_progress" />);

    expect(screen.getByText(/publish in progress/i)).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("link", { name: /PR #7/ }).getAttribute("href")).toBe(
      "https://github.com/kr8vka0z/pueblo-food-map/pull/7",
    );
  });
});
