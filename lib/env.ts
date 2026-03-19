import { z } from "zod";

/**
 * Runtime environment validation.
 * Only validates variables needed at runtime (not seed-only vars).
 */
const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),

  // Required in production, optional in dev
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),

  // Optional — email works without (logs to console)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),

  // Optional — test database
  DATABASE_TEST_URL: z.string().optional(),

  // Optional — uploads
  UPLOADS_DIR: z.string().optional(),
  RAILWAY_VOLUME_MOUNT_PATH: z.string().optional(),

  // Optional — S3/R2 backup for uploads (shared with backup service)
  BACKUP_S3_BUCKET: z.string().optional(),
  BACKUP_S3_PREFIX: z.string().optional(),
  BACKUP_S3_ENDPOINT: z.string().optional(),
  BACKUP_S3_ACCESS_KEY: z.string().optional(),
  BACKUP_S3_SECRET_KEY: z.string().optional(),
  BACKUP_S3_REGION: z.string().optional(),

  // Seed-only (not validated at runtime)
  OWNER_EMAIL: z.string().optional(),
  OWNER_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  return result.data;
}
