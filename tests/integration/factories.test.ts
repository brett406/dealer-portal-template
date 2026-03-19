import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createTestPriceLevel,
  createTestCompany,
  createTestCustomerWithUser,
  createTestCategory,
  createTestProduct,
  createTestVariant,
  createTestUOM,
  createTestImage,
  createFullTestProduct,
  createTestOrder,
  createTestAddress,
} from "@/tests/helpers/factories";

describe("Factory functions", () => {
  it("creates a price level", async () => {
    const pl = await createTestPriceLevel();
    expect(pl.id).toBeDefined();
    expect(pl.discountPercent.toString()).toBe("10");
  });

  it("creates a company with price level", async () => {
    const pl = await createTestPriceLevel();
    const company = await createTestCompany(pl.id);
    expect(company.priceLevelId).toBe(pl.id);
  });

  it("creates a customer with user", async () => {
    const pl = await createTestPriceLevel();
    const company = await createTestCompany(pl.id);
    const { user, customer } = await createTestCustomerWithUser(company.id);
    expect(user.role).toBe("CUSTOMER");
    expect(customer.userId).toBe(user.id);
    expect(customer.companyId).toBe(company.id);
  });

  it("creates a category", async () => {
    const cat = await createTestCategory();
    expect(cat.slug).toMatch(/^category-/);
  });

  it("creates a product with variant, UOM, and image", async () => {
    const cat = await createTestCategory();
    const product = await createTestProduct(cat.id);
    const variant = await createTestVariant(product.id);
    const uom = await createTestUOM(product.id);
    const image = await createTestImage(product.id);

    expect(variant.productId).toBe(product.id);
    expect(uom.productId).toBe(product.id);
    expect(image.productId).toBe(product.id);
  });

  it("creates a full product with variant and 3 UOMs", async () => {
    const cat = await createTestCategory();
    const { product, variant, uoms } = await createFullTestProduct(cat.id);

    expect(variant.productId).toBe(product.id);
    expect(uoms.each.conversionFactor).toBe(1);
    expect(uoms.box.conversionFactor).toBe(12);
    expect(uoms.skid.conversionFactor).toBe(144);
  });

  it("creates an order with items", async () => {
    const pl = await createTestPriceLevel();
    const company = await createTestCompany(pl.id);
    const { customer } = await createTestCustomerWithUser(company.id);
    const cat = await createTestCategory();
    const { variant } = await createFullTestProduct(cat.id);

    const order = await createTestOrder(company.id, customer.id, [
      {
        variantId: variant.id,
        productName: "Widget",
        variantName: "Red",
        sku: variant.sku,
        uomName: "Each",
        uomConversion: 1,
        quantity: 5,
        baseUnitQuantity: 5,
        unitPrice: 89.99,
        baseRetailPrice: 99.99,
        lineTotal: 449.95,
      },
    ]);

    expect(order.orderNumber).toMatch(/^ORD-/);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(5);
  });

  it("creates an address", async () => {
    const pl = await createTestPriceLevel();
    const company = await createTestCompany(pl.id);
    const address = await createTestAddress(company.id);
    expect(address.companyId).toBe(company.id);
    expect(address.country).toBe("US");
  });

  it("truncation in setup works (tables are empty at start)", async () => {
    const count = await prisma.user.count();
    expect(count).toBe(0);
  });
});
