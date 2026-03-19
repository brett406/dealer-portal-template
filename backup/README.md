# Dealer Portal — Backup Service

Automated PostgreSQL backups with S3/R2 storage and rotation. Runs as a Railway cron job alongside the dealer portal.

## What It Does

- Dumps the PostgreSQL database using `pg_dump`
- Compresses with gzip (~90% size reduction)
- Uploads to an S3-compatible bucket (AWS S3 or Cloudflare R2)
- Rotates old backups: 7 daily, 4 weekly (Sundays), 3 monthly (1st of month)
- Sends email alerts on failure (optional, via Resend)

## Deploy on Railway

### 1. Create S3/R2 Bucket

**Cloudflare R2** (recommended — no egress fees):
1. Cloudflare dashboard → R2 → Create Bucket
2. Create an API token with read/write access
3. Note the endpoint URL: `https://<account-id>.r2.cloudflarestorage.com`

**AWS S3:**
1. Create an S3 bucket
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` permissions
3. Note the access key and secret key

### 2. Add Cron Service to Railway

1. In your Railway project, click **New → Service**
2. Connect to the same GitHub repo
3. Set **Root Directory** to `backup/`
4. Set **Build Command** to (empty — Dockerfile handles it)
5. Set as **Cron Job** with schedule: `0 2 * * *` (daily at 2 AM UTC)

### 3. Set Environment Variables

In Railway → backup service → Variables:

| Variable | Value | Required |
|---|---|---|
| `BACKUP_DATABASE_URL` | Copy from main app's `DATABASE_URL` | Yes |
| `BACKUP_S3_BUCKET` | Your bucket name | Yes |
| `BACKUP_S3_ACCESS_KEY` | S3/R2 access key | Yes |
| `BACKUP_S3_SECRET_KEY` | S3/R2 secret key | Yes |
| `BACKUP_S3_ENDPOINT` | R2 endpoint URL (blank for AWS) | R2 only |
| `BACKUP_S3_REGION` | `auto` for R2, region for AWS | Yes |
| `BACKUP_S3_PREFIX` | `client-name/` | Yes |
| `BACKUP_RETENTION_DAILY` | `7` | No (default) |
| `BACKUP_RETENTION_WEEKLY` | `4` | No (default) |
| `BACKUP_RETENTION_MONTHLY` | `3` | No (default) |
| `BACKUP_ALERT_EMAIL` | Admin email for failure alerts | No |
| `RESEND_API_KEY` | Resend API key for alerts | No |

### 4. Test Manually

In Railway → backup service → Shell:

```bash
./backup.sh
```

Check the output for "Backup complete!" and verify the file exists in your bucket.

### 5. Verify

- Check Railway logs daily to confirm "Backup complete!" messages
- Periodically list backups: `./restore.sh --list daily`
- Test restore at least once (see below)

## Restore from Backup

### List Available Backups

```bash
./restore.sh --list daily
./restore.sh --list weekly
./restore.sh --list monthly
```

### Restore to Database

```bash
# Set target database (can be different from production for testing)
export BACKUP_DATABASE_URL=postgresql://user:pass@host:5432/restore_test

# Restore a specific backup
./restore.sh daily/dealer-portal_2026-03-18_020000.sql.gz
```

The script will:
1. Ask for confirmation (type `yes`)
2. Download and decompress the backup
3. Restore to the target database
4. Print verification instructions

### Restore to Production

```bash
# Use the production DATABASE_URL
export BACKUP_DATABASE_URL=<production-database-url>
./restore.sh daily/dealer-portal_2026-03-18_020000.sql.gz

# After restore, restart the app to clear caches
```

## Backup Structure

```
s3://bucket/client-name/
├── daily/
│   ├── dealer-portal_2026-03-18_020000.sql.gz   (today)
│   ├── dealer-portal_2026-03-17_020000.sql.gz   (yesterday)
│   └── ...                                       (7 days)
├── weekly/
│   ├── dealer-portal_2026-03-17_020000.sql.gz   (this Sunday)
│   └── ...                                       (4 weeks)
└── monthly/
    ├── dealer-portal_2026-03-01_020000.sql.gz   (this month)
    └── ...                                       (3 months)
```

## Troubleshooting

| Issue | Fix |
|---|---|
| `pg_dump: connection refused` | Check `BACKUP_DATABASE_URL` is correct and the DB allows connections |
| `S3 upload failed` | Check bucket name, credentials, and endpoint URL |
| `Access Denied` on S3 | Verify IAM permissions include `s3:PutObject` and `s3:ListBucket` |
| Cron not running | Check Railway cron schedule format: `0 2 * * *` |
| Large backup files | Normal — a portal with 10K products is ~50-200MB compressed |
