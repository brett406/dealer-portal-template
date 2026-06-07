import { promises as fs } from "fs";
import path from "path";

/**
 * Canonical extension → MIME map for the dealer media library.
 *
 * This is the single source of truth for both the upload allowlist
 * (`validateFile`) and the serving route's Content-Type resolution. Dealer
 * media is "any business file" — brochures, spec sheets, office docs, CAD,
 * video — so the allowlist is broad. Executables/scripts are blocked
 * separately (see BLOCKED_EXTENSIONS); never add one here.
 */
export const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".zip": "application/zip",
  ".dwg": "application/acad",
  ".dxf": "image/vnd.dxf",
  ".step": "application/step",
  ".stp": "application/step",
  ".iges": "model/iges",
  ".igs": "model/iges",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_BY_EXTENSION));
const ALLOWED_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

// Executable / script types are explicitly blocked regardless of the allowlist.
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".com", ".msi",
  ".app", ".dll", ".scr", ".js", ".jar", ".ps1",
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * Extensions whose binary signature we verify against the file's actual bytes
 * (magic-number check). Limited to formats `file-type` detects reliably — this
 * catches an attacker disguising an executable/HTML as e.g. a .png or .pdf.
 * Text/CAD formats (svg, csv, txt, dwg, dxf, step, iges) have no reliable
 * signature and are intentionally omitted; they rely on the extension allowlist
 * + BLOCKED_EXTENSIONS, and SVG is always served as an attachment, never inline.
 */
const MAGIC_CHECKED_EXTENSIONS: Record<string, Set<string>> = {
  ".pdf": new Set(["application/pdf"]),
  ".jpg": new Set(["image/jpeg"]),
  ".jpeg": new Set(["image/jpeg"]),
  ".png": new Set(["image/png"]),
  ".webp": new Set(["image/webp"]),
  ".gif": new Set(["image/gif"]),
  ".zip": new Set(["application/zip"]),
  ".mp4": new Set(["video/mp4"]),
  ".mov": new Set(["video/quicktime"]),
  ".webm": new Set(["video/webm"]),
};

/**
 * For magic-checkable extensions, confirm the file's actual bytes match the
 * claimed type. Throws on mismatch. No-op for extensions we can't reliably sniff.
 */
async function assertContentMatchesExtension(buffer: Buffer, ext: string): Promise<void> {
  const expected = MAGIC_CHECKED_EXTENSIONS[ext];
  if (!expected) return;

  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !expected.has(detected.mime)) {
    throw new Error(
      `File content does not match its ${ext} extension` +
        (detected ? ` (detected ${detected.mime})` : " (no recognizable signature)"),
    );
  }
}

// ─── S3 configuration (lazy) ─────────────────────────────────────────────────

let s3Warned = false;

function getS3Config() {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket) {
    if (!s3Warned && process.env.NODE_ENV === "production") {
      console.warn(
        "[Uploads] BACKUP_S3_BUCKET not set — uploads will NOT be backed up to S3.",
      );
      s3Warned = true;
    }
    return null;
  }
  return {
    bucket,
    prefix: (process.env.BACKUP_S3_PREFIX ?? "").replace(/\/$/, ""),
    endpoint: process.env.BACKUP_S3_ENDPOINT || undefined,
    region: process.env.BACKUP_S3_REGION || "auto",
    accessKey: process.env.BACKUP_S3_ACCESS_KEY || "",
    secretKey: process.env.BACKUP_S3_SECRET_KEY || "",
  };
}

async function getS3Client() {
  const config = getS3Config();
  if (!config || !config.accessKey || !config.secretKey) return null;

  const { S3Client } = await import("@aws-sdk/client-s3");
  return {
    client: new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
      forcePathStyle: !!config.endpoint,
    }),
    bucket: config.bucket,
    keyPrefix: config.prefix ? `${config.prefix}/uploads/` : "uploads/",
  };
}

// ─── Local file operations ───────────────────────────────────────────────────

export function getUploadsDir(): string {
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    return path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "uploads");
  }
  if (process.env.UPLOADS_DIR) {
    return process.env.UPLOADS_DIR;
  }
  return path.join(process.cwd(), "public", "uploads");
}

export function getUploadUrl(filename: string): string {
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    return `/api/uploads/${encodeURIComponent(filename)}`;
  }
  return `/uploads/${encodeURIComponent(filename)}`;
}

export function sanitizeFilename(originalName: string): string {
  const basename = path.basename(originalName);
  const ext = path.extname(basename).toLowerCase();
  const nameWithoutExt = path.basename(basename, ext);
  const clean = nameWithoutExt
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50) || "image";
  return `${Date.now()}-${clean}${ext}`;
}

export function validateFile(
  file: { name: string; type: string; size: number },
): { valid: boolean; error?: string } {
  if (!file.name) return { valid: false, error: "No file provided" };

  const ext = path.extname(file.name).toLowerCase();
  if (!ext) {
    return { valid: false, error: "File must have a recognized extension" };
  }
  // Block executables/scripts first — defense in depth, independent of MIME.
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Executable and script files are not allowed (${ext})` };
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type not allowed: ${ext}` };
  }
  // The extension is the authoritative gate. MIME is a secondary signal: CAD,
  // zip, and many office files report "application/octet-stream" (or no type),
  // so accept those; only reject a MIME that is present and clearly off-list.
  if (file.type && file.type !== "application/octet-stream" && !ALLOWED_TYPES.has(file.type)) {
    return { valid: false, error: `MIME type not allowed: ${file.type}` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }
  return { valid: true };
}

/**
 * Save file locally AND back up to S3 (if configured).
 */
export async function saveUpload(
  file: File,
): Promise<{ url: string; filename: string }> {
  const validation = validateFile(file);
  if (!validation.valid) throw new Error(validation.error);

  const filename = sanitizeFilename(file.name);
  const uploadsDir = getUploadsDir();

  await fs.mkdir(uploadsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());

  // Content-based validation: ensure the bytes match the claimed extension for
  // formats we can reliably sniff (defense beyond the extension/MIME allowlist).
  await assertContentMatchesExtension(buffer, path.extname(filename).toLowerCase());

  await fs.writeFile(path.join(uploadsDir, filename), buffer);

  // S3 backup (fire-and-forget)
  uploadToS3(filename, buffer).catch((err) =>
    console.error(`[Uploads] S3 backup failed for ${filename}:`, err),
  );

  return { url: getUploadUrl(filename), filename };
}

/**
 * Delete file from disk AND S3.
 */
export async function deleteUpload(filename: string): Promise<void> {
  const safe = path.basename(filename);
  try {
    await fs.unlink(path.join(getUploadsDir(), safe));
  } catch {
    // Already deleted
  }
  deleteFromS3(safe).catch((err) =>
    console.error(`[Uploads] S3 delete failed for ${safe}:`, err),
  );
}

// ─── S3 operations ───────────────────────────────────────────────────────────

/**
 * Upload to S3/R2 backup. Skips silently if not configured.
 */
export async function uploadToS3(filename: string, fileBuffer: Buffer): Promise<void> {
  const s3 = await getS3Client();
  if (!s3) return;

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await s3.client.send(new PutObjectCommand({
    Bucket: s3.bucket,
    Key: `${s3.keyPrefix}${filename}`,
    Body: fileBuffer,
  }));
}

/**
 * Delete from S3/R2 backup. Skips silently if not configured.
 */
export async function deleteFromS3(filename: string): Promise<void> {
  const s3 = await getS3Client();
  if (!s3) return;

  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await s3.client.send(new DeleteObjectCommand({
    Bucket: s3.bucket,
    Key: `${s3.keyPrefix}${filename}`,
  }));
}

/**
 * Download from S3/R2 for recovery. Returns null if not found or not configured.
 */
export async function restoreFromS3(filename: string): Promise<Buffer | null> {
  const s3 = await getS3Client();
  if (!s3) return null;

  const { GetObjectCommand } = await import("@aws-sdk/client-s3");

  try {
    const response = await s3.client.send(new GetObjectCommand({
      Bucket: s3.bucket,
      Key: `${s3.keyPrefix}${filename}`,
    }));
    if (!response.Body) return null;

    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}
