import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addToCart, getCartWithPricing } from "@/lib/cart";
import { createOrderFromCart } from "@/lib/orders";
import { getProductPricing } from "@/lib/pricing-server";
import {
  createTestPriceLevel,
  createTestCompany,
  createTestCustomerWithUser,
  createTestCategory,
  createTestProduct,
  createTestVariant,
  createTestUOM,
  createTestAddress,
} from "@/tests/helpers/factories";
import { checkDatabaseAvailable, createDealerSettings } from "@/tests/helpers/integration";
import { resetDatabase } from "@/tests/helpers/db";

const Decimal = Prisma.Decimal;

let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await checkDatabaseAvailable();
});

// End-to-end proof that a USD dealer is priced off the USD column, the order
// freezes USD, and an item with no USD price is blocked (never priced off CAD).
describe("USD order pipeline", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  async function setup() {
    const priceLevel = await createTestPriceLevel({ name: "Dealer", discountPercent: new Decimal(20) });
    const company = await createTestCompany(priceLevel.id, { currency: "USD", approvalStatus: "APPROVED" });
    const { customer } = await createTestCustomerWithUser(company.id, { email: "dana@stateline.test" });
    const address = await createTestAddress(company.id, { isDefault: true });
    const category = await createTestCategory();
    await createDealerSettings({ flatShippingRate: "0.00" });

    // Product A — priced in both currencies (CAD 100 / USD 80)
    const productA = await createTestProduct(category.id, { madeToOrder: false });
    const variantA = await createTestVariant(productA.id, {
      sku: "USD-A",
      baseRetailPrice: new Decimal(100),
      baseRetailPriceUsd: new Decimal(80),
      stockQuantity: 1000,
    });
    const eachA = await createTestUOM(productA.id, { name: "Each", conversionFactor: 1, sortOrder: 0 });
    const boxA = await createTestUOM(productA.id, { name: "Box", conversionFactor: 12, sortOrder: 1 });

    // Product B — NO USD price (CAD only)
    const productB = await createTestProduct(category.id, { madeToOrder: false });
    const variantB = await createTestVariant(productB.id, {
      sku: "USD-B",
      baseRetailPrice: new Decimal(50),
      baseRetailPriceUsd: null,
      stockQuantity: 1000,
    });
    const eachB = await createTestUOM(productB.id, { name: "Each", conversionFactor: 1, sortOrder: 0 });

    return { priceLevel, company, customer, address, productA, variantA, eachA, boxA, productB, variantB, eachB };
  }

  it("prices a USD order off the USD column and freezes currency=USD on the order", async () => {
    const s = await setup();

    await addToCart(s.customer.id, s.variantA.id, s.eachA.id, 5); // 5 Each
    await addToCart(s.customer.id, s.variantA.id, s.boxA.id, 2);  // 2 Box (×12)

    const result = await createOrderFromCart(s.customer.id, { shippingAddressId: s.address.id });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const order = await prisma.order.findUnique({
      where: { id: result.orderId },
      include: { items: true },
    });
    expect(order).not.toBeNull();
    if (!order) return;

    expect(order.currency).toBe("USD");

    const eachItem = order.items.find((i) => i.uomNameSnapshot === "Each")!;
    const boxItem = order.items.find((i) => i.uomNameSnapshot === "Box")!;

    // USD base 80, 20% off → Each = 64; Box = 80*12*0.8 = 768
    expect(Number(eachItem.unitPrice)).toBe(64);
    expect(Number(eachItem.lineTotal)).toBe(320);       // 64 * 5
    expect(Number(eachItem.baseRetailPriceSnapshot)).toBe(80); // USD base, NOT 100
    expect(Number(boxItem.unitPrice)).toBe(768);
    expect(Number(boxItem.lineTotal)).toBe(1536);       // 768 * 2
    expect(Number(order.subtotal)).toBe(1856);          // 320 + 1536
  });

  it("blocks a USD order containing an item with no USD price (no CAD fallback)", async () => {
    const s = await setup();

    await addToCart(s.customer.id, s.variantB.id, s.eachB.id, 1); // product B has no USD price

    const pricing = await getCartWithPricing(s.customer.id, s.priceLevel.id, "USD");
    const line = pricing.items.find((i) => i.sku === "USD-B")!;
    expect(line.pricedInCurrency).toBe(false);
    expect(pricing.canSubmit).toBe(false);

    const result = await createOrderFromCart(s.customer.id, { shippingAddressId: s.address.id });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/USD/);

    const count = await prisma.order.count({ where: { companyId: s.company.id } });
    expect(count).toBe(0);
  });

  it("getProductPricing returns different prices per currency (no cross-currency collision)", async () => {
    const s = await setup();

    const cad = await getProductPricing(s.productA.id, s.priceLevel.id, "CAD");
    const usd = await getProductPricing(s.productA.id, s.priceLevel.id, "USD");

    const cadEach = cad!.variants[0].uomPrices.find((u) => u.uomName === "Each")!;
    const usdEach = usd!.variants[0].uomPrices.find((u) => u.uomName === "Each")!;

    expect(cadEach.retailPrice).toBe(100);
    expect(cadEach.customerPrice).toBe(80);  // 100 * 0.8
    expect(usdEach.retailPrice).toBe(80);
    expect(usdEach.customerPrice).toBe(64);  // 80 * 0.8
  });
});
