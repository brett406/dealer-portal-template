import { describe, it, expect } from "vitest";
import { validateFile } from "@/lib/uploads";

const MB = 1024 * 1024;

function file(name: string, type = "", size = 1024) {
  return { name, type, size };
}

describe("validateFile — allowlist", () => {
  it("accepts the broad business-file types", () => {
    const names = [
      "brochure.pdf",
      "photo.jpg",
      "logo.png",
      "diagram.webp",
      "spec.docx",
      "pricing.xlsx",
      "deck.pptx",
      "data.csv",
      "notes.txt",
      "bundle.zip",
      "part.step",
      "drawing.dwg",
      "model.iges",
      "demo.mp4",
      "clip.mov",
    ];
    for (const n of names) {
      expect(validateFile(file(n)), n).toMatchObject({ valid: true });
    }
  });

  it("accepts octet-stream MIME when the extension is allowlisted (CAD/zip)", () => {
    expect(validateFile(file("part.step", "application/octet-stream"))).toMatchObject({ valid: true });
    expect(validateFile(file("bundle.zip", "application/octet-stream"))).toMatchObject({ valid: true });
  });

  it("accepts a known-good MIME that matches the extension", () => {
    expect(validateFile(file("a.pdf", "application/pdf"))).toMatchObject({ valid: true });
  });
});

describe("validateFile — blocked & rejected", () => {
  it("blocks executables and scripts regardless of MIME", () => {
    for (const n of ["virus.exe", "run.bat", "do.sh", "x.cmd", "evil.js", "tool.jar", "p.ps1", "i.msi"]) {
      const r = validateFile(file(n, "application/octet-stream"));
      expect(r.valid, n).toBe(false);
      expect(r.error, n).toMatch(/Executable/i);
    }
  });

  it("rejects an extension that is not on the allowlist", () => {
    expect(validateFile(file("archive.rar"))).toMatchObject({ valid: false });
  });

  it("rejects files with no extension", () => {
    expect(validateFile(file("README"))).toMatchObject({ valid: false });
  });

  it("rejects a present, clearly-wrong MIME even when the extension is allowed", () => {
    const r = validateFile(file("a.pdf", "application/x-bogus"));
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/MIME/i);
  });
});

describe("validateFile — 25MB cap", () => {
  it("accepts a file at exactly 25MB", () => {
    expect(validateFile(file("big.pdf", "application/pdf", 25 * MB))).toMatchObject({ valid: true });
  });

  it("rejects a file over 25MB", () => {
    const r = validateFile(file("huge.pdf", "application/pdf", 25 * MB + 1));
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/too large/i);
  });
});
