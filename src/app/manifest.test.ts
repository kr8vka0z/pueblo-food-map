/**
 * manifest.test.ts — the web app manifest (#130) is what makes the map
 * installable; these pin the fields Chrome's installability check needs and
 * keep its colours tied to the same bone-50 literal layout.tsx uses.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import manifest from "./manifest";
import { viewport } from "./layout";

const PUBLIC_DIR = path.resolve(__dirname, "../../public");

function pngSize(file: string): [number, number] {
  const buf = readFileSync(file);
  // PNG IHDR: width at byte 16, height at byte 20 (big-endian).
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

describe("app manifest (#130)", () => {
  const m = manifest();

  test("carries the fields an installable app needs", () => {
    expect(m.name).toBe("Pueblo Food Map");
    expect(m.short_name).toBeTruthy();
    expect((m.short_name ?? "").length).toBeLessThanOrEqual(12);
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
  });

  test("theme and background colours match layout.tsx's themeColor (bone-50)", () => {
    expect(m.theme_color).toBe(viewport.themeColor);
    expect(m.background_color).toBe(viewport.themeColor);
  });

  test("has 192 and 512 'any' icons plus a maskable one, all real PNGs of the stated size", () => {
    const icons = m.icons ?? [];
    const find = (sizes: string, purpose: string) =>
      icons.find((i) => i.sizes === sizes && (i.purpose ?? "any") === purpose);

    expect(find("192x192", "any")).toBeTruthy();
    expect(find("512x512", "any")).toBeTruthy();
    expect(find("512x512", "maskable")).toBeTruthy();

    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      const file = path.join(PUBLIC_DIR, icon.src);
      expect(existsSync(file), `${icon.src} exists in public/`).toBe(true);
      const [w, h] = pngSize(file);
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });
});
