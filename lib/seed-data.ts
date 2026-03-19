import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function round2(n: number) { return Math.round(n * 100) / 100; }
function slug(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

/**
 * Create sample data for demo/development.
 * Does NOT create the admin user — that must already exist.
 */
export async function createSampleData(adminUserId: string) {
  const custHash = await bcrypt.hash("DemoPassword123!", 12);

  // ── Price Levels ───────────────────────────────────────
  const [retailPL, dealerPL, distPL, vipPL] = await Promise.all([
    prisma.priceLevel.upsert({ where: { id: "seed-retail" }, update: {}, create: { id: "seed-retail", name: "Retail", discountPercent: 0, isDefault: true, sortOrder: 0, description: "Standard retail pricing" } }),
    prisma.priceLevel.create({ data: { name: "Dealer", discountPercent: 20, sortOrder: 1, description: "Dealer — 20% off retail" } }),
    prisma.priceLevel.create({ data: { name: "Distributor", discountPercent: 30, sortOrder: 2, description: "Distributor — 30% off retail" } }),
    prisma.priceLevel.create({ data: { name: "VIP", discountPercent: 40, sortOrder: 3, description: "VIP — 40% off retail" } }),
  ]);

  // ── Staff user ─────────────────────────────────────────
  await prisma.user.create({ data: { email: "staff@example.com", password: custHash, name: "Staff Member", role: "STAFF", mustChangePassword: false } });

  // ── Companies + Customers ──────────────────────────────
  const acme = await prisma.company.create({ data: { name: "Acme Hardware", priceLevelId: dealerPL.id, phone: "(555) 100-2000", approvalStatus: "APPROVED", notes: "Long-standing dealer partner" } });
  const acmeCust1User = await prisma.user.create({ data: { email: "john@acmehardware.com", password: custHash, name: "John Smith", role: "CUSTOMER", mustChangePassword: false } });
  const acmeCust1 = await prisma.customer.create({ data: { companyId: acme.id, userId: acmeCust1User.id, name: "John Smith", email: "john@acmehardware.com", phone: "(555) 100-2001", title: "Purchasing Manager" } });
  await prisma.address.create({ data: { companyId: acme.id, label: "Main Warehouse", line1: "100 Industrial Blvd", city: "Portland", state: "OR", postalCode: "97201", isDefault: true } });

  const pacific = await prisma.company.create({ data: { name: "Pacific Distributors", priceLevelId: distPL.id, phone: "(555) 200-3000", approvalStatus: "APPROVED" } });
  const pacUser = await prisma.user.create({ data: { email: "mike@pacificdist.com", password: custHash, name: "Mike Johnson", role: "CUSTOMER", mustChangePassword: false } });
  await prisma.customer.create({ data: { companyId: pacific.id, userId: pacUser.id, name: "Mike Johnson", email: "mike@pacificdist.com", title: "VP Procurement" } });
  await prisma.address.create({ data: { companyId: pacific.id, label: "Distribution Center", line1: "500 Harbor Dr", city: "Seattle", state: "WA", postalCode: "98101", isDefault: true } });

  const corner = await prisma.company.create({ data: { name: "Corner Shop LLC", priceLevelId: retailPL.id, approvalStatus: "APPROVED" } });
  const cornerUser = await prisma.user.create({ data: { email: "bob@cornershop.com", password: custHash, name: "Bob Davis", role: "CUSTOMER", mustChangePassword: false } });
  await prisma.customer.create({ data: { companyId: corner.id, userId: cornerUser.id, name: "Bob Davis", email: "bob@cornershop.com", title: "Owner" } });
  await prisma.address.create({ data: { companyId: corner.id, label: "Store", line1: "15 Elm St", city: "Boise", state: "ID", postalCode: "83702", isDefault: true } });

  // ── Categories ─────────────────────────────────────────
  const [powerTools, handTools, safetyEquip, fasteners] = await Promise.all([
    prisma.productCategory.create({ data: { name: "Power Tools", slug: "power-tools", description: "Electric and battery-powered tools", sortOrder: 0 } }),
    prisma.productCategory.create({ data: { name: "Hand Tools", slug: "hand-tools", description: "Manual hand tools", sortOrder: 1 } }),
    prisma.productCategory.create({ data: { name: "Safety Equipment", slug: "safety-equipment", description: "PPE and safety gear", sortOrder: 2 } }),
    prisma.productCategory.create({ data: { name: "Fasteners", slug: "fasteners", description: "Screws, bolts, nails", sortOrder: 3 } }),
  ]);

  // ── Products ───────────────────────────────────────────
  const defs = [
    { name: "Pro Cordless Drill", cat: powerTools.id, price: 149.99, stock: 85, sku: "PT-DRILL" },
    { name: "7-1/4 Circular Saw", cat: powerTools.id, price: 89.99, stock: 60, sku: "PT-CSAW" },
    { name: "Orbital Sander", cat: powerTools.id, price: 64.99, stock: 150, sku: "PT-SAND" },
    { name: "Professional Hammer", cat: handTools.id, price: 29.99, stock: 300, sku: "HT-HAM" },
    { name: "10-Piece Screwdriver Set", cat: handTools.id, price: 34.99, stock: 180, sku: "HT-SCRW" },
    { name: "25ft Tape Measure", cat: handTools.id, price: 14.99, stock: 500, sku: "HT-TAPE" },
    { name: "Hard Hat", cat: safetyEquip.id, price: 24.99, stock: 200, sku: "SE-HAT" },
    { name: "Safety Glasses", cat: safetyEquip.id, price: 8.99, stock: 500, sku: "SE-GLASS" },
    { name: "Work Gloves", cat: safetyEquip.id, price: 12.99, stock: 400, sku: "SE-GLV" },
    { name: '#8 Wood Screws (100-Pack)', cat: fasteners.id, price: 7.99, stock: 500, sku: "FN-WS8" },
    { name: '3/8" Hex Bolts (25-Pack)', cat: fasteners.id, price: 11.99, stock: 300, sku: "FN-HB38" },
    { name: "Concrete Anchors (50-Pack)", cat: fasteners.id, price: 24.99, stock: 200, sku: "FN-CA14" },
  ];

  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const product = await prisma.product.create({ data: { name: d.name, slug: slug(d.name), categoryId: d.cat, sortOrder: i } });
    await prisma.productVariant.create({ data: { productId: product.id, name: "Standard", sku: d.sku, baseRetailPrice: d.price, stockQuantity: d.stock, lowStockThreshold: 5 } });
    await prisma.productUOM.create({ data: { productId: product.id, name: "Each", conversionFactor: 1, sortOrder: 0 } });
    await prisma.productUOM.create({ data: { productId: product.id, name: "Box", conversionFactor: 12, sortOrder: 1 } });
    await prisma.productImage.create({ data: { productId: product.id, url: `/uploads/placeholder-${(i % 5) + 1}.jpg`, altText: d.name, isPrimary: true } });
  }

  // ── CMS Content ────────────────────────────────────────
  await prisma.pageContent.upsert({ where: { pageKey: "dealer-settings" }, update: {}, create: { pageKey: "dealer-settings", payload: { showProductsToPublic: "true", showPricesToPublic: "false", allowSelfRegistration: "true", requireApprovalForRegistration: "true", requirePONumber: "false", adminNotificationEmail: "", shippingMethod: "flat", flatShippingRate: "15.00" }, seo: {} } });

  await prisma.pageContent.upsert({ where: { pageKey: "home" }, update: {}, create: { pageKey: "home", payload: { headline: "Quality Tools for Every Trade", subheadline: "Your trusted wholesale partner.", ctaText: "Browse Catalog", ctaHref: "/auth/login" }, seo: {} } });

  await prisma.pageGroupItem.createMany({ data: [
    { pageKey: "home", groupKey: "features", sortOrder: 0, payload: { icon: "🏷️", title: "Volume Pricing", description: "Exclusive dealer and distributor pricing tiers." } },
    { pageKey: "home", groupKey: "features", sortOrder: 1, payload: { icon: "📦", title: "Fast Fulfillment", description: "Same-day processing on orders placed before 2 PM." } },
    { pageKey: "home", groupKey: "features", sortOrder: 2, payload: { icon: "🔧", title: "Pro-Grade Products", description: "Curated selection from trusted manufacturers." } },
  ]});
}
