import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createTestPriceLevel,
  createTestCategory,
  createTestProduct,
  createTestVariant,
  createTestUOM,
  createTestImage,
  createTestAccessory,
} from "@/tests/helpers/factories";
import { checkDatabaseAvailable } from "@/tests/helpers/integration";
import { resetDatabase } from "@/tests/helpers/db";

let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await checkDatabaseAvailable();
});

describe("Accessory Display", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  it("product query returns linked accessories with correct shape", async () => {
    const category = await createTestCategory({ slug: "acc-cat" });
    const productA = await createTestProduct(category.id, { name: "Product A", slug: "product-a" });
    const productB = await createTestProduct(category.id, { name: "Product B", slug: "product-b" });

    await createTestVariant(productB.id, { sku: "SKU-B" });
    await createTestUOM(productB.id, { name: "Each", conversionFactor: 1 });
    await createTestImage(productB.id, { isPrimary: true });

    await createTestAccessory(productA.id, productB.id);

    const result = await prisma.product.findUnique({
      where: { id: productA.id },
      include: {
        accessories: {
          orderBy: { sortOrder: "asc" },
          include: {
            accessory: {
              select: {
                id: true,
                name: true,
                slug: true,
                variants: { take: 1, select: { sku: true } },
                images: { where: { isPrimary: true }, take: 1, select: { url: true } },
              },
            },
          },
        },
      },
    });

    expect(result?.accessories).toHaveLength(1);
    expect(result?.accessories[0].accessory.name).toBe("Product B");
    expect(result?.accessories[0].accessory.slug).toBe("product-b");
    expect(result?.accessories[0].accessory.variants[0].sku).toBe("SKU-B");
  });

  it("accessory relationship is directional", async () => {
    const category = await createTestCategory({ slug: "dir-cat" });
    const productA = await createTestProduct(category.id, { name: "A", slug: "a" });
    const productB = await createTestProduct(category.id, { name: "B", slug: "b" });

    // Link B as accessory of A
    await createTestAccessory(productA.id, productB.id);

    // Query B's accessories — should be empty
    const resultB = await prisma.product.findUnique({
      where: { id: productB.id },
      include: { accessories: true },
    });

    expect(resultB?.accessories).toHaveLength(0);

    // Query A's accessories — should have B
    const resultA = await prisma.product.findUnique({
      where: { id: productA.id },
      include: { accessories: true },
    });

    expect(resultA?.accessories).toHaveLength(1);
  });
});
