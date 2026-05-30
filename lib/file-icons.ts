/**
 * File-type presentation helpers shared by the admin media UI and the dealer
 * files browser. Pure functions — no React, no I/O.
 */

export type FileTone = "primary" | "error" | "success" | "warning" | "muted";

/** Uppercase extension without the dot, e.g. "spec.PDF" -> "PDF". "" if none. */
export function fileExtension(name: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name);
  return match ? match[1].toUpperCase() : "";
}

/**
 * True for raster images that are safe to preview inline as a thumbnail.
 * SVG is intentionally excluded (it can carry script and is served as a
 * download, not inline).
 */
export function isPreviewableImage(mimeType: string, name: string): boolean {
  const ext = fileExtension(name).toLowerCase();
  if (ext === "svg") return false;
  if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") return true;
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
}

/**
 * A short category label + semantic tone for the file-type chip shown when
 * there's no image thumbnail (pdf, doc, sheet, cad, …).
 */
export function fileBadge(mimeType: string, name: string): { label: string; tone: FileTone } {
  const ext = fileExtension(name).toLowerCase();

  if (isPreviewableImage(mimeType, name) || ext === "svg") return { label: "IMG", tone: "primary" };
  if (ext === "pdf") return { label: "PDF", tone: "error" };
  if (["doc", "docx"].includes(ext)) return { label: "DOC", tone: "primary" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { label: ext === "csv" ? "CSV" : "XLS", tone: "success" };
  if (["ppt", "pptx"].includes(ext)) return { label: "PPT", tone: "warning" };
  if (["dwg", "dxf", "step", "stp", "iges", "igs"].includes(ext)) return { label: "CAD", tone: "warning" };
  if (["mp4", "mov", "webm"].includes(ext)) return { label: "VID", tone: "primary" };
  if (ext === "zip") return { label: "ZIP", tone: "muted" };
  if (ext === "txt") return { label: "TXT", tone: "muted" };

  return { label: ext ? ext.slice(0, 4) : "FILE", tone: "muted" };
}
