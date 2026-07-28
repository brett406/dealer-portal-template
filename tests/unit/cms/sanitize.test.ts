import { describe, it, expect } from "vitest";
import { sanitizeRichtext, stripHtml } from "@/lib/sanitize";

describe("sanitizeRichtext", () => {
  it("keeps ordinary formatting", () => {
    expect(sanitizeRichtext("<p>Hello <strong>world</strong></p>")).toContain("<strong>world</strong>");
  });

  it("drops scripts and event handlers", () => {
    const clean = sanitizeRichtext(`<p onclick="steal()">hi</p><script>alert(1)</script>`);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
  });

  it("blocks javascript: and data: URLs", () => {
    expect(sanitizeRichtext(`<a href="javascript:alert(1)">x</a>`)).not.toContain("javascript:");
    expect(sanitizeRichtext(`<img src="data:text/html;base64,PHN2Zz4=">`)).not.toContain("data:");
  });

  it("forces external links to be safe", () => {
    expect(sanitizeRichtext(`<a href="https://example.com">x</a>`)).toContain("noopener");
  });

  it("returns an empty string for non-strings", () => {
    expect(sanitizeRichtext(null)).toBe("");
    expect(sanitizeRichtext(undefined)).toBe("");
    expect(sanitizeRichtext(42)).toBe("");
  });
});

describe("stripHtml", () => {
  it("returns plain text", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("collapses whitespace introduced by block markup", () => {
    expect(stripHtml("<ul>\n  <li>One</li>\n  <li>Two</li>\n</ul>")).toBe("One Two");
  });

  // A regex tag-stripper is defeated by malformed markup; the sanitizer is not.
  // Callers treat this output as safe plain text (meta descriptions, previews).
  it("removes script content rather than exposing it as text", () => {
    expect(stripHtml("<script>alert(1)</script>Visible")).not.toContain("alert(1)");
    expect(stripHtml(`<p title="<b>">Text</p>`)).toBe("Text");
  });

  it("does not turn escaped entities back into markup", () => {
    expect(stripHtml("<p>a &lt;b&gt; c</p>")).not.toMatch(/<b>/);
  });

  it("returns an empty string for non-strings and blanks", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(undefined)).toBe("");
    expect(stripHtml("")).toBe("");
    expect(stripHtml(7)).toBe("");
  });
});
