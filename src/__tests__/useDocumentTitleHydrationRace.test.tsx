/**
 * useDocumentTitle — hydration race regression test (#589 follow-up).
 *
 * PR #605 fixed client-side navigation but not a hard page load: on
 * dev.pueblofoodmap.com/pueblofoodmap.com, Next's streaming-metadata Suspense
 * boundary (`Next.Metadata`/`Next.MetadataOutlet` — see
 * node_modules/next/dist/lib/metadata/metadata.js) resolves the server's
 * English <title> AFTER useDocumentTitle's effect has already set the
 * Spanish one, and React's hydration path for that Fiber (see
 * node_modules/react-dom/cjs/react-dom-client.development.js, the "title"
 * case under commitMutationEffectsOnFiber's mount branch) unconditionally
 * overwrites the existing <title> element's text to match its own resolved
 * value — a direct text-node mutation, not a `document.title =` assignment.
 * Reproduced live against dev.pueblofoodmap.com with a MutationObserver +
 * document.title setter trap (see PR body); it does NOT reproduce on
 * near-zero-latency localhost, confirming it's a real-network timing race,
 * not a fixed ordering bug — so this test simulates the mechanism directly
 * (mutate the <title> text node, bypassing the setter) rather than trying to
 * reproduce the network race itself.
 */

import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

function TitleSetter({ title }: { title: string }) {
  useDocumentTitle(title);
  return null;
}

/**
 * Simulates React's hydration-time title stomp: it does NOT go through the
 * `document.title` setter (see header) — it mutates the <title> element's
 * text node directly, exactly like `setInitialProperties` does.
 */
function simulateReactTitleStomp(text: string) {
  const titleEl = document.querySelector("title");
  if (!titleEl) throw new Error("no <title> element in document.head");
  if (titleEl.firstChild) {
    titleEl.firstChild.nodeValue = text;
  } else {
    titleEl.textContent = text;
  }
}

// MutationObserver callbacks fire as a microtask after the mutation — flush
// the microtask queue so the hook's own correction has run before asserting.
function flushMicrotasks() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("useDocumentTitle self-heals after a hydration-time title stomp (#589)", () => {
  test("reverts an external overwrite of the <title> text node back to the desired title", async () => {
    render(<TitleSetter title="Programas de ayuda alimentaria · Pueblo Food Map" />);
    expect(document.title).toBe("Programas de ayuda alimentaria · Pueblo Food Map");

    // Simulate Next/React's hydration commit reasserting the server's
    // English title after our effect already ran.
    simulateReactTitleStomp("Food help programs · Pueblo Food Map");
    expect(document.title).toBe("Food help programs · Pueblo Food Map"); // stomped, pre-heal

    await flushMicrotasks();

    expect(document.title).toBe("Programas de ayuda alimentaria · Pueblo Food Map");
  });

  test("does not loop: settles after exactly one correction", async () => {
    render(<TitleSetter title="Privacidad · Pueblo Food Map" />);
    simulateReactTitleStomp("Privacy · Pueblo Food Map");
    await flushMicrotasks();
    expect(document.title).toBe("Privacidad · Pueblo Food Map");

    // A second flush must be a no-op (no further mutation queued) — proves
    // the observer's correction doesn't re-trigger itself indefinitely.
    await flushMicrotasks();
    expect(document.title).toBe("Privacidad · Pueblo Food Map");
  });

  test("stops correcting once the component unmounts", async () => {
    const { unmount } = render(<TitleSetter title="Acerca de · Pueblo Food Map" />);
    expect(document.title).toBe("Acerca de · Pueblo Food Map");

    unmount();

    // A stomp after unmount (e.g. client-navigating to /venue/[id], which
    // deliberately keeps an English title — #287) must NOT be reverted by a
    // stale observer left over from the previous page.
    simulateReactTitleStomp("Some Venue Name · Pueblo Food Map");
    await flushMicrotasks();
    expect(document.title).toBe("Some Venue Name · Pueblo Food Map");
  });
});
