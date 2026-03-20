import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { join } from "path";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Simple CSV parser that handles quoted fields with escaped quotes */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i] || ""));
    return row;
  });
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
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
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  console.log("\nImporting BCP products from CSV…\n");

  const csvPath = join(__dirname, "..", "data", "products.csv");
  const raw = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(raw);
  console.log(`  Parsed ${rows.length} rows from CSV`);

  // Deduplicate by product_id (keep first occurrence)
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.product_id)) {
      console.log(`  Skipping duplicate: ${r.product_id}`);
      return false;
    }
    seen.add(r.product_id);
    return true;
  });
  console.log(`  ${unique.length} unique products after dedup\n`);

  // Clean existing product data
  console.log("Cleaning existing product data…");
  await prisma.productImage.deleteMany();
  await prisma.productUOM.deleteMany();
  await prisma.productAccessory.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  console.log("  Done\n");

  // Create categories
  const categoryNames = [...new Set(unique.map((r) => r.category))];
  console.log(`Creating ${categoryNames.length} categories…`);
  const categoryMap = new Map<string, string>();
  for (let i = 0; i < categoryNames.length; i++) {
    const name = categoryNames[i];
    const cat = await prisma.productCategory.create({
      data: { name, slug: slug(name), sortOrder: i },
    });
    categoryMap.set(name, cat.id);
    console.log(`  ${cat.name}`);
  }

  // Create products with variant, image, and UOM
  console.log(`\nCreating ${unique.length} products…`);
  let count = 0;
  for (const row of unique) {
    const categoryId = categoryMap.get(row.category)!;
    const productSlug = slug(row.description);

    const product = await prisma.product.create({
      data: {
        name: row.description,
        slug: productSlug,
        categoryId,
        tags: row.subcategory ? [row.subcategory] : [],
        sortOrder: count,
        variants: {
          create: {
            name: "Default",
            sku: row.product_id,
            baseRetailPrice: 0,
            stockQuantity: 0,
          },
        },
        images: {
          create: {
            url: `/uploads/products/${row.image_file}`,
            altText: row.description,
            isPrimary: true,
          },
        },
        unitsOfMeasure: {
          create: {
            name: "Each",
            conversionFactor: 1,
            sortOrder: 0,
          },
        },
      },
    });
    count++;
    if (count % 25 === 0) console.log(`  ${count} products created…`);
  }

  console.log(`\nDone! Imported ${count} products across ${categoryNames.length} categories.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
