---
name: upload-images
description: Upload product images to Railway volume and update the database. Use when new product images need to be pushed to production.
disable-model-invocation: true
allowed-tools: Read, Bash(npx *), Bash(npm run *), Bash(curl *), Bash(ls *), Bash(wc *), Glob, Grep
---

# Upload Product Images to Railway

Upload product images from the local folder to the Railway volume and update the database.

## Current State

Image folder: `../BCP - Ready to Import Images/`
Images found: !`ls "../BCP - Ready to Import Images/" 2>/dev/null | wc -l | tr -d ' '` files
Existing mapping entries: !`cat data/image-url-mapping.json 2>/dev/null | grep -c '":'` entries

## Steps

1. **Upload images to Railway** by running the upload script:
   ```bash
   npx tsx scripts/upload-images-to-railway.ts
   ```
   This script:
   - Reads PNG and JPG files from `../BCP - Ready to Import Images/`
   - Authenticates to the Railway app via CSRF + credentials
   - Uploads each image via the `/api/upload` endpoint
   - Saves the filename-to-URL mapping in `data/image-url-mapping.json`
   - Strips the `_1` suffix from filenames for the mapping key (e.g., `101-199_1.png` -> `101-199.png`), keeps `_2`+ as-is

2. **Update the database** by running the product import:
   ```bash
   npm run db:import-products
   ```
   This reads `bcp_image_upload.csv` and `products.csv`, looks up each image filename in the mapping, and updates `ProductImage` records in the database.

3. **Verify** by spot-checking 2-3 uploaded images with curl to confirm they return HTTP 200:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" "https://bauman-custom-products-production.up.railway.app/api/uploads/{filename}"
   ```

4. **Report results** to the user: how many uploaded, how many failed, how many database records updated.
