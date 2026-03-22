/**
 * BCP Product Import Script
 *
 * Reads bcp_image_upload.csv and the original products.csv to import:
 *   - Product categories (from the CSV "category" column)
 *   - Products (one per product_id)
 *   - Product variants (one per product, using product_id as SKU, retail as baseRetailPrice)
 *   - Product images (with alt text, isPrimary for image_num=1)
 *   - Default UOM ("Each", conversionFactor 1)
 *
 * Usage:
 *   npx tsx prisma/import-products.ts
 *
 * NOTE: This does NOT wipe existing data — it upserts categories and skips
 * products whose SKU already exists. Safe to run multiple times.
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

/**
 * Simple CSV parser that handles quoted fields with commas and escaped quotes.
 */
function parseCSV<T = Record<string, string>>(content: string): T[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          fields.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  }

  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] || "").trim();
    });
    return obj as T;
  });
}

import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface UploadRow {
  product_id: string;
  category: string;
  retail_price_cad: string;
  unit: string;
  image_num: string;
  filename: string;
  alt_text: string;
  s3_url: string;
}

interface ProductRow {
  product_id: string;
  description: string;
  category: string;
}

async function main() {
  console.log("\n🚜 BCP Product Import\n");

  // ── Load image URL mapping (from upload-images-to-railway.ts) ──
  const mappingPath = path.join(process.cwd(), "data", "image-url-mapping.json");
  let imageUrlMapping: Record<string, string> = {};
  if (fs.existsSync(mappingPath)) {
    imageUrlMapping = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
    console.log(`  Image URL mapping loaded (${Object.keys(imageUrlMapping).length} entries)\n`);
  } else {
    console.log("  No image URL mapping found — using local paths\n");
  }

  // ── 1. Load the CSVs ──────────────────────────────────────
  const uploadCsvPath = path.join(process.cwd(), "..", "bcp_image_upload.csv");
  const productsCsvPath = path.join(process.cwd(), "..", "products.csv");

  // Try multiple possible locations for the CSVs
  const possibleUploadPaths = [
    uploadCsvPath,
    path.join(process.cwd(), "bcp_image_upload.csv"),
    path.join(process.cwd(), "data", "bcp_image_upload.csv"),
  ];
  const possibleProductPaths = [
    productsCsvPath,
    path.join(process.cwd(), "products.csv"),
    path.join(process.cwd(), "data", "products.csv"),
  ];

  let uploadPath = possibleUploadPaths.find((p) => fs.existsSync(p));
  let productsPath = possibleProductPaths.find((p) => fs.existsSync(p));

  if (!uploadPath) {
    console.error("❌ Could not find bcp_image_upload.csv");
    console.error("   Looked in:", possibleUploadPaths.join(", "));
    process.exit(1);
  }
  if (!productsPath) {
    console.error("❌ Could not find products.csv");
    console.error("   Looked in:", possibleProductPaths.join(", "));
    process.exit(1);
  }

  console.log(`  Upload CSV: ${uploadPath}`);
  console.log(`  Products CSV: ${productsPath}`);

  const uploadRows = parseCSV<UploadRow>(fs.readFileSync(uploadPath, "utf-8"));
  const productRows = parseCSV<ProductRow>(fs.readFileSync(productsPath, "utf-8"));

  // Build product lookup from products.csv (has full descriptions)
  const productLookup = new Map<string, ProductRow>();
  for (const row of productRows) {
    productLookup.set(row.product_id.trim(), row);
  }

  // Group upload rows by product_id
  const productGroups = new Map<
    string,
    { category: string; retail: number; unit: string; images: { num: number; filename: string; alt: string; url: string }[] }
  >();

  for (const row of uploadRows) {
    const pid = row.product_id.trim();
    if (!productGroups.has(pid)) {
      productGroups.set(pid, {
        category: row.category.trim(),
        retail: parseFloat(row.retail_price_cad) || 0,
        unit: row.unit.trim() || "EA",
        images: [],
      });
    }
    productGroups.get(pid)!.images.push({
      num: parseInt(row.image_num, 10),
      filename: row.filename.trim(),
      alt: row.alt_text.trim(),
      url: row.s3_url.trim(),
    });
  }

  console.log(`\n  Products to import: ${productGroups.size}`);
  console.log(`  Total image records: ${uploadRows.length}`);

  // ── 2. Create/upsert categories ────────────────────────────
  console.log("\nCreating categories…");
  const categoryNames = [...new Set([...productGroups.values()].map((p) => p.category))];
  const categoryMap = new Map<string, string>(); // name -> id

  for (let i = 0; i < categoryNames.length; i++) {
    const name = categoryNames[i];
    const catSlug = slug(name);

    const existing = await prisma.productCategory.findUnique({ where: { slug: catSlug } });
    if (existing) {
      categoryMap.set(name, existing.id);
      console.log(`  ✓ ${name} (exists)`);
    } else {
      const cat = await prisma.productCategory.create({
        data: { name, slug: catSlug, description: name, sortOrder: i, active: true },
      });
      categoryMap.set(name, cat.id);
      console.log(`  + ${name}`);
    }
  }

  // ── 3. Import products ─────────────────────────────────────
  console.log("\nImporting products…");
  let created = 0;
  let skipped = 0;
  let imageCount = 0;
  let priceUpdates = 0;
  let imagesUpdated = 0;

  for (const [pid, data] of productGroups) {
    // Check if SKU already exists — update price + images if needed
    const existingVariant = await prisma.productVariant.findUnique({ where: { sku: pid } });
    if (existingVariant) {
      // Update retail price if it changed
      const currentPrice = parseFloat(existingVariant.baseRetailPrice.toString());
      if (Math.abs(currentPrice - data.retail) > 0.001 && data.retail > 0) {
        await prisma.productVariant.update({
          where: { sku: pid },
          data: { baseRetailPrice: data.retail },
        });
        priceUpdates++;
        console.log(`  💲 ${pid}: $${currentPrice.toFixed(2)} → $${data.retail.toFixed(2)}`);
      }

      // Sync images — delete old ones and re-attach from latest EBMS data
      const existingImages = await prisma.productImage.findMany({
        where: { productId: existingVariant.productId },
      });
      const sortedImages = data.images.sort((a, b) => a.num - b.num);
      const newImageUrls = sortedImages.map((img) =>
        imageUrlMapping[img.filename]
          ? `/api/uploads/${imageUrlMapping[img.filename].split("/").pop()}`
          : `/uploads/products/${img.filename}`
      );

      // Check if images actually changed
      const existingUrls = existingImages.map((ei) => ei.url).sort();
      const newUrls = [...newImageUrls].sort();
      const imagesChanged =
        existingUrls.length !== newUrls.length ||
        existingUrls.some((u, i) => u !== newUrls[i]);

      if (imagesChanged && sortedImages.length > 0) {
        // Delete old images and create new ones
        await prisma.productImage.deleteMany({
          where: { productId: existingVariant.productId },
        });
        await prisma.productImage.createMany({
          data: sortedImages.map((img, idx) => ({
            productId: existingVariant.productId,
            url: imageUrlMapping[img.filename]
              ? `/api/uploads/${imageUrlMapping[img.filename].split("/").pop()}`
              : `/uploads/products/${img.filename}`,
            altText: img.alt,
            isPrimary: idx === 0,
            sortOrder: idx,
          })),
        });
        imagesUpdated += sortedImages.length;
        console.log(`  🖼  ${pid}: ${sortedImages.length} image(s) updated`);
      }

      skipped++;
      continue;
    }

    const productInfo = productLookup.get(pid);
    const name = productInfo?.description || pid;
    const categoryId = categoryMap.get(data.category);

    if (!categoryId) {
      console.log(`  ⚠ Skipping ${pid}: no category "${data.category}"`);
      skipped++;
      continue;
    }

    // Create product
    const productSlug = slug(`${pid}-${name}`);
    const product = await prisma.product.create({
      data: {
        name,
        slug: productSlug,
        description: name,
        categoryId,
        active: true,
        sortOrder: created,
      },
    });

    // Create single variant with the EBMS retail price
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: "Standard",
        sku: pid,
        baseRetailPrice: data.retail,
        stockQuantity: 0,
        lowStockThreshold: 5,
        active: true,
        sortOrder: 0,
      },
    });

    // Create default UOM
    await prisma.productUOM.create({
      data: {
        productId: product.id,
        name: data.unit === "EA" ? "Each" : data.unit,
        conversionFactor: 1,
        sortOrder: 0,
      },
    });

    // Create images
    // Sort by image_num so isPrimary goes to the first one
    const sortedImages = data.images.sort((a, b) => a.num - b.num);
    await prisma.productImage.createMany({
      data: sortedImages.map((img, idx) => ({
        productId: product.id,
        url: imageUrlMapping[img.filename]
          ? `/api/uploads/${imageUrlMapping[img.filename].split("/").pop()}`
          : `/uploads/products/${img.filename}`,
        altText: img.alt,
        isPrimary: idx === 0,
        sortOrder: idx,
      })),
    });

    imageCount += sortedImages.length;
    created++;

    if (created % 25 === 0) {
      console.log(`  … ${created} products imported`);
    }
  }

  // ── 4. Summary ─────────────────────────────────────────────
  console.log(`\n✅ Import complete!`);
  console.log(`   Categories: ${categoryNames.length}`);
  console.log(`   Products created: ${created}`);
  console.log(`   Products skipped (already exist): ${skipped}`);
  console.log(`   Prices updated: ${priceUpdates}`);
  console.log(`   Images updated on existing products: ${imagesUpdated}`);
  console.log(`   Images attached to new products: ${imageCount}`);
  console.log(`\n   Image files should be in: public/uploads/products/`);
  console.log(`   Copy your downloaded product_images/* there before deploying.\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
