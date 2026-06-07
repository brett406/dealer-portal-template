# Uploads & media storage — the durable-storage contract

**This is fleet-wide.** Every dealer-portal fork inherits this upload code. Read
this before deploying any fork that accepts file uploads (admin Media Library,
dealer Files). Getting it wrong silently destroys customer files.

## The incident this prevents (twice now)

Uploaded media (admin Media Library / dealer Files) was written to the
container's **ephemeral disk** (`/app/public/uploads`) because the production
service had **no persistent volume and no R2 configured**. Railway wipes that
disk on **every redeploy**, so a customer's uploads were erased the next time the
app shipped. There was no offsite backup, so the files were unrecoverable.

## The contract

An upload must be saved somewhere that **survives a redeploy**. The app now
**refuses to accept an upload it can't persist** — see
`getStorageDurability()` in `lib/uploads.ts`. Durable means **either**:

- a **persistent volume** is mounted — `RAILWAY_VOLUME_MOUNT_PATH` (auto-set when
  you attach a Railway volume) or `UPLOADS_DIR` points at a persistent path; **or**
- **R2/S3** is configured — `BACKUP_S3_BUCKET` + `BACKUP_S3_ACCESS_KEY` +
  `BACKUP_S3_SECRET_KEY` (+ optional `BACKUP_S3_ENDPOINT`, `BACKUP_S3_PREFIX`).

In development the local `public/uploads` dir persists, so it counts as durable.
In **production**, neither configured ⇒ uploads are **disabled** (the upload
action throws a clear error) and the boot logs scream a warning.

## How it works (`lib/uploads.ts` + `app/api/uploads/[filename]`)

- **Where files live:** `getUploadsDir()` → volume (`RAILWAY_VOLUME_MOUNT_PATH/uploads`)
  → `UPLOADS_DIR` → `public/uploads` (dev only).
- **URL:** `getUploadUrl()` always returns the auth-gated `/api/uploads/<file>`
  route (never the ungated static `/uploads/...`, which Railway doesn't serve).
- **On upload (`saveUpload`):** durability gate first; if R2 is configured, write
  to R2 **and await it** (R2 is the durable source of truth — not the old
  fire-and-forget); then write to local disk (the volume, or a cache in front of R2).
- **On serve:** read local disk; on a miss (fresh container after redeploy),
  **fall back to R2** and refill the local cache. So a redeploy can't break media.
- **Guardrails:** `scripts/start.sh` logs a loud warning in prod when storage is
  ephemeral; `GET /api/health` reports `uploads: { durable, via }` for monitoring.

## Required production setup (per fork)

Pick at least one; **both** is best (volume = fast primary, R2 = offsite backup):

1. **Railway volume (minimum):** attach a volume to the **web** service, e.g.
   mounted at `/app/uploads`. Railway sets `RAILWAY_VOLUME_MOUNT_PATH`
   automatically; no code change needed. Uploads then survive redeploys.
2. **R2 (recommended, offsite):** set `BACKUP_S3_*` on the **web** service. Reuse
   the same R2 bucket as the DB backups — uploads land under the `uploads/`
   key-prefix, separate from DB dumps. This is the only way to survive volume loss.

## Verify after deploying

- `GET /api/health` → `uploads.durable: true` (and `via: "volume"` or `"r2"`).
- Upload a test image, then **redeploy twice**, and confirm it still loads. If it
  survives a redeploy, storage is durable.

## Recovery (if files are already lost)

- If R2 was configured at upload time, files are in the bucket → the serve route's
  R2 fallback restores them automatically once R2 env is set.
- If neither volume nor R2 existed at upload time, the files are **gone** — the
  customer must re-upload (only after durable storage is in place).

## Propagation

Keep this behaviour identical across the template and every fork
(`lib/uploads.ts`, `app/api/uploads/[filename]/route.ts`, `scripts/start.sh`,
`app/api/health/route.ts`). Audit every active fork for a missing web volume /
R2 config — a fork without either is the same time bomb.
