// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { composeEmail, escapeHtml, sendResendBatch, sendResendEmail, unsubscribeHeaders } from "@/lib/emailSend";

describe("escapeHtml", () => {
  test("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>&"'</script>`)).toBe("&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;");
  });
});

// Replaces the old composeBilingualEmail describe block — see this file's
// own header, "WHY single-language, not bilingual": every email now renders
// in ONE locale, the recipient's own, never an EN-block-then-ES-block pair.
describe("composeEmail", () => {
  test("lang 'en' renders only the English string, never the Spanish one", () => {
    const { text } = composeEmail({
      lang: "en",
      subjectKey: "email.adoptConfirm.subject",
      bodyLineKeys: ["email.adoptConfirm.disclaimer"],
      vars: { box: "Test Box" },
    });
    expect(text).toContain("If you didn't ask for this, you can ignore this email.");
    expect(text).not.toContain("Si tú no pediste esto");
  });

  test("lang 'es' renders only the Spanish string, never the English one", () => {
    const { subject, text } = composeEmail({
      lang: "es",
      subjectKey: "email.adoptConfirm.subject",
      bodyLineKeys: ["email.adoptConfirm.disclaimer"],
      vars: { box: "Test Box" },
    });
    expect(subject).toBe("Confirma tu solicitud para adoptar Test Box");
    expect(text).toContain("Si tú no pediste esto, puedes ignorar este correo.");
    expect(text).not.toContain("If you didn't ask for this");
  });

  test("no bilingual separator or second block — a single message, not two glued together", () => {
    const { text, html } = composeEmail({
      lang: "en",
      subjectKey: "app.name",
      bodyLineKeys: ["app.name"],
    });
    expect(text).not.toContain("—");
    expect(html).not.toContain("<hr/>");
    expect(html.match(/<div>/g)).toHaveLength(1);
  });

  test("interpolates vars into the one rendered block", () => {
    const { text } = composeEmail({
      lang: "en",
      subjectKey: "box.checkin.heading",
      bodyLineKeys: ["box.lastFilled"],
      vars: { time: "3 hours ago" },
    });
    expect(text).toContain("3 hours ago");
  });

  test("html wraps the block in one <div> and escapes injected content", () => {
    const { html } = composeEmail({
      lang: "en",
      subjectKey: "box.checkin.heading",
      bodyLineKeys: ["box.lastFilled"],
      vars: { time: `<img src=x onerror=alert(1)>` },
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  test("a plain https:// URL substituted into a line becomes a clickable anchor in the html part", () => {
    const { html } = composeEmail({
      lang: "en",
      subjectKey: "box.checkin.heading",
      bodyLineKeys: ["box.lastFilled"],
      vars: { time: "https://pueblofoodmap.com/box/1" },
    });
    expect(html).toContain('<a href="https://pueblofoodmap.com/box/1">https://pueblofoodmap.com/box/1</a>');
  });

  test("dev.pueblofoodmap.com also becomes a clickable anchor", () => {
    const { html } = composeEmail({
      lang: "en",
      subjectKey: "box.checkin.heading",
      bodyLineKeys: ["box.lastFilled"],
      vars: { time: "https://dev.pueblofoodmap.com/box/1" },
    });
    expect(html).toContain('<a href="https://dev.pueblofoodmap.com/box/1">');
  });

  test("localhost also becomes a clickable anchor (local dev)", () => {
    const { html } = composeEmail({
      lang: "en",
      subjectKey: "box.checkin.heading",
      bodyLineKeys: ["box.lastFilled"],
      vars: { time: "http://localhost:3000/box/1" },
    });
    expect(html).toContain('<a href="http://localhost:3000/box/1">');
  });

  // 2026-09-18 security review, item 12: a URL whose origin ISN'T one of
  // this app's own hosts must stay plain escaped text, never become a
  // clickable anchor — see htmlParagraph's own header for why the old
  // "never user input" assumption was wrong.
  test("a URL on a DIFFERENT host stays plain text, not a clickable anchor (item 12)", () => {
    const { html } = composeEmail({
      lang: "en",
      subjectKey: "box.checkin.heading",
      bodyLineKeys: ["box.lastFilled"],
      vars: { time: "https://phish.example/steal" },
    });
    expect(html).not.toContain("<a href=");
    expect(html).toContain("https://phish.example/steal");
  });
});

describe("unsubscribeHeaders", () => {
  test("carries List-Unsubscribe and the One-Click Post header", () => {
    const headers = unsubscribeHeaders("https://pueblofoodmap.com/api/public/alerts/stop?t=abc");
    expect(headers["List-Unsubscribe"]).toBe("<https://pueblofoodmap.com/api/public/alerts/stop?t=abc>");
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("sendResendEmail / sendResendBatch", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    // vi.stubEnv (not a direct `process.env.RESEND_API_KEY =`/`delete`) —
    // worker-configuration.d.ts's generated ProcessEnv types RESEND_API_KEY
    // as a required (non-optional) string, so `delete` doesn't type-check;
    // vi.stubEnv sidesteps that and is undone by vi.unstubAllEnvs() below,
    // same convention auth-options.test.ts and alertOrigin.test.ts use.
    vi.stubEnv("RESEND_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("sendResendEmail throws when RESEND_API_KEY is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(
      sendResendEmail({ to: "a@example.com", subject: "s", text: "t", html: "<p>t</p>" }),
    ).rejects.toThrow("RESEND_API_KEY not configured");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("sendResendEmail posts one recipient per call to /emails, never a shared `to` array with others", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    await sendResendEmail({ to: "a@example.com", subject: "s", text: "t", html: "<p>t</p>" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.to).toEqual(["a@example.com"]);
  });

  test("sendResendEmail throws on a non-OK Resend response", async () => {
    mockFetch.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(sendResendEmail({ to: "a@example.com", subject: "s", text: "t", html: "<p>t</p>" })).rejects.toThrow(
      "Resend API error 500",
    );
  });

  test("sendResendBatch does nothing (no fetch) for an empty array", async () => {
    await sendResendBatch([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("sendResendBatch posts to /emails/batch, one object per recipient — never combining recipients into one `to`", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    await sendResendBatch([
      { to: "a@example.com", subject: "s", text: "t", html: "<p>t</p>" },
      { to: "b@example.com", subject: "s", text: "t", html: "<p>t</p>" },
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails/batch");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toHaveLength(2);
    expect(body[0].to).toEqual(["a@example.com"]);
    expect(body[1].to).toEqual(["b@example.com"]);
  });

  test("sendResendBatch chunks into groups of 100 — 150 recipients makes 2 calls", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    const emails = Array.from({ length: 150 }, (_, i) => ({
      to: `user${i}@example.com`,
      subject: "s",
      text: "t",
      html: "<p>t</p>",
    }));
    await sendResendBatch(emails);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    const secondBody = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
    expect(firstBody).toHaveLength(100);
    expect(secondBody).toHaveLength(50);
  });

  test("sendResendBatch throws on a non-OK response", async () => {
    mockFetch.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(
      sendResendBatch([{ to: "a@example.com", subject: "s", text: "t", html: "<p>t</p>" }]),
    ).rejects.toThrow("Resend batch API error 500");
  });
});
