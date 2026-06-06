import { describe, it, expect } from "vitest";
import { sanitizeRichText, sanitizePayload } from "@/lib/admin-api/sanitize";

describe("sanitizeRichText", () => {
  it("strips <script> tags and their content", () => {
    const out = sanitizeRichText('<p>hi</p><script>alert(1)</script>');
    expect(out).toContain("<p>hi</p>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
  });

  it("strips event handler attributes", () => {
    const out = sanitizeRichText('<p onclick="evil()">x</p>');
    expect(out).not.toContain("onclick");
  });

  it("strips javascript: URLs from links", () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("keeps safe formatting tags and http links", () => {
    const out = sanitizeRichText('<p><strong>bold</strong> <a href="https://x.com">link</a></p>');
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain('href="https://x.com"');
  });

  it("forces rel=noopener on links", () => {
    const out = sanitizeRichText('<a href="https://x.com">x</a>');
    expect(out).toContain("noopener");
  });
});

describe("sanitizePayload", () => {
  it("sanitizes every string value and coerces non-strings", () => {
    const out = sanitizePayload({ title: "Hi", body: "<img src=x onerror=alert(1)>", n: 5 });
    expect(out.title).toBe("Hi");
    expect(out.body).not.toContain("onerror");
    expect(out.n).toBe("5");
  });
});
