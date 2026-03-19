import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reorderToCart } from "@/lib/orders";
import { getCart } from "@/lib/cart";
import {
  createTestPriceLevel,
  createTestCompany,
  createTestCustomerWithUser,
  createTestCategory,
  createTestProduct,
  createTestVariant,
  createTestUOM,
  createTestOrder,
} from "@/tests/helpers/factories";
import { checkDatabaseAvailable } from "@/tests/helpers/integration";
import { resetDatabase } from "@/tests/helpers/db";

const Decimal = Prisma.Decimal;
let dbAvailable = false;

beforeAll(async () => { dbAvailable = await checkDatabaseAvailable(); });

describe("Reorder Flow", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  it("reorder copies active items, skips inactive product", async () => {
    // --- Setup ---
    const priceLevel = await createTestPriceLevel({ discountPercent: new Decimal(0) });
    const company = await createTestCompany(priceLevel.id, { approvalStatus: "APPROVED" });
    const { customer } = await createTestCustomerWithUser(company.id);

    const category = await createTestCategory({ slug: "reorder-cat" });

    // Product 1: active
    const product1 = await createTestProduct(category.id, { name: "Active Product", slug: "active-prod" });
    const variant1 = await createTestVariant(product1.id, { sku: "REORD-A", baseRetailPrice: new Decimal(50), stockQuantity: 100 });
    const uom1 = await createTestUOM(product1.id, { name: "Each", conversionFactor: 1 });

    // Product 2: will be deactivated
    const product2 = await createTestProduct(category.id, { name: "Inactive Product", slug: "inactive-prod" });
    const variant2 = await createTestVariant(product2.id, { sku: "REORD-B", baseRetailPrice: new Decimal(75), stockQuantity: 50 });
    const uom2 = await createTestUOM(product2.id, { name: "Each", conversionFactor: 1 });

    // Create an order with both items
    const order = await createTestOrder(company.id, customer.id, [
      {
        variantId: variant1.id,
        productName: "Active Product",
        variantName: variant1.name,
        sku: "REORD-A",
        uomName: "Each",
        uomConversion: 1,
        quantity: 3,
        baseUnitQuantity: 3,
        unitPrice: 50,
        baseRetailPrice: 50,
        lineTotal: 150,
      },
      {
        variantId: variant2.id,
        productName: "Inactive Product",
        variantName: variant2.name,
        sku: "REORD-B",
        uomName: "Each",
        uomConversion: 1,
        quantity: 2,
        baseUnitQuantity: 2,
        unitPrice: 75,
        baseRetailPrice: 75,
        lineTotal: 150,
      },
    ]);

    // Deactivate product 2
    await prisma.product.update({
      where: { id: product2.id },
      data: { active: false },
    });

    // --- Reorder ---
    const result = await reorderToCart(order.id, customer.id);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Only active product added
    expect(result.addedCount).toBe(1);
    expect(result.skippedCount).toBe(1);

    // Verify cart has only the active product
    const cart = await getCart(customer.id);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].variantId).toBe(variant1.id);
    expect(cart.items[0].quantity).toBe(3);
  });

  it("reorder merges with existing cart items", async () => {
    // --- Setup ---
    const priceLevel = await createTestPriceLevel({ discountPercent: new Decimal(0) });
    const company = await createTestCompany(priceLevel.id, { approvalStatus: "APPROVED" });
    const { customer } = await createTestCustomerWithUser(company.id, { email: "merge@test.com" });

    const category = await createTestCategory({ slug: "merge-cat" });
    const product = await createTestProduct(category.id, { name: "Merge Product", slug: "merge-prod" });
    const variant = await createTestVariant(product.id, { sku: "MERGE-001", baseRetailPrice: new Decimal(25), stockQuantity: 200 });
    const eachUOM = await createTestUOM(product.id, { name: "Each", conversionFactor: 1 });

    // Pre-populate cart with 5 units
    const { addToCart } = await import("@/lib/cart");
    await addToCart(customer.id, variant.id, eachUOM.id, 5);

    // Create order with 3 units
    const order = await createTestOrder(company.id, customer.id, [{
      variantId: variant.id,
      productName: "Merge Product",
      variantName: variant.name,
      sku: "MERGE-001",
      uomName: "Each",
      uomConversion: 1,
      quantity: 3,
      baseUnitQuantity: 3,
      unitPrice: 25,
      baseRetailPrice: 25,
      lineTotal: 75,
    }]);

    // --- Reorder ---
    const result = await reorderToCart(order.id, customer.id);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.addedCount).toBe(1);

    // Cart should have 1 item with merged quantity: 5 + 3 = 8
    const cart = await getCart(customer.id);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(8);
  });
});
