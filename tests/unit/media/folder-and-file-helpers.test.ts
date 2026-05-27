import { describe, it, expect } from "vitest";
import {
  isFolderColorKey,
  folderColorHex,
  FOLDER_COLORS,
  FOLDER_COLOR_KEYS,
  DEFAULT_FOLDER_COLOR,
} from "@/lib/folder-colors";
import { fileBadge, fileExtension, isPreviewableImage } from "@/lib/file-icons";

describe("folder palette validation", () => {
  it("accepts every defined palette key", () => {
    for (const key of FOLDER_COLOR_KEYS) {
      expect(isFolderColorKey(key)).toBe(true);
    }
  });

  it("rejects unknown keys, null, and non-strings", () => {
    expect(isFolderColorKey("teal")).toBe(false);
    expect(isFolderColorKey("")).toBe(false);
    expect(isFolderColorKey(null)).toBe(false);
    expect(isFolderColorKey(undefined)).toBe(false);
    expect(isFolderColorKey(123)).toBe(false);
  });

  it("resolves a known key to its hex", () => {
    expect(folderColorHex("blue")).toBe(FOLDER_COLORS.blue.hex);
  });

  it("falls back to the default color for null/unknown keys", () => {
    const fallback = FOLDER_COLORS[DEFAULT_FOLDER_COLOR].hex;
    expect(folderColorHex(null)).toBe(fallback);
    expect(folderColorHex("nope")).toBe(fallback);
  });
});

describe("file-icons helpers", () => {
  it("extracts the uppercase extension", () => {
    expect(fileExtension("a.PDF")).toBe("PDF");
    expect(fileExtension("My Spec.docx")).toBe("DOCX");
    expect(fileExtension("noext")).toBe("");
  });

  it("treats raster images as previewable but not SVG", () => {
    expect(isPreviewableImage("image/png", "x.png")).toBe(true);
    expect(isPreviewableImage("image/jpeg", "x.jpg")).toBe(true);
    expect(isPreviewableImage("image/svg+xml", "x.svg")).toBe(false);
    expect(isPreviewableImage("application/pdf", "x.pdf")).toBe(false);
  });

  it("maps file types to a category badge + tone", () => {
    expect(fileBadge("application/pdf", "a.pdf")).toMatchObject({ label: "PDF", tone: "error" });
    expect(fileBadge("application/octet-stream", "part.step")).toMatchObject({ label: "CAD", tone: "warning" });
    expect(fileBadge("text/csv", "data.csv")).toMatchObject({ label: "CSV", tone: "success" });
    expect(fileBadge("image/png", "a.png")).toMatchObject({ label: "IMG", tone: "primary" });
  });
});
