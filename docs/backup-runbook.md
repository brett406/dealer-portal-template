# Dealer Portal — Backup & Restore Runbook

> Replace `<project>` placeholders below with the customer name (e.g. `bauman-custom-products`, `nm-attachments`) when stamping a new fork.

## Architecture

Three independent layers. Any one can fail; you're still covered.

| Layer | What | Survives | Cost |
|---|---|---|---|
| 1. Railway snapshots | Daily auto-backup, 7-day retention | Railway DB corruption, accidental table truncates noticed within a week | Included in Railway Pro |
| 2. GitHub Actions → Cloudflare R2 | `pg_dump` daily, retention ladder (14 daily / 12 weekly / 12 monthly) | Railway account locked, project deleted, longer-tail data loss noticed weeks later | $0/mo (free tiers cover it) |
| 3. Manual export before risky migrations | `pg_dump` from local CLI, copy to vault | Pre-emptive — anything you knowingly might break | Time only |

The off-platform R2 backup runs from GitHub Actions, not Railway — so a Railway-side incident doesn't take out the backup runner.

---

## One-time setup

### Step 1 — Create the R2 bucket

1. Cloudflare dashboard → **R2** → **Create bucket**
2. Name: `<project>-backups`
3. Location: Automatic (or pick `WNAM` for North America)
4. Default storage class: Standard
5. Click **Create bucket**

### Step 2 — Generate an R2 API token

1. R2 → **Manage R2 API Tokens** → **Create API token**
2. Token name: `<project>-github-actions`
3. Permission: **Object Read & Write** *(not the broader admin one)*
4. Bucket: scope to `<project>-backups` only
5. TTL: leave forever, or set 1 year and rotate annually
6. Click **Create API Token**
7. Copy the **Access Key ID**, **Secret Access Key**, and **Endpoint URL**. The endpoint is shaped like `https://<account-id>.r2.cloudflarestorage.com` — extract the `<account-id>`.

### Step 3 — Add lifecycle rules to the bucket

R2 deletes old backups for us based on path prefix.

R2 dashboard → bucket → **Settings** → **Object lifecycle rules** → **Add rule** (do this 3 times):

| Rule name | Prefix filter | Action | Days |
|---|---|---|---|
| Expire daily | `daily/` | Delete object | 14 |
| Expire weekly | `weekly/` | Delete object | 84 |
| Expire monthly | `monthly/` | Delete object | 366 |

### Step 4 — Add GitHub repo secrets

GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | The `DATABASE_URL` value from Railway → Postgres service → Variables. Use the **public** URL, not the `*.railway.internal` one. |
| `R2_ACCOUNT_ID` | yes | Cloudflare account ID (from the endpoint URL) |
| `R2_ACCESS_KEY_ID` | yes | From step 2 |
| `R2_SECRET_ACCESS_KEY` | yes | From step 2 |
| `R2_BUCKET` | yes | `<project>-backups` |
| `TELEGRAM_BOT_TOKEN` | optional | Bot token if you want failure notifications. Workflow no-ops without it. |
| `TELEGRAM_CHAT_ID` | optional | Chat ID to receive the failure ping. Required only if `TELEGRAM_BOT_TOKEN` is set. |

### Step 5 — Verify with a manual run

GitHub repo → **Actions** → **Database backup → Cloudflare R2** → **Run workflow** → run on `main`.

When it succeeds:
- The Actions log shows `✔ Daily backup uploaded: daily/YYYY-MM-DD.dump`
- R2 dashboard shows the file under `daily/`

If it fails: read the validation step output — it will name which secret is missing or wrong.

---

## Restoring from a backup

### Quarterly test restore (do this every 3 months)

Goal: prove the dumps actually restore. A backup you've never restored is theatre.

```bash
# 1. Spin up a throwaway Postgres locally (or a free Neon/Railway DB)
createdb portal_restore_test

# 2. Pull the latest daily and restore
export R2_ACCOUNT_ID=...
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
export R2_BUCKET=<project>-backups

./scripts/restore-from-r2.sh daily/$(date -u +%Y-%m-%d).dump \
  postgres://localhost:5432/portal_restore_test

# 3. Smoke test — table counts should look reasonable
psql postgres://localhost:5432/portal_restore_test <<'SQL'
SELECT 'User'        AS table, count(*) FROM "User"
UNION ALL SELECT 'Company',     count(*) FROM "Company"
UNION ALL SELECT 'Order',       count(*) FROM "Order"
UNION ALL SELECT 'Product',     count(*) FROM "Product";
SQL

# 4. Tear down
dropdb portal_restore_test
```

Calendar reminder: every Feb 1 / May 1 / Aug 1 / Nov 1.

### Safety guard on `restore-from-r2.sh`

By default, the restore script **refuses** to run against any host that isn't `localhost`, `127.0.0.1`, or matches `*-test*`/`*_test*`. This is deliberate: it's destructive (`pg_restore --clean --if-exists` drops every object before recreating).

For genuine disaster recovery into a fresh production DB, set `ALLOW_PROD_RESTORE=1`:

```bash
ALLOW_PROD_RESTORE=1 ./scripts/restore-from-r2.sh weekly/2026-W18.dump "$NEW_DATABASE_URL"
```

The script prints the resolved target host before doing anything, so you can sanity-check before letting it proceed.

### Disaster recovery — full restore into a new Railway DB

If the production DB is gone or corrupted:

1. **Stop the app** so writes don't pile on top of a stale state. Railway dashboard → app service → **Settings** → toggle the deployment off, or remove the public domain.
2. **Provision a fresh Postgres** in the same Railway project. Note the new `DATABASE_URL`.
3. **Pick the dump to restore** — most recent daily is usually right, but if you suspect the bad state was already in yesterday's dump, walk back through weekly/monthly. Cloudflare dashboard → R2 → bucket → browse `daily/`, `weekly/`, `monthly/`.
4. **Restore:**
   ```bash
   export R2_ACCOUNT_ID=...
   export R2_ACCESS_KEY_ID=...
   export R2_SECRET_ACCESS_KEY=...
   export R2_BUCKET=<project>-backups

   ALLOW_PROD_RESTORE=1 ./scripts/restore-from-r2.sh <chosen-key> "$NEW_DATABASE_URL"
   ```
5. **Smoke test** — log in as super-admin, look at recent orders.
6. **Update `DATABASE_URL` on the app service** to point at the new DB. Redeploy.
7. **Communicate** to dealers if any orders/quotes between the dump time and the incident were lost. They will have the email confirmations on their side.
8. **Postmortem** — what failed, what the warning signs were, whether the runbook needs to change.

### Restoring just one table

`pg_restore` supports selective restore. If only one table is corrupted, you don't need to wipe everything:

```bash
# List what's in the dump
pg_restore --list portal-restore.dump

# Restore one table only, into the live DB (CAREFUL — drops the live table first)
pg_restore --no-owner --no-acl --clean --if-exists \
  --table=Order \
  --dbname "$DATABASE_URL" portal-restore.dump
```

---

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Workflow fails at "Validate secrets" | A GitHub secret is missing or empty | Re-add per Step 4 |
| `pg_dump: error: connection failed` | Wrong `DATABASE_URL`, or Railway DB paused/unreachable | Use the public Railway URL, not `.railway.internal` |
| `aws s3 cp ... Access Denied` | R2 token doesn't have write on this bucket | Recreate token with **Object Read & Write** scoped to the bucket |
| Restore aborts on a constraint violation | Dump is from a newer schema than target | Run `prisma migrate deploy` against the empty target first, then restore with `--data-only` |
| Workflow runs but nothing in `weekly/` or `monthly/` | Today is not Sunday / not the 1st | Expected — check daily/ folder |

---

## Future hardening (not done yet)

- **GPG-encrypt the dump before upload** — defense against a Cloudflare account compromise. Adds a key-management burden. Consider after first incident response review.
- **Second cloud destination** — full 3-2-1 (Backblaze B2 mirror). Halves the cost of dual-vendor risk; doubles the maintenance.
- **Point-in-time recovery via WAL archiving** — much more complex; only worth it if RPO needs to be minutes instead of hours. Today's worst case is ~24 hours of loss (last daily dump).
