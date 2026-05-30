# Media Management — Build Spec

**Branch:** `feature/media-management` · **Repo:** `brett406/dealer-portal-template` · **Status:** Phase 0 done (this doc + safety hardening). Phases 1–6 not started.

> Read this whole doc before writing code. It is self-contained — do **not** assume any memory, CLAUDE.md, or context from another machine. Everything you need is here.

---

## 1. What we're building & why

The portal admin (the manufacturer) needs to create and organize **folders of files** — brochures, product images, spec sheets, anything — and make them available to **logged-in dealers** to browse and download. This is **not** a public/marketing feature; it is dealer-only, behind auth.

Think Dropbox-lite scoped to the dealer portal: admin manages folders + files; dealers browse + download.

**Target UI** (admin management view) = a left **folder sidebar** with colored folder icons + a main **file table** (NAME / TYPE / UPLOADED / ACTIONS). Standard sidebar+main pattern. The dealer view is a **read-only** version of the same.

This is the **canonical template**. Builds like BHF, Feversham, NM, BCP derive from it. Get v1 rock-solid here; porting to client builds is a separate, manual, reviewed step later.

---

## 2. The big reframe: ~60% is already built

Do **not** build a media system from scratch. The data model and storage layer already exist. Map of current state:

| Requirement | Status today | File(s) |
|---|---|---|
| Folder data model | ✅ `AssetFolder` exists (created in `init` migration) | `prisma/schema.prisma` |
| File data model | ✅ `Asset` exists, `folderId` nullable, `onDelete: SetNull` | `prisma/schema.prisma` |
| Upload + storage | ✅ local disk + S3/R2 backup | `lib/uploads.ts`, `app/api/upload/route.ts` |
| File serving | ⚠️ exists but **unauthenticated**, images-only MIME map, no download disposition | `app/api/uploads/[filename]/route.ts` |
| Admin media page | ⚠️ exists but **upload + delete only** — no folders in UI | `app/admin/media/{page,media-client}.tsx`, `actions.ts` |
| **Make folder** | ❌ no folder CRUD or UI (model is unused by the UI) | build |
| **Rename / recolor / delete folder** | ❌ | build |
| **Reorganize (move files / reorder folders)** | ❌ | build |
| **Any file type** | ❌ `lib/uploads.ts` allows images only, 5MB cap | relax |
| **Accent color** | ❌ not in schema | add `accentColor` |
| **Dealer-facing view** | ❌ portal has dashboard/catalog/cart/orders/account, no Files page | build |

Existing models (verbatim from `prisma/schema.prisma`):

```prisma
model AssetFolder {
  id             String   @id @default(cuid())
  name           String   @unique
  slug           String   @unique
  description    String?
  updatedByEmail String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  assets         Asset[]
}

model Asset {
  id             String       @id @default(cuid())
  filename       String
  originalName   String
  title          String?
  description    String?
  mimeType       String
  size           Int
  storagePath    String       @unique
  altText        String?
  folderId       String?
  updatedByEmail String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  folder         AssetFolder? @relation(fields: [folderId], references: [id], onDelete: SetNull)
  @@index([folderId, createdAt])
}
```

---

## 3. Locked decisions (do not relitigate)

- **Flat folders** — no nesting/subfolders. "Reorganize" = (a) move files between folders, (b) reorder the folder list in the sidebar.
- **Folders + accent colors only — NO tags in v1.** (An earlier mockup showed per-file tag pills; deferred to v2. Don't build tags.)
- **File policy: broad allowlist, 25 MB cap.** Allow pdf, images, office docs, csv/txt, common CAD, zip, video. **Block executables.** (See Phase 2 for the exact list.)
- **UI:** match the existing template conventions — **plain CSS** (co-located `*.css` files) + the `components/ui/*` primitives (`Button`, `Modal`, `Input`, `Table`, `Toast`). **This template is NOT shadcn.** Don't introduce a new UI lib.
- **All approved dealers see all folders.** No per-dealer / per-folder visibility scoping in v1.
- **Admin uploads & manages. Dealers download only.** Dealers never create/rename/delete/upload.

---

## 4. Safety rules — NON-NEGOTIABLE (read `DATABASE_SAFETY.md`)

This template caused a production wipe once. Before **any** DB-touching command:

1. **Resolve and print the DB host.** Only proceed if it is `localhost`, `127.0.0.1`, or matches `*-test*` / `*_test*`.
2. **Never** run `npm test`, `npm run db:*`, or `prisma migrate/db push/seed/reset` against a non-local `DATABASE_URL`.
3. Production `DATABASE_URL` lives only in Railway — it must **never** be in a `.env` on disk. If you see a prod hostname (`railway.app`, `supabase.co`, `neon.tech`, `rds.amazonaws.com`) in any `.env*`, stop and tell Brett.
4. `--force` is banned in package scripts. The reset scripts are gated on `DATABASE_TEST_URL` for this reason.
5. Work on the `feature/media-management` branch; commit each phase so there's always a recovery point.

---

## 5. Environment setup (Framework Desktop)

```bash
# 1. Clone + branch
git clone https://github.com/brett406/dealer-portal-template.git
cd dealer-portal-template
git checkout feature/media-management

# 2. Install
npm install

# 3. Local Postgres — create dev + test DBs (LOCAL ONLY)
createdb dealer_portal_dev   2>/dev/null || true
createdb dealer_portal_test  2>/dev/null || true

# 4. .env  (localhost ONLY — never paste a Railway/prod URL here)
cat > .env <<'EOF'
DATABASE_URL=postgresql://localhost:5432/dealer_portal_dev
DATABASE_TEST_URL=postgresql://localhost:5432/dealer_portal_test
AUTH_SECRET=__run: openssl rand -base64 32 and paste__
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
UPLOADS_DIR=public/uploads
OWNER_EMAIL=admin@example.com
OWNER_PASSWORD=changeme123
EOF
# generate AUTH_SECRET:  openssl rand -base64 32   → paste into .env

# 5. Confirm host is local, THEN migrate + seed (dev DB)
node -e "console.log('DB host:', new URL(process.env.DATABASE_URL).hostname)" # must print localhost
npx prisma migrate deploy        # applies existing migrations
npm run db:seed                  # optional: demo data
npm run dev                      # http://localhost:3000
```

Log in at `/auth/login` with `OWNER_EMAIL`/`OWNER_PASSWORD` (created by the setup flow / seed). Admin media lives at `/admin/media`.

---

## 6. The build — 6 phases, each is a commit/checkpoint

### Phase 1 — Data model
Add to `AssetFolder` in `prisma/schema.prisma`:
```prisma
  accentColor String?  // palette key: "slate" | "red" | "orange" | "blue" | "purple" | "green"
  sortOrder   Int     @default(0)
```
- Create migration **against the local dev DB only**: `npx prisma migrate dev --name media_folder_color_sort` (print host first).
- Define the palette once in a shared module (e.g. `lib/folder-colors.ts`): map each key → `{ label, hex }` for icon tint + swatch. Default new folders to `"slate"`.
- `Asset.folderId` already supports move (nullable + SetNull). No Asset change needed.
- **Commit.**

### Phase 2 — Storage layer (incl. the privacy fix)
**`lib/uploads.ts`:**
- Replace the image-only `ALLOWED_TYPES` / `ALLOWED_EXTENSIONS` with a broad allowlist. Suggested extensions:
  `.pdf .jpg .jpeg .png .webp .gif .svg .doc .docx .xls .xlsx .ppt .pptx .csv .txt .zip .dwg .dxf .step .stp .iges .igs .mp4 .mov .webm`
  with matching MIME types where known; **allow `application/octet-stream`** when the extension is allowlisted (CAD/zip often report octet-stream).
- **Block** executable/script extensions explicitly: `.exe .bat .cmd .sh .com .msi .app .dll .scr .js .jar .ps1`.
- Bump `MAX_FILE_SIZE` to `25 * 1024 * 1024`.
- Keep `sanitizeFilename` (preserves extension) and the S3/R2 backup behavior.

**`app/api/uploads/[filename]/route.ts` — CRITICAL privacy fix:**
- Today it serves **any file to anyone with the URL, with no auth.** Dealer media must be login-gated.
- Add at the top of `GET`: `const session = await auth(); if (!session?.user) return 401/redirect.` (import `auth` from `@/lib/auth`). Any authenticated user (admin or approved dealer) may download; anonymous may not.
- Extend the `MIME_TYPES` map to cover the new allowlist; fall back to `application/octet-stream`.
- Add `Content-Disposition`: `attachment; filename="<originalName>"` for non-previewable types (and a `?inline=1` or `?download=1` option if you want inline image preview vs forced download — your call, keep it simple).
- Change `Cache-Control` from `public, immutable` to **`private, max-age=...`** (these are not public assets).
- Keep the existing path-traversal guard.
- Note: in local dev, files under `public/uploads` are *also* statically served by Next at `/uploads/...` (ungated). For dealer-private correctness, **always link downloads through `/api/uploads/<filename>`**, never `/uploads/...`. In Railway prod, files live on the volume and are only reachable via this route anyway.

**Verify:** Next.js App-Router route handlers must accept a 25 MB multipart body. Test an upload near the cap; if it 413s, configure the route accordingly.
- **Commit.**

### Phase 3 — Admin folder CRUD (server actions)
In `app/admin/media/actions.ts` (all `requireAdmin`, mirror the existing `FormState` return + `revalidatePath("/admin/media")` pattern):
- `createFolder({ name, accentColor })` → generate unique `slug` (see `lib/slug.ts` if present), enforce unique name, default color `"slate"`, `sortOrder` = max+1.
- `renameFolder(id, name)` → regenerate slug, enforce unique.
- `setFolderColor(id, accentColor)` → validate against palette keys.
- `deleteFolder(id)` → deletes the folder; its assets' `folderId` goes null via `SetNull` (files are **not** deleted, they become "unfiled"). Surface this in the confirm dialog.
- `reorderFolders(orderedIds: string[])` → write `sortOrder`.
- `moveAssets(assetIds: string[], folderId: string | null)` → reassign folder.
- Extend `createMediaAsset` to accept optional `folderId` so uploads land in the selected folder.
- Write an `AuditLog` row on each mutation if the repo's `lib/audit.ts` makes it easy (match how other admin actions log). Optional but preferred.
- **Commit.**

### Phase 4 — Admin media UI rebuild (the mockup)
Rebuild `app/admin/media/page.tsx` + `media-client.tsx` + `media.css`:
- `page.tsx`: query folders (`prisma.assetFolder.findMany` ordered by `sortOrder`, with `_count.assets`) **and** assets (with `folderId`, `mimeType`, `size`, `originalName`, `createdAt`, `title`). Currently it only queries assets — add the folder query.
- Layout: **left sidebar** = `FOLDERS` list. "All Files" pinned at top, then folders each rendered with a **folder icon tinted by `accentColor`** + file count. `+ New Folder` button. Per-folder actions (rename / recolor / delete) via a row menu or hover affordance.
- **Main** = toolbar (`Upload File` into the selected folder, `+ New Folder`) + a file **table**: file-type icon, NAME, TYPE (uppercase ext), UPLOADED (date), ACTIONS (Open/download, Move to folder, Delete). Selecting a folder filters the table; "All Files" shows everything.
- File-type icon: derive from mime/extension (pdf, image thumb, doc, sheet, generic). Tint chips/icons to match the mockup feel.
- "Move to folder" = a dropdown/modal per row (or multi-select) → `moveAssets`.
- New Folder / rename modal includes the **accent color picker** (palette swatches from `lib/folder-colors.ts`).
- Use `components/ui/{Button,Modal,Input,Table,Toast}` + co-located `media.css`. Plain CSS, **not shadcn**. See `DESIGN-SKILL.md` for the template's visual conventions.
- **Commit.**

### Phase 5 — Dealer-facing browser (read-only)
- New route `app/(portal)/portal/files/page.tsx` guarded by `requireCustomer` (already in `lib/auth-guards.ts`).
- Read-only version of the sidebar+table: browse folders, search/filter, **Download** only. No upload / new folder / rename / move / delete.
- Downloads link through `/api/uploads/<filename>` (the now-gated route), never `/uploads/...`.
- Add one nav entry in `components/portal/PortalHeader.tsx` `NAV_LINKS`: `{ href: "/portal/files", label: "Files" }` (label per Brett — default "Files").
- **Commit.**

### Phase 6 — Tests + verification
- **Unit** (`tests/unit/`): `validateFile` accepts the new types + rejects executables + enforces 25 MB; folder slug uniqueness; palette-key validation.
- **Integration** (`tests/integration/`): folder create/rename/recolor/delete (assets unfiled on delete); `moveAssets`; **a CUSTOMER cannot call the admin folder actions** (requireAdmin redirects); the serving route returns 401 for anonymous and 200 for an authed user.
- Run the full suite **against the local test DB only**: confirm `DATABASE_TEST_URL` host is local, then `npm run test`.
- Manually verify Brett's acceptance checklist (§7) in the running app, ideally with a short Loom/screenshots.
- **Commit.**

---

## 7. Acceptance test (Brett's bar — must all pass)

- [ ] Create a folder (with an accent color)
- [ ] Rename a folder
- [ ] Reorganize: move a file into a different folder **and** reorder the folder list
- [ ] Upload a non-image file (e.g. a PDF) — it accepts and downloads correctly
- [ ] Folder accent color is visible and distinguishes folders in the sidebar
- [ ] A logged-in **dealer** can browse folders and download files at `/portal/files`
- [ ] A logged-out visitor **cannot** reach the files or download URLs

---

## 8. Out of scope for v1 (don't build)
- Tags / per-file labels (deferred — was in an early mockup)
- Nested/subfolders
- Per-dealer or per-price-level folder visibility
- Drag-and-drop reordering (a simple up/down or order control is fine; fancy DnD optional)
- Image transforms / thumbnails generation (use the file itself)

## 9. Conventions to match (so it looks native to the codebase)
- Server actions with `"use server"`, `requireAdmin` / `requireCustomer` guards from `lib/auth-guards.ts`, `revalidatePath` after mutations, `FormState` return shape (see existing `app/admin/media/actions.ts`).
- Prisma access via `@/lib/prisma`. Uploads via `@/lib/uploads`.
- Plain co-located CSS, `components/ui/*` primitives. No new dependencies unless unavoidable.
- One Prisma migration per schema change, named, applied locally only.

---

## 10. Handoff provenance
This branch was prepared on Brett's Mac from an analysis of both a local (stale) copy and this canonical upstream. The upstream and the stale copy matched on every media-relevant file, so this spec is accurate for the code you have. Phase 0 already done on this branch: this doc, `DATABASE_SAFETY.md`, root `CLAUDE.md`, and a fix removing `--force` from the `db:reset*` scripts (they're now gated on `DATABASE_TEST_URL`).
