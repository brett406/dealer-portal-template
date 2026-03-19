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
| `NEXT_PUBLIC_BASE_URL` | Same as AUTH_URL | For email links |
| `RESEND_API_KEY` | From resend.com | Optional: emails log to console without |
| `EMAIL_FROM` | `noreply@yourdomain.com` | Must be verified in Resend |
| `OWNER_EMAIL` | `admin@yourcompany.com` | Super admin login |
| `OWNER_PASSWORD` | A secure password | Change after first login |

## 4. Build & Deploy

Railway auto-detects the Dockerfile. If not using Docker:

**Build Command:** `npx prisma generate && npx prisma migrate deploy && npm run build`
**Start Command:** `npm start`

## 5. Run Migrations & Seed

In Railway shell (or via deploy command):

```bash
npx prisma migrate deploy
npx prisma db seed
```

## 6. Health Check

Configure Railway health check: `GET /api/health`

## 7. Persistent Uploads

For file uploads, configure a Railway volume mounted at `/app/public/uploads`.

## 8. Custom Domain

1. Railway → Settings → Custom Domain
2. Add CNAME record to your DNS
3. Update `AUTH_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`

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
