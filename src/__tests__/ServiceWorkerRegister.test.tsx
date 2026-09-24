/**
 * ServiceWorkerRegister.test.tsx — the service worker (#130) must register
 * only in production builds and only after the page has finished loading,
 * so it never competes with first paint on a low-end phone.
 */
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const register = vi.fn(() => Promise.resolve({}));
const unregister = vi.fn(() => Promise.resolve(true));
const getRegistrations = vi.fn(() => Promise.resolve([{ unregister }]));

let readyState: DocumentReadyState = "loading";

beforeEach(() => {
  vi.useFakeTimers();
  register.mockClear();
  unregister.mockClear();
  getRegistrations.mockClear();
  Object.defineProperty(navigator, "serviceWorker", {
    value: { register, getRegistrations },
    configurable: true,
  });
  readyState = "loading";
  vi.spyOn(document, "readyState", "get").mockImplementation(() => readyState);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ServiceWorkerRegister (#130)", () => {
  test("production: waits for window load, then registers /sw.js at scope / once idle", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<ServiceWorkerRegister />);

    vi.advanceTimersByTime(10_000);
    expect(register).not.toHaveBeenCalled();

    readyState = "complete";
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(10_000);

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
  });

  test("production: page already loaded when mounted — still registers (deferred, not inline)", () => {
    vi.stubEnv("NODE_ENV", "production");
    readyState = "complete";
    render(<ServiceWorkerRegister />);
    expect(register).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(register).toHaveBeenCalledTimes(1);
  });

  test("not production: never registers, and removes a worker left over from a local prod run", async () => {
    readyState = "complete";
    render(<ServiceWorkerRegister />);
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(10_000);
    await vi.runAllTimersAsync();
    expect(register).not.toHaveBeenCalled();
    expect(unregister).toHaveBeenCalled();
  });

  test("browsers without service workers: renders nothing and does not throw", () => {
    vi.stubEnv("NODE_ENV", "production");
    // @ts-expect-error — simulate a browser with no serviceWorker support
    delete navigator.serviceWorker;
    readyState = "complete";
    const { container } = render(<ServiceWorkerRegister />);
    vi.advanceTimersByTime(10_000);
    expect(container.innerHTML).toBe("");
  });
});
