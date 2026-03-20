import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

let counter = 0;
function seq() {
  return ++counter;
}

export async function createTestPriceLevel(overrides: Record<string, unknown> = {}) {
  const n = seq();
  return prisma.priceLevel.create({
    data: {
      name: `Price Level ${n}`,
      discountPercent: new Decimal(10),
      ...overrides,
    },
  });
}

export async function createTestCompany(priceLevelId: string, overrides: Record<string, unknown> = {}) {
  const n = seq();
  return prisma.company.create({
    data: {
      name: `Company ${n}`,
      priceLevelId,
      ...overrides,
    },
  });
}

export async function createTestCustomerWithUser(companyId: string, overrides: Record<string, unknown> = {}) {
  const n = seq();
  const email = (overrides.email as string) ?? `user${n}@test.com`;
  const user = await prisma.user.create({
    data: {
      email,
      password: "$2a$10$fakehashplaceholder",
      name: (overrides.name as string) ?? `Test User ${n}`,
      role: (overrides.role as "SUPER_ADMIN" | "STAFF" | "CUSTOMER") ?? "CUSTOMER",
    },
  });

  const customer = await prisma.customer.create({
    data: {
      companyId,
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: overrides.phone as string | undefined,
      title: overrides.title as string | undefined,
    },
  });

  return { user, customer };
}

export async function createTestCategory(overrides: Record<string, unknown> = {}) {
  const n = seq();
  return prisma.productCategory.create({
    data: {
      name: `Category ${n}`,
      slug: `category-${n}`,
      ...overrides,
    },
  });
}

export async function createTestProduct(categoryId: string, overrides: Record<string, unknown> = {}) {
  const n = seq();
  return prisma.product.create({
    data: {
      name: `Product ${n}`,
      slug: `product-${n}`,
      categoryId,
      ...overrides,
    },
  });
}

export async function createTestVariant(productId: string, overrides: Record<string, unknown> = {}) {
  const n = seq();
  return prisma.productVariant.create({
    data: {
      productId,
      name: `Variant ${n}`,
      sku: `SKU-${n}`,
      baseRetailPrice: new Decimal(99.99),
      ...overrides,
    },
  });
}

export async function createTestUOM(productId: string, overrides: Record<string, unknown> = {}) {
  const n = seq();
  return prisma.productUOM.create({
    data: {
      productId,
      name: `UOM ${n}`,
      conversionFactor: 1,
      ...overrides,
    },
  });
}

export async function createTestImage(productId: string, overrides: Record<string, unknown> = {}) {
  const n = seq();
  return prisma.productImage.create({
    data: {
      productId,
      url: `/uploads/product-${n}.jpg`,
      ...overrides,
    },
  });
}

export async function createFullTestProduct(categoryId: string) {
  const product = await createTestProduct(categoryId);
  const variant = await createTestVariant(product.id);

  const eachUOM = await createTestUOM(product.id, {
    name: "Each",
    conversionFactor: 1,
    sortOrder: 0,
  });
  const boxUOM = await createTestUOM(product.id, {
    name: "Box",
    conversionFactor: 12,
    sortOrder: 1,
  });
  const skidUOM = await createTestUOM(product.id, {
    name: "Skid",
    conversionFactor: 144,
    sortOrder: 2,
  });

  return { product, variant, uoms: { each: eachUOM, box: boxUOM, skid: skidUOM } };
}

export async function createTestOrder(
  companyId: string,
  customerId: string,
  items: Array<{
    variantId: string;
    productName: string;
    variantName: string;
    sku: string;
    uomName: string;
    uomConversion: number;
    quantity: number;
    baseUnitQuantity: number;
    unitPrice: number;
    baseRetailPrice: number;
    lineTotal: number;
  }>,
) {
  const n = seq();
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

  return prisma.order.create({
    data: {
      orderNumber: `ORD-${String(n).padStart(6, "0")}`,
      companyId,
      customerId,
      subtotal: new Decimal(subtotal),
      total: new Decimal(subtotal),
      priceLevelSnapshot: "Default",
      discountPercentSnapshot: new Decimal(10),
      submittedAt: new Date(),
      items: {
        create: items.map((item) => ({
          variantId: item.variantId,
          productNameSnapshot: item.productName,
          variantNameSnapshot: item.variantName,
          skuSnapshot: item.sku,
          uomNameSnapshot: item.uomName,
          uomConversionSnapshot: item.uomConversion,
          quantity: item.quantity,
          baseUnitQuantity: item.baseUnitQuantity,
          unitPrice: new Decimal(item.unitPrice),
          baseRetailPriceSnapshot: new Decimal(item.baseRetailPrice),
          lineTotal: new Decimal(item.lineTotal),
        })),
      },
    },
    include: { items: true },
  });
}

export async function createTestAddress(companyId: string, overrides: Record<string, unknown> = {}) {
  const n = seq();
  return prisma.address.create({
    data: {
      companyId,
      label: `Address ${n}`,
      line1: `${n} Main St`,
      city: "Springfield",
      state: "IL",
      postalCode: "62701",
      ...overrides,
    },
  });
}

export async function createTestAccessory(
  productId: string,
  accessoryId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.productAccessory.create({
    data: {
      productId,
      accessoryId,
      sortOrder: 0,
      ...overrides,
    },
  });
}
