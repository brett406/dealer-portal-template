import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getStorageDurability, saveUpload } from "@/lib/uploads";

// Force a clean "no durable storage" baseline; each test stubs what it needs.
beforeEach(() => {
  vi.stubEnv("RAILWAY_VOLUME_MOUNT_PATH", "");
  vi.stubEnv("UPLOADS_DIR", "");
  vi.stubEnv("BACKUP_S3_BUCKET", "");
  vi.stubEnv("BACKUP_S3_ACCESS_KEY", "");
  vi.stubEnv("BACKUP_S3_SECRET_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getStorageDurability", () => {
  it("production with neither a volume nor R2 is NOT durable (ephemeral)", () => {
    vi.stubEnv("NODE_ENV", "production");
    const s = getStorageDurability();
    expect(s.durable).toBe(false);
    expect(s.hasVolume).toBe(false);
    expect(s.hasR2).toBe(false);
  });

  it("production with a Railway volume is durable", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RAILWAY_VOLUME_MOUNT_PATH", "/app/uploads");
    const s = getStorageDurability();
    expect(s.durable).toBe(true);
    expect(s.hasVolume).toBe(true);
  });

  it("production with UPLOADS_DIR is durable", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPLOADS_DIR", "/data/uploads");
    expect(getStorageDurability().durable).toBe(true);
  });

  it("production with R2 fully configured is durable", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BACKUP_S3_BUCKET", "bucket");
    vi.stubEnv("BACKUP_S3_ACCESS_KEY", "key");
    vi.stubEnv("BACKUP_S3_SECRET_KEY", "secret");
    const s = getStorageDurability();
    expect(s.durable).toBe(true);
    expect(s.hasR2).toBe(true);
  });

  it("production with a PARTIAL R2 config (missing secret) is NOT durable", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BACKUP_S3_BUCKET", "bucket");
    vi.stubEnv("BACKUP_S3_ACCESS_KEY", "key");
    expect(getStorageDurability().hasR2).toBe(false);
    expect(getStorageDurability().durable).toBe(false);
  });

  it("development is durable even without a volume/R2 (local disk persists)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getStorageDurability().durable).toBe(true);
  });
});

describe("saveUpload durability gate", () => {
  it("REFUSES to save when production storage isn't durable (no silent loss)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const file = new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" });
    await expect(saveUpload(file)).rejects.toThrow(/durable storage/i);
  });
});
