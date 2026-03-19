import { promises as fs } from "fs";
import path from "path";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(", ")}` };
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
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
