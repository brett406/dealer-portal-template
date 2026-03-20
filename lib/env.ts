import { z } from "zod";

/**
 * Runtime environment validation.
 * Only DATABASE_URL and AUTH_SECRET are truly required.
 * Everything else is optional or configured via the admin panel.
 */
const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters. Run: openssl rand -base64 32"),

  // Recommended (for auth callbacks and email links)
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_URL: z.string().url().optional(),

  // Optional — email (logs to console without)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Optional — uploads
  UPLOADS_DIR: z.string().optional(),
  RAILWAY_VOLUME_MOUNT_PATH: z.string().optional(),

  // Optional — S3/R2 backup for uploads
  BACKUP_S3_BUCKET: z.string().optional(),
  BACKUP_S3_PREFIX: z.string().optional(),
  BACKUP_S3_ENDPOINT: z.string().optional(),
  BACKUP_S3_ACCESS_KEY: z.string().optional(),
  BACKUP_S3_SECRET_KEY: z.string().optional(),
  BACKUP_S3_REGION: z.string().optional(),

  // Optional — test database
  DATABASE_TEST_URL: z.string().optional(),

  // Dev seed script only
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

    // Check for AUTH_SECRET specifically and give a clear fatal message
    const authIssue = result.error.issues.find((i) => i.path[0] === "AUTH_SECRET");
    if (authIssue) {
      console.error(
        "\nFATAL: AUTH_SECRET is not set or is too short.\n" +
        "Run: openssl rand -base64 32\n" +
        "Then set AUTH_SECRET in your .env or environment variables.\n",
      );
    }

    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  return result.data;
}
