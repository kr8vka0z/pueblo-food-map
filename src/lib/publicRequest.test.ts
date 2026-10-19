import { describe, expect, it } from "vitest";
import { requestIp } from "./publicRequest";

describe("requestIp", () => {
  it.each([
    ["cf-connecting-ip wins over x-forwarded-for", { "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }, "1.1.1.1"],
    ["first x-forwarded-for entry, trimmed", { "x-forwarded-for": " 3.3.3.3 , 4.4.4.4" }, "3.3.3.3"],
    ["neither header -> unknown", {}, "unknown"],
    // Matches the inline expression it replaced: an empty first entry stays "", it does not fall through.
    ["empty first x-forwarded-for entry stays empty", { "x-forwarded-for": ", 5.5.5.5" }, ""],
  ])("%s", (_label, headers, expected) => {
    expect(requestIp(new Request("https://example.com", { headers }))).toBe(expected);
  });
});
