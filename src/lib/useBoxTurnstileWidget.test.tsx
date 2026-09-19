/**
 * useBoxTurnstileWidget tests (Blessing Boxes slice 6). A minimal harness
 * component exercises the hook exactly the way AdoptBoxForm/
 * BoxAlertSignupForm do (mount ref, read token/mode/error, call reset).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useBoxTurnstileWidget } from "@/lib/useBoxTurnstileWidget";

function Harness() {
  // The container ref is created here (not by the hook) — see
  // useBoxTurnstileWidget.ts's own header for why it's a parameter, not a
  // return value.
  const containerRef = useRef<HTMLDivElement>(null);
  const turnstile = useBoxTurnstileWidget(containerRef);
  return (
    <div>
      <div data-testid="token">{turnstile.token ?? "none"}</div>
      <div data-testid="mode">{turnstile.mode}</div>
      <div data-testid="error">{String(turnstile.error)}</div>
      <button type="button" onClick={turnstile.reset}>
        reset
      </button>
      <div ref={containerRef} data-testid="container" />
    </div>
  );
}

beforeEach(() => {
  vi.stubGlobal("turnstile", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useBoxTurnstileWidget", () => {
  test("mounts the box widget with the invisible-mode sitekey and captures its token", () => {
    const renderMock = vi.fn((_el: HTMLElement, opts: { callback?: (t: string) => void }) => {
      opts.callback?.("real-token");
      return "widget-1";
    });
    vi.stubGlobal("turnstile", { render: renderMock, reset: vi.fn(), remove: vi.fn() });

    render(<Harness />);

    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("token").textContent).toBe("real-token");
    expect(screen.getByTestId("mode").textContent).toBe("box");
  });

  test("error-callback swaps to the managed fallback widget, never flips back", () => {
    let boxErrorCallback: (() => void) | undefined;
    const removeMock = vi.fn();
    const renderMock = vi
      .fn()
      .mockImplementationOnce((_el: HTMLElement, opts: { "error-callback"?: () => void }) => {
        boxErrorCallback = opts["error-callback"];
        return "widget-box";
      })
      .mockImplementationOnce((_el: HTMLElement, opts: { callback?: (t: string) => void }) => {
        opts.callback?.("fallback-token");
        return "widget-fallback";
      });
    vi.stubGlobal("turnstile", { render: renderMock, reset: vi.fn(), remove: removeMock });

    render(<Harness />);
    expect(screen.getByTestId("mode").textContent).toBe("box");

    act(() => boxErrorCallback?.());

    expect(removeMock).toHaveBeenCalledWith("widget-box");
    expect(renderMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("mode").textContent).toBe("fallback");
    expect(screen.getByTestId("token").textContent).toBe("fallback-token");
  });

  test("window.turnstile never loaded — no crash, token stays null", () => {
    render(<Harness />);
    expect(screen.getByTestId("token").textContent).toBe("none");
  });

  test("reset() clears the token and calls window.turnstile.reset on the current widget", () => {
    const resetMock = vi.fn();
    const renderMock = vi.fn((el: HTMLElement, opts: { callback?: (t: string) => void }) => {
      // The real widget puts its iframe inside the container — reset() reads
      // that as "the widget is still alive".
      el.appendChild(document.createElement("iframe"));
      opts.callback?.("real-token");
      return "widget-1";
    });
    vi.stubGlobal("turnstile", { render: renderMock, reset: resetMock, remove: vi.fn() });

    render(<Harness />);
    expect(screen.getByTestId("token").textContent).toBe("real-token");

    fireEvent.click(screen.getByRole("button", { name: "reset" }));

    expect(resetMock).toHaveBeenCalledWith("widget-1");
    expect(screen.getByTestId("token").textContent).toBe("none");
  });

  // Regression — Kyle's phone, 2026-09-19: a widget whose iframe had left the
  // container never called back again, so a queued submit waited forever.
  test("reset() REBUILDS the widget when the container is empty or reset throws", () => {
    const removeMock = vi.fn();
    const renderMock = vi
      .fn()
      .mockImplementationOnce(() => "widget-dead") // renders nothing into the container
      .mockImplementationOnce((el: HTMLElement, opts: { callback?: (t: string) => void }) => {
        el.appendChild(document.createElement("iframe"));
        opts.callback?.("fresh-token");
        return "widget-fresh";
      });
    vi.stubGlobal("turnstile", { render: renderMock, reset: vi.fn(), remove: removeMock });

    render(<Harness />);
    expect(screen.getByTestId("token").textContent).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: "reset" }));

    expect(removeMock).toHaveBeenCalledWith("widget-dead");
    expect(renderMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("token").textContent).toBe("fresh-token");
  });
});
