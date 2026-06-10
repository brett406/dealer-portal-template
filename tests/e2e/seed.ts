import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { E2E } from "./constants";

// Deterministic seed for the E2E suite. Reuses the local test database
// (DATABASE_URL is pointed at it by the Playwright config). Per DATABASE_SAFETY:
// assert a local/test host BEFORE truncating anything.

function assertLocalTestHost(url: string) {
  const host = new URL(url).hostname;
  const ok = /^(localhost|127\.0\.0\.1)$/.test(host) || /-test|_test/i.test(host);
  if (!ok) throw new Error(`E2E seed refused: non-local/test host "${host}"`);
  if (!/_test|_e2e/i.test(new URL(url).pathname)) {
    // Extra guard: the DB name itself must look like a test/e2e DB.
    throw new Error(`E2E seed refused: DB "${new URL(url).pathname}" is not a *_test/_e2e database`);
  }
}

export async function seedE2E() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("E2E seed: DATABASE_URL is required");
  assertLocalTestHost(url);

  // Build the client with the PG driver adapter (same as lib/prisma), using the
  // asserted-local URL directly so there's no import-timing/env ambiguity.
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });
  try {
    // Clean the tables we touch (CASCADE handles FK order).
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "OrderStatusHistory", "OrderItem", "Order",
        "CartItem", "Cart",
        "ProductImage", "ProductUOM",
        "BomComponent", "BomLaborLine", "Material", "LaborRate",
        "ProductVariant", "Product", "ProductCategory",
        "Address", "Customer", "Company", "PriceLevel",
        "Asset", "AssetFolder",
        "PageContent", "SiteSetting", "User"
      CASCADE
    `);

    // BOM costing on (admin-bom.spec.ts exercises it); other specs ignore it.
    await prisma.siteSetting.create({
      data: { siteTitle: "E2E Site", bomCostingEnabled: true },
    });

    // Dealer settings: expose the public catalog + prices.
    await prisma.pageContent.create({
      data: {
        pageKey: "dealer-settings",
        payload: { showProductsToPublic: "true", showPricesToPublic: "true" },
        seo: {},
      },
    });

    const passwordHash = await bcrypt.hash(E2E.password, 10);

    // Admin (SUPER_ADMIN).
    await prisma.user.create({
      data: {
        email: E2E.adminEmail,
        password: passwordHash,
        name: "E2E Admin",
        role: "SUPER_ADMIN",
        mustChangePassword: false,
      },
    });

    // Approved dealer: company + customer user.
    const priceLevel = await prisma.priceLevel.create({
      data: { name: "E2E Dealer", discountPercent: 10, isDefault: true },
    });
    const company = await prisma.company.create({
      data: { name: "E2E Dealer Co", priceLevelId: priceLevel.id, approvalStatus: "APPROVED", active: true },
    });
    const customerUser = await prisma.user.create({
      data: {
        email: E2E.customerEmail,
        password: passwordHash,
        name: "E2E Dealer",
        role: "CUSTOMER",
        mustChangePassword: false,
      },
    });
    await prisma.customer.create({
      data: {
        companyId: company.id,
        userId: customerUser.id,
        name: "E2E Dealer",
        email: E2E.customerEmail,
        active: true,
      },
    });

    // Catalog: one category, N active products each with an active variant.
    const category = await prisma.productCategory.create({
      data: { name: "E2E Widgets", slug: E2E.categorySlug, active: true, sortOrder: 0 },
    });
    for (let i = 1; i <= E2E.productCount; i++) {
      const n = String(i).padStart(2, "0");
      await prisma.product.create({
        data: {
          name: `E2E Widget ${n}`,
          slug: `e2e-widget-${n}`,
          categoryId: category.id,
          active: true,
          sortOrder: i, // distinct sortOrder, but pagination must stay stable regardless
          variants: {
            create: { name: "Standard", sku: `E2E-SKU-${n}`, baseRetailPrice: 100 + i, active: true },
          },
        },
      });
    }

    // Files: a folder with assets + some unfiled assets.
    const folder = await prisma.assetFolder.create({
      data: { name: E2E.folderName, slug: "brochures", accentColor: "blue", sortOrder: 0 },
    });
    const sameTime = new Date("2026-03-03T00:00:00.000Z"); // tie createdAt to exercise the id tiebreaker
    for (let i = 1; i <= E2E.folderAssetCount; i++) {
      const n = String(i).padStart(2, "0");
      await prisma.asset.create({
        data: {
          filename: `brochure-${n}.pdf`,
          originalName: `Brochure ${n}.pdf`,
          mimeType: "application/pdf",
          size: 1000 + i,
          storagePath: `/uploads/e2e/brochure-${n}.pdf`,
          folderId: folder.id,
          createdAt: sameTime,
        },
      });
    }
    for (let i = 1; i <= E2E.unfiledAssetCount; i++) {
      const n = String(i).padStart(2, "0");
      await prisma.asset.create({
        data: {
          filename: `catalog-${n}.pdf`,
          originalName: `Catalog ${n}.pdf`,
          mimeType: "application/pdf",
          size: 2000 + i,
          storagePath: `/uploads/e2e/catalog-${n}.pdf`,
          createdAt: sameTime,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
