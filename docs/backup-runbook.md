# Dealer Portal — Backup & Restore Runbook

> Replace `<project>` placeholders below with the customer name (e.g. `feversham`, `nm-attachments`) when stamping a new fork.

## Architecture

Three independent layers. Any one can fail; you're still covered.

| Layer | What | Survives | Cost |
|---|---|---|---|
| 1. Railway snapshots | Daily auto-backup, 7-day retention | Railway DB corruption, accidental truncates noticed within a week | Included in Railway |
| 2. GitHub Actions → Railway storage bucket | `pg_dump` daily, tiered keys (daily/weekly/monthly) | Railway DB-service loss, longer-tail data loss noticed weeks later | ~$0.015/GB-mo, free egress |
| 3. Manual export before risky migrations | `pg_dump` from local CLI, copy to vault | Pre-emptive — anything you knowingly might break | Time only |

The Layer-2 backup runs from GitHub Actions, not from the app — so an app-side
deploy/build problem doesn't take out the backup runner. It writes to a
dedicated Railway storage bucket (S3-compatible), separate from the app's DB
service.

> **Note on retention:** Railway buckets have **no lifecycle/expiry rules**, so
> old objects are not auto-deleted (unlike the previous Cloudflare R2 setup).
> Dumps are small and storage is ~$0.015/GB-mo, so unbounded retention is cheap.
> Add a prune step to the workflow if it ever becomes material.

---

## One-time setup (per fork)

### Step 1 — Create the Railway bucket

Railway dashboard → project → **Create** → **Bucket**, or via CLI from the repo:

```bash
railway bucket create <project>-db-backups --region sjc
```

### Step 2 — Read the bucket's S3 credentials

```bash
railway bucket credentials -b <project>-db-backups -e production --json
```

This prints `endpoint`, `accessKeyId`, `secretAccessKey`, `bucketName`, `region`.
(The `bucketName` is the globally-unique name with a hash suffix, e.g.
`<project>-db-backups-ab12cd` — that's what goes in `S3_BUCKET`.)

### Step 3 — Get the public DATABASE_URL

```bash
railway variables -s Postgres -e production --json | python3 -c \
  "import sys,json;print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])"
```

Use the **public** proxy URL (`*.proxy.rlwy.net`), not the `*.railway.internal`
one — the GitHub runner is off-platform.

### Step 4 — Add GitHub repo secrets

GitHub repo → **Settings** → **Secrets and variables** → **Actions**.

| Secret | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | Public Railway Postgres URL from step 3 |
| `S3_ENDPOINT` | yes | `endpoint` from step 2 (e.g. `https://t3.storageapi.dev`) |
| `S3_BUCKET` | yes | `bucketName` from step 2 |
| `S3_ACCESS_KEY_ID` | yes | `accessKeyId` from step 2 |
| `S3_SECRET_ACCESS_KEY` | yes | `secretAccessKey` from step 2 |
| `TELEGRAM_BOT_TOKEN` | optional | Bot token for failure pings. Workflow no-ops without it. |
| `TELEGRAM_CHAT_ID` | optional | Chat ID for the ping. Required only if the bot token is set. |

### Step 5 — Enable the daily schedule

Forks inherit the workflow with the schedule **commented out** (the template
keeps it dormant). Uncomment the `schedule:` block at the top of
`.github/workflows/db-backup.yml`:

```yaml
on:
  schedule:
    - cron: "0 7 * * *"   # 07:00 UTC = 03:00 ET
  workflow_dispatch:
```

### Step 6 — Verify with a manual run

GitHub repo → **Actions** → **Database backup → Railway storage** → **Run
workflow** on `main`. On success the log shows
`✔ Daily backup uploaded: daily/YYYY-MM-DD.dump`, and
`railway bucket info -b <project>-db-backups -e production` shows the object
count climb. If it fails, the "Validate secrets" step names the missing secret.

---

## Restoring from a backup

> Requires `postgresql-client-18` (or newer) locally — the DB is PG18 and
> `pg_restore` must be ≥ the dump's server version — plus the AWS CLI.

### Quarterly test restore (do this every 3 months)

A backup you've never restored is theatre.

```bash
# 1. Throwaway local Postgres
createdb portal_restore_test

# 2. Bucket creds into the env
eval "$(railway bucket credentials -b <project>-db-backups -e production \
  | sed -E 's/^AWS_ENDPOINT_URL=/S3_ENDPOINT=/;s/^AWS_ACCESS_KEY_ID=/S3_ACCESS_KEY_ID=/;s/^AWS_SECRET_ACCESS_KEY=/S3_SECRET_ACCESS_KEY=/;s/^AWS_S3_BUCKET_NAME=/S3_BUCKET=/' \
  | grep -E '^S3_')"
export S3_ENDPOINT S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_BUCKET

# 3. Restore the latest daily
./scripts/restore-from-backup.sh daily/$(date -u +%Y-%m-%d).dump \
  postgres://localhost:5432/portal_restore_test

# 4. Smoke test — counts should look reasonable
psql postgres://localhost:5432/portal_restore_test <<'SQL'
SELECT 'User'    AS table, count(*) FROM "User"
UNION ALL SELECT 'Company', count(*) FROM "Company"
UNION ALL SELECT 'Order',   count(*) FROM "Order"
UNION ALL SELECT 'Product', count(*) FROM "Product";
SQL

# 5. Tear down
dropdb portal_restore_test
```

Calendar reminder: every Feb 1 / May 1 / Aug 1 / Nov 1.

### Safety guard on `restore-from-backup.sh`

By default the script **refuses** any host that isn't `localhost`, `127.0.0.1`,
or matches `*-test*`/`*_test*` — it's destructive (`pg_restore --clean
--if-exists` drops every object first). For genuine DR into a fresh production
DB, set `ALLOW_PROD_RESTORE=1`. The script prints the resolved target host
before doing anything.

### Disaster recovery — full restore into a new Railway DB

If production is gone or corrupted:

1. **Stop the app** so writes don't pile onto stale state (Railway → app service → remove the public domain or pause the deploy).
2. **Provision a fresh Postgres** in the same Railway project. Note its public `DATABASE_URL`.
3. **Pick the dump.** Browse keys with
   `railway bucket info` then list via the AWS CLI against `$S3_ENDPOINT`, or just take the latest `daily/`. If the bad state was already in yesterday's dump, walk back through `weekly/` / `monthly/`.
4. **Restore:**
   ```bash
   eval "$(railway bucket credentials -b <project>-db-backups -e production \
     | sed -E 's/^AWS_ENDPOINT_URL=/S3_ENDPOINT=/;s/^AWS_ACCESS_KEY_ID=/S3_ACCESS_KEY_ID=/;s/^AWS_SECRET_ACCESS_KEY=/S3_SECRET_ACCESS_KEY=/;s/^AWS_S3_BUCKET_NAME=/S3_BUCKET=/' | grep -E '^S3_')"
   export S3_ENDPOINT S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_BUCKET

   ALLOW_PROD_RESTORE=1 ./scripts/restore-from-backup.sh <chosen-key> "$NEW_DATABASE_URL"
   ```
5. **Smoke test** — log in as super-admin, check recent orders.
6. **Point the app at the new DB** — update `DATABASE_URL` on the app service, redeploy.
7. **Communicate** to dealers about anything lost between the dump and the incident (they hold email confirmations).
8. **Postmortem.**

### Restoring just one table

```bash
pg_restore --list portal-restore.dump            # see what's inside
pg_restore --no-owner --no-acl --clean --if-exists \
  --table=Order --dbname "$DATABASE_URL" portal-restore.dump
```

---

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Workflow fails at "Validate secrets" | A GitHub secret is missing/empty | Re-add per Step 4 |
| `pg_dump: aborting because of server version mismatch` | Client older than the PG18 server | Workflow installs client 18 from PGDG and calls it by full path; locally, install `postgresql-client-18` |
| `pg_dump: connection failed` | Wrong `DATABASE_URL`, or DB paused | Use the public `*.proxy.rlwy.net` URL, not `*.railway.internal` |
| `aws s3 cp ... Access Denied` | Stale/rotated bucket creds | Re-read `railway bucket credentials` and update the secrets (use `--reset` to rotate) |
| Nothing in `weekly/` or `monthly/` | Not Sunday / not the 1st | Expected — check `daily/` |

---

## Future hardening (not done yet)

- **Prune step** — Railway has no lifecycle expiry; add a step that deletes `daily/` objects older than N days if storage ever grows enough to matter.
- **GPG-encrypt the dump before upload** — defense against a storage-account compromise.
- **Second cloud destination** — full 3-2-1 (e.g. Backblaze B2 mirror).
- **Telegram failure alerts** — set `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` so failures page instead of relying on GitHub's email.
