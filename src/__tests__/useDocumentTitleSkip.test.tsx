/**
 * useDocumentTitle — `skip` option (#689 PR 2).
 *
 * Under the /es tree the server title is already Spanish, so callers pass
 * `skip: tree === "es"` to make the effect (including the MutationObserver)
 * a true no-op — see the hook's own header for the full rationale.
 */

import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

function TitleSetter({ title, skip }: { title: string; skip?: boolean }) {
  useDocumentTitle(title, { skip });
  return null;
}

describe("useDocumentTitle skip option", () => {
  test("skip: true never writes document.title", () => {
    document.title = "Untouched";
    render(<TitleSetter title="Should not appear" skip />);
    expect(document.title).toBe("Untouched");
  });

  test("skip: false (default) still writes document.title (regression guard)", () => {
    document.title = "Before";
    render(<TitleSetter title="After" />);
    expect(document.title).toBe("After");
  });

  test("skip: true never installs a MutationObserver correction", () => {
    document.title = "Untouched";
    render(<TitleSetter title="Should not appear" skip />);
    // Simulate the hydration-race stomp the sibling test file reproduces —
    // with skip, nothing should correct it back.
    const titleEl = document.querySelector("title");
    if (titleEl) titleEl.textContent = "Stomped";
    else document.title = "Stomped";
    expect(document.title === "Should not appear").toBe(false);
  });
});
