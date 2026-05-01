import { PrismaClient, Role, ApprovalStatus, OrderStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function log(msg: string) { console.log(`  → ${msg}`); }
async function hash(pw: string) { return bcrypt.hash(pw, 12); }
function ordNum(seq: number) { return `ORD-2026-${String(seq).padStart(4, "0")}`; }
function round2(n: number) { return Math.round(n * 100) / 100; }
function slug(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

async function main() {
  console.log("\n🌱 Seeding dealer-portal database…\n");

  // ── Clean ──────────────────────────────────────────────
  console.log("Cleaning…");
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productUOM.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.address.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.company.deleteMany();
  await prisma.priceLevel.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.user.deleteMany();
  await prisma.siteSetting.deleteMany();
  await prisma.pageContent.deleteMany();
  await prisma.pageGroupItem.deleteMany();
  log("Done");

  // ── Users ──────────────────────────────────────────────
  console.log("\nCreating users…");
  const adminEmail = process.env.OWNER_EMAIL || "admin@example.com";
  const adminPass = process.env.OWNER_PASSWORD || "password";
  const custHash = await hash("DemoPassword123!");

  const adminUser = await prisma.user.create({ data: { email: adminEmail, password: await hash(adminPass), name: "Super Admin", role: Role.SUPER_ADMIN, mustChangePassword: false } });
  const staffUser = await prisma.user.create({ data: { email: "staff@example.com", password: custHash, name: "Staff Member", role: Role.STAFF, mustChangePassword: false } });
  log(`Admin: ${adminUser.email} | Staff: ${staffUser.email}`);

  const customerData = [
    { email: "john@acmehardware.com", name: "John Smith" },
    { email: "jane@acmehardware.com", name: "Jane Cooper" },
    { email: "mike@pacificdist.com", name: "Mike Johnson" },
    { email: "sarah@pacificdist.com", name: "Sarah Williams" },
    { email: "bob@cornershop.com", name: "Bob Davis" },
    { email: "lisa@pendingsupply.com", name: "Lisa Chen" },
    { email: "carlos@westcoasttools.com", name: "Carlos Rivera" },
    { email: "amy@westcoasttools.com", name: "Amy Zhang" },
    { email: "derek@mountainbuild.com", name: "Derek Brown" },
    { email: "nina@sunvalleysupply.com", name: "Nina Patel" },
  ];
  const custUsers = [];
  for (const c of customerData) {
    custUsers.push(await prisma.user.create({ data: { email: c.email, password: custHash, name: c.name, role: Role.CUSTOMER, mustChangePassword: false } }));
  }
  log(`${custUsers.length} customer users`);

  // ── Price Levels ───────────────────────────────────────
  console.log("\nCreating price levels…");
  const priceLevels = await Promise.all([
    prisma.priceLevel.create({ data: { name: "Retail", discountPercent: 0, isDefault: true, sortOrder: 0, description: "Standard retail pricing" } }),
    prisma.priceLevel.create({ data: { name: "Dealer", discountPercent: 20, sortOrder: 1, description: "Dealer — 20% off retail" } }),
    prisma.priceLevel.create({ data: { name: "Distributor", discountPercent: 30, sortOrder: 2, description: "Distributor — 30% off retail" } }),
    prisma.priceLevel.create({ data: { name: "VIP", discountPercent: 40, sortOrder: 3, description: "VIP — 40% off retail" } }),
  ]);
  const [retailPL, dealerPL, distPL, vipPL] = priceLevels;
  priceLevels.forEach(p => log(`${p.name} (${p.discountPercent}%)`));

  // ── Companies + Customers + Addresses ──────────────────
  console.log("\nCreating companies…");
  const companies: { co: Awaited<ReturnType<typeof prisma.company.create>>; custs: Awaited<ReturnType<typeof prisma.customer.create>>[] }[] = [];

  // 1. Acme Hardware — Dealer, APPROVED
  const acme = await prisma.company.create({ data: { name: "Acme Hardware", priceLevelId: dealerPL.id, phone: "(555) 100-2000", approvalStatus: "APPROVED", notes: "Long-standing dealer partner since 2019" } });
  const acmeCusts = [
    await prisma.customer.create({ data: { companyId: acme.id, userId: custUsers[0].id, name: "John Smith", email: "john@acmehardware.com", phone: "(555) 100-2001", title: "Purchasing Manager" } }),
    await prisma.customer.create({ data: { companyId: acme.id, userId: custUsers[1].id, name: "Jane Cooper", email: "jane@acmehardware.com", phone: "(555) 100-2002", title: "Operations Lead" } }),
  ];
  await prisma.address.createMany({ data: [
    { companyId: acme.id, label: "Main Warehouse", line1: "100 Industrial Blvd", city: "Portland", state: "OR", postalCode: "97201", isDefault: true },
    { companyId: acme.id, label: "Downtown Store", line1: "42 Main St", line2: "Suite 100", city: "Portland", state: "OR", postalCode: "97204" },
    { companyId: acme.id, label: "East Side Branch", line1: "789 Burnside Ave", city: "Portland", state: "OR", postalCode: "97214" },
  ]});
  companies.push({ co: acme, custs: acmeCusts });

  // 2. Pacific Distributors — Distributor, APPROVED
  const pacific = await prisma.company.create({ data: { name: "Pacific Distributors", priceLevelId: distPL.id, phone: "(555) 200-3000", approvalStatus: "APPROVED", notes: "Regional distributor, Pacific NW" } });
  const pacCusts = [
    await prisma.customer.create({ data: { companyId: pacific.id, userId: custUsers[2].id, name: "Mike Johnson", email: "mike@pacificdist.com", phone: "(555) 200-3001", title: "VP Procurement" } }),
    await prisma.customer.create({ data: { companyId: pacific.id, userId: custUsers[3].id, name: "Sarah Williams", email: "sarah@pacificdist.com", phone: "(555) 200-3002", title: "Logistics" } }),
  ];
  await prisma.address.createMany({ data: [
    { companyId: pacific.id, label: "Distribution Center", line1: "500 Harbor Dr", city: "Seattle", state: "WA", postalCode: "98101", isDefault: true },
    { companyId: pacific.id, label: "Satellite Office", line1: "222 Pike St", city: "Seattle", state: "WA", postalCode: "98104" },
  ]});
  companies.push({ co: pacific, custs: pacCusts });

  // 3. Corner Shop LLC — Retail, APPROVED
  const corner = await prisma.company.create({ data: { name: "Corner Shop LLC", priceLevelId: retailPL.id, phone: "(555) 300-4000", approvalStatus: "APPROVED" } });
  const cornerCusts = [
    await prisma.customer.create({ data: { companyId: corner.id, userId: custUsers[4].id, name: "Bob Davis", email: "bob@cornershop.com", phone: "(555) 300-4001", title: "Owner" } }),
  ];
  await prisma.address.createMany({ data: [
    { companyId: corner.id, label: "Store", line1: "15 Elm St", city: "Boise", state: "ID", postalCode: "83702", isDefault: true },
  ]});
  companies.push({ co: corner, custs: cornerCusts });

  // 4. Pending Supply Co — Retail, PENDING
  const pending = await prisma.company.create({ data: { name: "Pending Supply Co", priceLevelId: retailPL.id, phone: "(555) 400-5000", approvalStatus: "PENDING" } });
  await prisma.customer.create({ data: { companyId: pending.id, userId: custUsers[5].id, name: "Lisa Chen", email: "lisa@pendingsupply.com", phone: "(555) 400-5001", title: "Manager" } });
  await prisma.address.create({ data: { companyId: pending.id, label: "Warehouse", line1: "88 Commerce Way", city: "Reno", state: "NV", postalCode: "89501", isDefault: true } });

  // 5. West Coast Tools — VIP, APPROVED
  const westcoast = await prisma.company.create({ data: { name: "West Coast Tools & Supply", priceLevelId: vipPL.id, phone: "(555) 500-6000", approvalStatus: "APPROVED", notes: "VIP account — high volume" } });
  const wcCusts = [
    await prisma.customer.create({ data: { companyId: westcoast.id, userId: custUsers[6].id, name: "Carlos Rivera", email: "carlos@westcoasttools.com", phone: "(555) 500-6001", title: "Director of Purchasing" } }),
    await prisma.customer.create({ data: { companyId: westcoast.id, userId: custUsers[7].id, name: "Amy Zhang", email: "amy@westcoasttools.com", phone: "(555) 500-6002", title: "Inventory Manager" } }),
  ];
  await prisma.address.createMany({ data: [
    { companyId: westcoast.id, label: "HQ Warehouse", line1: "1200 Pacific Coast Hwy", city: "Long Beach", state: "CA", postalCode: "90802", isDefault: true },
    { companyId: westcoast.id, label: "San Diego Branch", line1: "450 Harbor Blvd", city: "San Diego", state: "CA", postalCode: "92101" },
  ]});
  companies.push({ co: westcoast, custs: wcCusts });

  // 6. Mountain Build — Dealer, APPROVED
  const mountain = await prisma.company.create({ data: { name: "Mountain Build Supply", priceLevelId: dealerPL.id, phone: "(555) 600-7000", approvalStatus: "APPROVED" } });
  const mtCusts = [
    await prisma.customer.create({ data: { companyId: mountain.id, userId: custUsers[8].id, name: "Derek Brown", email: "derek@mountainbuild.com", phone: "(555) 600-7001", title: "Owner/Operator" } }),
  ];
  await prisma.address.create({ data: { companyId: mountain.id, label: "Shop", line1: "321 Mountain Rd", city: "Denver", state: "CO", postalCode: "80202", isDefault: true } });
  companies.push({ co: mountain, custs: mtCusts });

  // 7. Sun Valley Supply — Distributor, APPROVED
  const sunvalley = await prisma.company.create({ data: { name: "Sun Valley Supply", priceLevelId: distPL.id, phone: "(555) 700-8000", approvalStatus: "APPROVED" } });
  const svCusts = [
    await prisma.customer.create({ data: { companyId: sunvalley.id, userId: custUsers[9].id, name: "Nina Patel", email: "nina@sunvalleysupply.com", phone: "(555) 700-8001", title: "Operations" } }),
  ];
  await prisma.address.create({ data: { companyId: sunvalley.id, label: "Main", line1: "900 Sun Valley Blvd", city: "Phoenix", state: "AZ", postalCode: "85001", isDefault: true } });
  companies.push({ co: sunvalley, custs: svCusts });

  log(`${companies.length + 1} companies (incl. Pending Supply)`);

  // ── Categories ─────────────────────────────────────────
  console.log("\nCreating categories…");
  const [powerTools, handTools, safetyEquip, fasteners, measuringTools] = await Promise.all([
    prisma.productCategory.create({ data: { name: "Power Tools", slug: "power-tools", description: "Electric and battery-powered tools", sortOrder: 0 } }),
    prisma.productCategory.create({ data: { name: "Hand Tools", slug: "hand-tools", description: "Manual hand tools and accessories", sortOrder: 1 } }),
    prisma.productCategory.create({ data: { name: "Safety Equipment", slug: "safety-equipment", description: "PPE and safety gear", sortOrder: 2 } }),
    prisma.productCategory.create({ data: { name: "Fasteners", slug: "fasteners", description: "Screws, bolts, nails, anchors", sortOrder: 3 } }),
    prisma.productCategory.create({ data: { name: "Measuring & Layout", slug: "measuring-layout", description: "Levels, squares, tape measures", sortOrder: 4 } }),
  ]);
  log("5 categories");

  // ── Products ───────────────────────────────────────────
  console.log("\nCreating products…");
  interface ProdDef { name: string; desc: string; catId: string; moq?: number; sort: number; variants: { name: string; sku: string; price: number; stock: number }[]; imgs: number; }

  const defs: ProdDef[] = [
    // Power Tools (6)
    { name: "Pro Cordless Drill", desc: "20V MAX brushless drill/driver with LED work light. Includes 2 batteries and charger.", catId: powerTools.id, moq: 1, sort: 0, variants: [{ name: '1/2" Chuck', sku: "PT-DRILL-12", price: 149.99, stock: 85 }, { name: '3/8" Chuck', sku: "PT-DRILL-38", price: 129.99, stock: 120 }], imgs: 3 },
    { name: "7-1/4 Circular Saw", desc: "15-amp circular saw with laser guide, electric brake, and magnesium shoe.", catId: powerTools.id, sort: 1, variants: [{ name: "Standard", sku: "PT-CSAW-STD", price: 89.99, stock: 60 }, { name: "With Blade Kit", sku: "PT-CSAW-KIT", price: 119.99, stock: 35 }], imgs: 2 },
    { name: "Orbital Sander", desc: "5-inch random orbital sander with variable speed and dust collection.", catId: powerTools.id, sort: 2, variants: [{ name: "Standard", sku: "PT-SAND-5IN", price: 64.99, stock: 150 }], imgs: 2 },
    { name: "Reciprocating Saw", desc: "12-amp reciprocating saw with tool-free blade change and pivoting shoe.", catId: powerTools.id, sort: 3, variants: [{ name: "Corded", sku: "PT-RECIP-C", price: 79.99, stock: 45 }, { name: "Cordless 20V", sku: "PT-RECIP-20V", price: 139.99, stock: 30 }], imgs: 2 },
    { name: "Impact Driver Set", desc: "20V brushless 1/4\" hex impact driver. 1,800 in-lbs torque with 3-speed settings.", catId: powerTools.id, sort: 4, variants: [{ name: "Tool Only", sku: "PT-IMPACT-TO", price: 99.99, stock: 70 }, { name: "With Battery Kit", sku: "PT-IMPACT-KIT", price: 169.99, stock: 40 }], imgs: 3 },
    { name: "Angle Grinder 4-1/2\"", desc: "7.5-amp angle grinder with paddle switch and adjustable guard. Spindle lock for easy disc changes.", catId: powerTools.id, sort: 5, variants: [{ name: "Standard", sku: "PT-GRIND-45", price: 49.99, stock: 3 }], imgs: 2 },

    // Hand Tools (5)
    { name: "Professional Hammer", desc: "20 oz steel claw hammer with fiberglass handle and cushion grip.", catId: handTools.id, sort: 0, variants: [{ name: "20 oz", sku: "HT-HAM-20", price: 29.99, stock: 300 }, { name: "16 oz", sku: "HT-HAM-16", price: 24.99, stock: 250 }, { name: "12 oz", sku: "HT-HAM-12", price: 19.99, stock: 200 }], imgs: 3 },
    { name: "10-Piece Screwdriver Set", desc: "Chrome vanadium steel set with magnetic tips. Phillips, flathead, and Torx.", catId: handTools.id, sort: 1, variants: [{ name: "Standard Set", sku: "HT-SCRW-STD", price: 34.99, stock: 180 }, { name: "Precision Set", sku: "HT-SCRW-PRE", price: 44.99, stock: 90 }], imgs: 2 },
    { name: "Adjustable Wrench Set", desc: "3-piece chrome vanadium set: 6\", 8\", and 10\" adjustable wrenches.", catId: handTools.id, sort: 2, variants: [{ name: "3-Piece Set", sku: "HT-WRENCH-3", price: 39.99, stock: 120 }], imgs: 2 },
    { name: "Pliers Combo Pack", desc: "4-piece pliers set: needle nose, diagonal, slip joint, and groove joint.", catId: handTools.id, sort: 3, variants: [{ name: "4-Piece", sku: "HT-PLIER-4", price: 49.99, stock: 80 }, { name: "6-Piece Pro", sku: "HT-PLIER-6", price: 74.99, stock: 0 }], imgs: 2 },
    { name: "Utility Knife", desc: "Heavy-duty retractable utility knife with 5 spare blades stored in handle.", catId: handTools.id, sort: 4, variants: [{ name: "Standard", sku: "HT-KNIFE-STD", price: 12.99, stock: 400 }, { name: "Folding", sku: "HT-KNIFE-FLD", price: 18.99, stock: 220 }], imgs: 2 },

    // Safety Equipment (5)
    { name: "Hard Hat", desc: "OSHA-compliant Type I Class E hard hat with 4-point ratchet suspension.", catId: safetyEquip.id, sort: 0, variants: [{ name: "White", sku: "SE-HAT-WHT", price: 24.99, stock: 200 }, { name: "Yellow", sku: "SE-HAT-YEL", price: 24.99, stock: 180 }, { name: "Orange", sku: "SE-HAT-ORG", price: 24.99, stock: 160 }], imgs: 3 },
    { name: "Safety Glasses", desc: "ANSI Z87.1+ rated with anti-fog and scratch-resistant lenses.", catId: safetyEquip.id, moq: 6, sort: 1, variants: [{ name: "Clear Lens", sku: "SE-GLASS-CLR", price: 8.99, stock: 500 }, { name: "Tinted Lens", sku: "SE-GLASS-TNT", price: 9.99, stock: 350 }], imgs: 3 },
    { name: "Work Gloves", desc: "Cut-resistant nitrile coated gloves, ANSI cut level A4.", catId: safetyEquip.id, moq: 12, sort: 2, variants: [{ name: "Medium", sku: "SE-GLV-M", price: 12.99, stock: 400 }, { name: "Large", sku: "SE-GLV-L", price: 12.99, stock: 450 }, { name: "X-Large", sku: "SE-GLV-XL", price: 12.99, stock: 300 }], imgs: 2 },
    { name: "Ear Protection", desc: "NRR 25dB over-ear hearing protection with padded headband.", catId: safetyEquip.id, sort: 3, variants: [{ name: "Standard", sku: "SE-EAR-STD", price: 19.99, stock: 160 }, { name: "Electronic", sku: "SE-EAR-ELEC", price: 59.99, stock: 0 }], imgs: 2 },
    { name: "Hi-Vis Safety Vest", desc: "ANSI Class 2 high-visibility vest with reflective strips and zipper.", catId: safetyEquip.id, moq: 10, sort: 4, variants: [{ name: "M/L", sku: "SE-VEST-ML", price: 14.99, stock: 300 }, { name: "XL/2XL", sku: "SE-VEST-XL", price: 14.99, stock: 250 }], imgs: 2 },

    // Fasteners (4)
    { name: '#8 Wood Screws (1-1/2")', desc: 'Phillips flat head #8 × 1-1/2" wood screws. Yellow zinc coated.', catId: fasteners.id, sort: 0, variants: [{ name: "100-Pack", sku: "FN-WS8-100", price: 7.99, stock: 500 }], imgs: 2 },
    { name: '3/8" Hex Bolts', desc: '3/8"-16 × 2" Grade 5 hex bolts. Zinc plated carbon steel.', catId: fasteners.id, sort: 1, variants: [{ name: "25-Pack", sku: "FN-HB38-25", price: 11.99, stock: 300 }, { name: "100-Pack", sku: "FN-HB38-100", price: 39.99, stock: 150 }], imgs: 2 },
    { name: "Concrete Anchors", desc: '1/4" × 2-1/4" wedge anchors for concrete and masonry.', catId: fasteners.id, moq: 10, sort: 2, variants: [{ name: "50-Pack", sku: "FN-CA14-50", price: 24.99, stock: 200 }, { name: "100-Pack", sku: "FN-CA14-100", price: 44.99, stock: 100 }], imgs: 2 },
    { name: "Drywall Screws #6", desc: '#6 × 1-5/8" coarse-thread drywall screws. Phosphate coated.', catId: fasteners.id, sort: 3, variants: [{ name: "200-Pack", sku: "FN-DW6-200", price: 9.99, stock: 600 }, { name: "1000-Pack", sku: "FN-DW6-1K", price: 39.99, stock: 4 }], imgs: 2 },

    // Measuring & Layout (4)
    { name: "25ft Tape Measure", desc: "Heavy-duty 25-foot tape measure with magnetic hook and belt clip.", catId: measuringTools.id, moq: 2, sort: 0, variants: [{ name: "25ft", sku: "ML-TAPE-25", price: 14.99, stock: 500 }, { name: "16ft", sku: "ML-TAPE-16", price: 9.99, stock: 400 }], imgs: 2 },
    { name: "48\" Box Level", desc: "Die-cast aluminum box level with 3 vials. Accuracy: 0.0005\"/in.", catId: measuringTools.id, sort: 1, variants: [{ name: "48 inch", sku: "ML-LVL-48", price: 49.99, stock: 60 }, { name: "24 inch", sku: "ML-LVL-24", price: 34.99, stock: 90 }], imgs: 2 },
    { name: "Combination Square", desc: "12\" stainless steel combination square with spirit level and scriber.", catId: measuringTools.id, sort: 2, variants: [{ name: "12 inch", sku: "ML-SQ-12", price: 24.99, stock: 140 }], imgs: 2 },
    { name: "Laser Distance Measurer", desc: "Digital laser distance measurer, 165ft range, +/- 1/16\" accuracy. Area and volume calculations.", catId: measuringTools.id, sort: 3, variants: [{ name: "Standard", sku: "ML-LASER-STD", price: 89.99, stock: 2 }, { name: "Pro (330ft)", sku: "ML-LASER-PRO", price: 179.99, stock: 15 }], imgs: 3 },
  ];

  const createdProducts: { product: { id: string; name: string }; variants: { id: string; name: string; sku: string; baseRetailPrice: unknown }[]; uoms: { id: string; name: string; conversionFactor: number; priceOverride: unknown }[] }[] = [];

  for (const d of defs) {
    const product = await prisma.product.create({ data: { name: d.name, slug: slug(d.name), description: d.desc, categoryId: d.catId, minOrderQuantity: d.moq ?? null, sortOrder: d.sort } });
    const variants = await Promise.all(d.variants.map((v, i) => prisma.productVariant.create({ data: { productId: product.id, name: v.name, sku: v.sku, baseRetailPrice: v.price, stockQuantity: v.stock, lowStockThreshold: 5, sortOrder: i } })));
    const isFastener = d.catId === fasteners.id;
    const uoms = await Promise.all([
      prisma.productUOM.create({ data: { productId: product.id, name: "Each", conversionFactor: 1, sortOrder: 0 } }),
      prisma.productUOM.create({ data: { productId: product.id, name: "Box", conversionFactor: 12, priceOverride: isFastener ? round2(d.variants[0].price * 10) : null, sortOrder: 1 } }),
      prisma.productUOM.create({ data: { productId: product.id, name: "Skid", conversionFactor: 144, priceOverride: isFastener ? round2(d.variants[0].price * 110) : null, sortOrder: 2 } }),
    ]);
    await prisma.productImage.createMany({ data: Array.from({ length: d.imgs }, (_, i) => ({ productId: product.id, url: `/uploads/placeholder-${i + 1}.jpg`, altText: `${d.name} - Image ${i + 1}`, isPrimary: i === 0, sortOrder: i })) });
    createdProducts.push({ product, variants, uoms });
    log(`${product.name} — ${variants.length} variants, ${d.imgs} images${d.variants.some(v => v.stock <= 5) ? " ⚠ LOW STOCK" : ""}${d.variants.some(v => v.stock === 0) ? " 🔴 OUT OF STOCK" : ""}`);
  }

  // ── Carts ──────────────────────────────────────────────
  console.log("\nCreating carts…");
  const acmeCart = await prisma.cart.create({ data: { customerId: acmeCusts[0].id } });
  await prisma.cartItem.createMany({ data: [
    { cartId: acmeCart.id, variantId: createdProducts[0].variants[0].id, uomId: createdProducts[0].uoms[0].id, quantity: 2 },
    { cartId: acmeCart.id, variantId: createdProducts[6].variants[0].id, uomId: createdProducts[6].uoms[0].id, quantity: 5 },
    { cartId: acmeCart.id, variantId: createdProducts[11].variants[1].id, uomId: createdProducts[11].uoms[1].id, quantity: 1 },
  ]});
  log("Acme Hardware (John) — 3 items");

  const pacCart = await prisma.cart.create({ data: { customerId: pacCusts[0].id } });
  await prisma.cartItem.create({ data: { cartId: pacCart.id, variantId: createdProducts[1].variants[0].id, uomId: createdProducts[1].uoms[0].id, quantity: 10 } });
  log("Pacific Distributors (Mike) — 1 item");

  const wcCart = await prisma.cart.create({ data: { customerId: wcCusts[0].id } });
  await prisma.cartItem.createMany({ data: [
    { cartId: wcCart.id, variantId: createdProducts[4].variants[1].id, uomId: createdProducts[4].uoms[0].id, quantity: 20 },
    { cartId: wcCart.id, variantId: createdProducts[15].variants[0].id, uomId: createdProducts[15].uoms[1].id, quantity: 5 },
  ]});
  log("West Coast Tools (Carlos) — 2 items");

  // ── Orders (spanning 3 months) ─────────────────────────
  console.log("\nCreating orders…");
  const ship = 15;
  const orderDefs = [
    { coIdx: 0, custIdx: 0, pl: "Dealer", disc: 20, status: "DELIVERED" as OrderStatus, po: "ACME-PO-001", days: 75, items: [{ pi: 0, vi: 0, ui: 0, q: 5 }, { pi: 6, vi: 0, ui: 0, q: 10 }] },
    { coIdx: 0, custIdx: 1, pl: "Dealer", disc: 20, status: "DELIVERED" as OrderStatus, po: "ACME-PO-002", days: 55, items: [{ pi: 11, vi: 0, ui: 1, q: 4 }, { pi: 12, vi: 0, ui: 0, q: 24 }] },
    { coIdx: 0, custIdx: 0, pl: "Dealer", disc: 20, status: "SHIPPED" as OrderStatus, po: "ACME-PO-003", days: 7, items: [{ pi: 3, vi: 0, ui: 0, q: 2 }, { pi: 16, vi: 0, ui: 0, q: 6 }] },
    { coIdx: 1, custIdx: 0, pl: "Distributor", disc: 30, status: "DELIVERED" as OrderStatus, po: "PAC-100", days: 60, items: [{ pi: 1, vi: 1, ui: 0, q: 20 }, { pi: 7, vi: 0, ui: 0, q: 15 }] },
    { coIdx: 1, custIdx: 1, pl: "Distributor", disc: 30, status: "PROCESSING" as OrderStatus, po: "PAC-101", days: 3, items: [{ pi: 4, vi: 1, ui: 0, q: 10 }, { pi: 13, vi: 0, ui: 0, q: 30 }], notes: "Ship via freight" },
    { coIdx: 1, custIdx: 0, pl: "Distributor", disc: 30, status: "RECEIVED" as OrderStatus, days: 1, admin: true, internalNotes: "Phone order — confirm stock", items: [{ pi: 14, vi: 0, ui: 1, q: 20 }, { pi: 14, vi: 1, ui: 1, q: 20 }] },
    { coIdx: 2, custIdx: 0, pl: "Retail", disc: 0, status: "DELIVERED" as OrderStatus, days: 45, items: [{ pi: 2, vi: 0, ui: 0, q: 1 }, { pi: 20, vi: 0, ui: 0, q: 3 }] },
    { coIdx: 2, custIdx: 0, pl: "Retail", disc: 0, status: "CANCELLED" as OrderStatus, po: "CS-9001", days: 20, notes: "Customer cancelled", items: [{ pi: 17, vi: 0, ui: 0, q: 50 }] },
    { coIdx: 3, custIdx: 0, pl: "VIP", disc: 40, status: "DELIVERED" as OrderStatus, po: "WCT-500", days: 40, items: [{ pi: 0, vi: 0, ui: 0, q: 50 }, { pi: 0, vi: 1, ui: 0, q: 30 }, { pi: 5, vi: 0, ui: 1, q: 10 }] },
    { coIdx: 3, custIdx: 1, pl: "VIP", disc: 40, status: "SHIPPED" as OrderStatus, po: "WCT-501", days: 5, items: [{ pi: 8, vi: 0, ui: 0, q: 100 }, { pi: 9, vi: 0, ui: 1, q: 50 }] },
    { coIdx: 4, custIdx: 0, pl: "Dealer", disc: 20, status: "RECEIVED" as OrderStatus, days: 0, admin: true, internalNotes: "Rush order", items: [{ pi: 19, vi: 0, ui: 0, q: 100 }, { pi: 19, vi: 1, ui: 0, q: 50 }] },
    { coIdx: 5, custIdx: 0, pl: "Distributor", disc: 30, status: "PROCESSING" as OrderStatus, po: "SV-200", days: 2, items: [{ pi: 10, vi: 0, ui: 0, q: 48 }, { pi: 21, vi: 0, ui: 0, q: 10 }] },
  ];

  const statusFlow: Record<string, OrderStatus[]> = {
    RECEIVED: ["RECEIVED"], PROCESSING: ["RECEIVED", "PROCESSING"], SHIPPED: ["RECEIVED", "PROCESSING", "SHIPPED"],
    DELIVERED: ["RECEIVED", "PROCESSING", "SHIPPED", "DELIVERED"], CANCELLED: ["RECEIVED", "CANCELLED"],
  };

  for (let i = 0; i < orderDefs.length; i++) {
    const d = orderDefs[i];
    const co = companies[d.coIdx];
    const cust = co.custs[d.custIdx];
    const sub = new Date(); sub.setDate(sub.getDate() - d.days);

    let subtotal = 0;
    const itemsData = d.items.map(it => {
      const p = createdProducts[it.pi]; const v = p.variants[it.vi]; const u = p.uoms[it.ui];
      const brp = Number(v.baseRetailPrice); const mult = (100 - d.disc) / 100;
      let up: number;
      if (u.priceOverride) { up = round2(Number(u.priceOverride) * mult); } else { up = round2(brp * u.conversionFactor * mult); }
      const buq = it.q * u.conversionFactor; const lt = round2(up * it.q); subtotal = round2(subtotal + lt);
      return { variantId: v.id, productNameSnapshot: p.product.name, variantNameSnapshot: v.name ?? "", skuSnapshot: v.sku ?? "", uomNameSnapshot: u.name, uomConversionSnapshot: u.conversionFactor, quantity: it.q, baseUnitQuantity: buq, unitPrice: up, baseRetailPriceSnapshot: brp, lineTotal: lt };
    });
    // fix skuSnapshot from variant
    for (let j = 0; j < itemsData.length; j++) {
      const origV = createdProducts[d.items[j].pi].variants[d.items[j].vi];
      itemsData[j].skuSnapshot = origV.sku;
    }

    const total = round2(subtotal + ship);
    const order = await prisma.order.create({ data: {
      orderNumber: ordNum(i + 1), companyId: co.co.id, customerId: cust.id,
      placedByAdminId: d.admin ? adminUser.id : null, status: d.status,
      subtotal, shippingCost: ship, total, poNumber: d.po ?? null, notes: d.notes ?? null,
      internalNotes: d.internalNotes ?? null, priceLevelSnapshot: d.pl, discountPercentSnapshot: d.disc,
      submittedAt: sub, items: { create: itemsData },
    }});

    const flow = statusFlow[d.status];
    for (let s = 0; s < flow.length; s++) {
      const dt = new Date(sub); dt.setHours(dt.getHours() + s * 24);
      await prisma.orderStatusHistory.create({ data: { orderId: order.id, status: flow[s], changedById: d.admin ? adminUser.id : adminUser.id, notes: s === 0 ? "Order placed" : `Status → ${flow[s]}`, createdAt: dt } });
    }
    log(`${order.orderNumber} — ${d.status} ($${total.toFixed(2)})`);
  }

  // ── Site Settings + CMS ────────────────────────────────
  console.log("\nCreating settings & CMS content…");
  await prisma.siteSetting.create({
    data: {
      siteTitle: "Dealer Portal",
      siteDescription: "Wholesale ordering portal — replace this in Admin → Settings.",
      notificationEmail: "admin@example.com",
      contactEmail: "sales@example.com",
      contactPhone: "",
      contactAddress: "",
    },
  });

  const dealerSettingsPayload = {
    showProductsToPublic: "true",
    showPricesToPublic: "false",
    allowSelfRegistration: "true",
    requireApprovalForRegistration: "true",
    requirePONumber: "false",
    adminNotificationEmails: "admin@example.com",
    shippingMethod: "flat",
    flatShippingRate: "15.00",
  };
  await prisma.pageContent.upsert({
    where: { pageKey: "dealer-settings" },
    update: { payload: dealerSettingsPayload },
    create: { pageKey: "dealer-settings", payload: dealerSettingsPayload, seo: {} },
  });

  const homePayload = {
    headline: "Welcome to your dealer portal.",
    subheadline: "Wholesale ordering, dealer programs, and product information in one place.",
    ctaText: "Become a dealer",
    ctaHref: "/become-a-dealer",
    ctaSectionTitle: "Ready to get started?",
    ctaSectionBody: "Tell us about your store and we'll set you up with wholesale pricing, reliable inventory, and dealer support.",
    ctaSectionButtonText: "Contact us",
    ctaSectionButtonHref: "/contact",
  };
  await prisma.pageContent.upsert({
    where: { pageKey: "home" },
    update: { payload: homePayload },
    create: {
      pageKey: "home",
      payload: homePayload,
      seo: {
        title: "Dealer Portal — Wholesale Ordering",
        description: "Wholesale ordering portal for retailers and dealers.",
      },
    },
  });

  const aboutPayload = {
    title: "About Us",
    body: "Tell your company's story here. Edit this content from Admin → Pages → About.",
  };
  await prisma.pageContent.upsert({
    where: { pageKey: "about" },
    update: { payload: aboutPayload },
    create: { pageKey: "about", payload: aboutPayload, seo: {} },
  });

  // Home page features (sample placeholders)
  await prisma.pageGroupItem.createMany({
    data: [
      { pageKey: "home", groupKey: "features", sortOrder: 0, payload: { icon: "📦", title: "Wholesale Ordering", description: "Dealers place orders with account-based pricing in a few clicks." } },
      { pageKey: "home", groupKey: "features", sortOrder: 1, payload: { icon: "💼", title: "Dealer Programs", description: "Tiered pricing, custom payment terms, and a dedicated team." } },
      { pageKey: "home", groupKey: "features", sortOrder: 2, payload: { icon: "🚚", title: "Reliable Fulfillment", description: "Consistent inventory and shipping you can plan around." } },
    ],
  });

  log("Settings, home page, about page, features");

  // ── Done ───────────────────────────────────────────────
  console.log("\n✅ Seed complete!\n");
  console.log("  Accounts:");
  console.log(`    Admin:    ${adminEmail} / ${adminPass === "password" ? "password" : "(from env)"}`);
  console.log(`    Staff:    staff@example.com / DemoPassword123!`);
  console.log(`    Customer: john@acmehardware.com / DemoPassword123!`);
  console.log(`    VIP:      carlos@westcoasttools.com / DemoPassword123!`);
  console.log(`    (all customer passwords: DemoPassword123!)`);
  console.log(`\n  ${defs.length} products | ${orderDefs.length} orders | ${companies.length + 1} companies\n`);
}

main().catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); }).finally(() => prisma.$disconnect());
