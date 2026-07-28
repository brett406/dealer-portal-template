# Deployment Guide — Railway

## Prerequisites
- Railway account (railway.app)
- GitHub repo with this code

## 1. Create Railway Project

1. New Project → Deploy from GitHub Repo
2. Select your repo and branch

## 2. Add PostgreSQL

1. New → Database → PostgreSQL
2. Copy the `DATABASE_URL` from the PostgreSQL service

## 3. Environment Variables

Set these in Railway → Variables:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Auto-linked from Postgres | |
| `AUTH_SECRET` | `openssl rand -base64 32` | Generate a unique value |
| `AUTH_URL` | `https://your-app.railway.app` | Your production URL |
| `NEXTAUTH_URL` | Same as AUTH_URL | |
| `NEXT_PUBLIC_SITE_URL` | Same as AUTH_URL | Canonical URL for OG tags + sitemap. Falls back to `AUTH_URL` if unset |
| `TURNSTILE_SECRET_KEY` | From Cloudflare | Required if the public forms use Turnstile |
| `CSRF_ALLOWED_ORIGINS` | `https://example.ca,https://www.example.ca` | Set when the site answers on both apex and www |
| `ADMIN_API_TOKEN` | 32+ chars | Only if server-to-server automation is used; the admin API 503s without it |
| `RESEND_API_KEY` | From resend.com | Optional: emails log to console without |
| `EMAIL_FROM` | `noreply@yourdomain.com` | Must be verified in Resend |

### Build-time variable (must be set BEFORE the build, not just at runtime)

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | From Cloudflare | Inlined into the client bundle at build time. It is declared as a Docker `ARG` — if it is missing when the image builds, the widget renders nothing and **every public form submission is rejected** once `TURNSTILE_SECRET_KEY` is set. This fails silently; check a form after the first deploy. |

`OWNER_EMAIL` / `OWNER_PASSWORD` are seed-only and are not used in production —
the first admin is created through the `/setup` wizard (step 5).

## 4. Build & Deploy

Railway auto-detects the Dockerfile. If not using Docker:

**Build Command:** `npx prisma generate && npx prisma migrate deploy && npm run build`
**Start Command:** `npm start`

## 5. Migrations & First Admin

`scripts/start.sh` runs `npx prisma migrate deploy` on every boot, so no manual
migration step is needed.

**Do not run `npx prisma db seed` against a customer database.** The seed loads
demo companies, dealers and products, and its guard refuses to run against any
host that is not local or `*-test*` anyway.

Create the first real admin by visiting `/setup` once after the first deploy.
The wizard is only available while no SUPER_ADMIN exists, and closes itself
afterwards.

## 6. Health Check

Configure Railway health check: `GET /api/health`

## 7. Persistent Uploads

Attach a Railway volume mounted at **`/app/uploads`** (the app reads
`RAILWAY_VOLUME_MOUNT_PATH`), or configure the `BACKUP_S3_*` / R2 variables.

Do **not** mount at `/app/public/uploads` — that path is inside the build output
and is wiped on every redeploy. A fork that did this lost customer media. Full
detail and the R2 setup: `docs/UPLOADS-STORAGE.md`.

## 8. Custom Domain

1. Railway → Settings → Custom Domain
2. Add CNAME record to your DNS
3. Update `AUTH_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`

## Quick Deploy Checklist

- [ ] PostgreSQL provisioned
- [ ] All env vars set
- [ ] Migrations deployed
- [ ] Seed data loaded
- [ ] Health check passing
- [ ] Admin can log in
- [ ] Custom domain (optional)
- [ ] Resend verified (optional)
- [ ] **Backups:**
  - [ ] S3/R2 bucket created
  - [ ] Backup cron service deployed (see [backup/README.md](../backup/README.md))
  - [ ] Backup env vars set (bucket, credentials, prefix)
  - [ ] First backup run manually and verified
  - [ ] Restore tested at least once
