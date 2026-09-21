import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resolveEmailOrigin } from "@/lib/alertOrigin";

describe("resolveEmailOrigin", () => {
  beforeEach(() => {
    // vi.stubEnv (not a direct `process.env.NODE_ENV =`) bypasses Next's
    // read-only NODE_ENV type — same convention auth-options.test.ts uses —
    // and is undone by vi.unstubAllEnvs() in afterEach below.
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("prod apex host -> its own https origin", () => {
    expect(resolveEmailOrigin({ url: "https://pueblofoodmap.com/api/public/alerts/confirm" })).toBe(
      "https://pueblofoodmap.com",
    );
  });

  test("staging apex host -> its own https origin", () => {
    expect(resolveEmailOrigin({ url: "https://dev.pueblofoodmap.com/api/public/alerts/confirm" })).toBe(
      "https://dev.pueblofoodmap.com",
    );
  });

  test("an arbitrary/attacker Host (e.g. workers.dev, a preview URL) -> falls back to the canonical origin, never reflected", () => {
    expect(resolveEmailOrigin({ url: "https://pueblo-food-map.kyle-boyd.workers.dev/api/x" })).toBe(
      "https://pueblofoodmap.com",
    );
    expect(resolveEmailOrigin({ url: "https://evil.example.com/api/x" })).toBe("https://pueblofoodmap.com");
  });

  test("localhost is only trusted OUTSIDE production", () => {
    expect(resolveEmailOrigin({ url: "http://localhost:3000/api/x" })).toBe("https://pueblofoodmap.com");
    vi.stubEnv("NODE_ENV", "development");
    expect(resolveEmailOrigin({ url: "http://localhost:3000/api/x" })).toBe("http://localhost:3000");
  });

  test("an unparseable URL falls back to the canonical origin rather than throwing", () => {
    expect(resolveEmailOrigin({ url: "not a url" })).toBe("https://pueblofoodmap.com");
  });
});
