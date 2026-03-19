import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Mock Next.js server modules that auth-guards imports transitively
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

import { prisma } from "@/lib/prisma";
import { getEffectiveCustomerId } from "@/lib/auth-guards";
import { addToCart } from "@/lib/cart";
import { getCartWithPricing } from "@/lib/cart";
import { createOrderFromCart } from "@/lib/orders";
import {
  createTestPriceLevel,
  createTestCompany,
  createTestCustomerWithUser,
  createTestCategory,
  createTestProduct,
  createTestVariant,
  createTestUOM,
} from "@/tests/helpers/factories";
import { checkDatabaseAvailable, createDealerSettings } from "@/tests/helpers/integration";
import { resetDatabase } from "@/tests/helpers/db";

const Decimal = Prisma.Decimal;
let dbAvailable = false;

beforeAll(async () => { dbAvailable = await checkDatabaseAvailable(); });

describe("Admin Act-As-Customer", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  it("full act-as flow: admin sees customer pricing, places order with audit trail", async () => {
    // --- Setup ---
    await createDealerSettings({ flatShippingRate: "0" });

    const dealerLevel = await createTestPriceLevel({
      name: "Dealer",
      discountPercent: new Decimal(20),
    });

    const company = await createTestCompany(dealerLevel.id, {
      approvalStatus: "APPROVED",
    });

    const { user: customerUser, customer } = await createTestCustomerWithUser(
      company.id,
      { email: "customer@test.com" },
    );

    // Admin user (not linked to a customer)
    const adminUser = await prisma.user.create({
      data: {
        email: "admin@test.com",
        password: "$2a$10$fakehash",
        name: "Admin User",
        role: "SUPER_ADMIN",
      },
    });

    const category = await createTestCategory({ slug: "act-as-cat" });
    const product = await createTestProduct(category.id, { slug: "act-as-prod" });
    const variant = await createTestVariant(product.id, {
      sku: "ACT-AS-001",
      baseRetailPrice: new Decimal(200),
      stockQuantity: 50,
    });
    const eachUOM = await createTestUOM(product.id, {
      name: "Each",
      conversionFactor: 1,
    });

    // --- getEffectiveCustomerId returns customer, not admin ---
    const session = {
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: "SUPER_ADMIN" as const,
        mustChangePassword: false,
        actingAsCustomerId: customer.id,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    };

    const effectiveId = getEffectiveCustomerId(session);
    expect(effectiveId).toBe(customer.id);
    expect(effectiveId).not.toBe(adminUser.id);

    // --- getCartWithPricing uses customer's price level ---
    // First add an item to the customer's cart
    const addResult = await addToCart(customer.id, variant.id, eachUOM.id, 2);
    expect(addResult).toEqual({ success: true });

    const cartPricing = await getCartWithPricing(customer.id, dealerLevel.id);
    expect(cartPricing.priceLevelName).toBe("Dealer");
    expect(cartPricing.discountPercent).toBe(20);

    // Price: 200 * 0.8 = 160
    expect(cartPricing.items[0].customerPrice).toBe(160);
    expect(cartPricing.items[0].retailPrice).toBe(200);

    // --- Create order with placedByAdminId ---
    const orderResult = await createOrderFromCart(customer.id, {
      placedByAdminId: adminUser.id,
    });

    expect(orderResult.success).toBe(true);
    if (!orderResult.success) return;

    const order = await prisma.order.findUnique({
      where: { id: orderResult.orderId },
      include: { statusHistory: true },
    });

    expect(order).not.toBeNull();
    if (!order) return;

    // Order belongs to customer
    expect(order.customerId).toBe(customer.id);
    // Audit trail: placed by admin
    expect(order.placedByAdminId).toBe(adminUser.id);
    // Pricing uses Dealer discount
    expect(Number(order.discountPercentSnapshot)).toBe(20);
    expect(order.priceLevelSnapshot).toBe("Dealer");

    // Status history changedBy = admin
    expect(order.statusHistory[0].changedById).toBe(adminUser.id);

    // Customer's cart is cleared
    const cartAfter = await prisma.cart.findUnique({
      where: { customerId: customer.id },
      include: { items: true },
    });
    expect(cartAfter?.items).toHaveLength(0);
  });
});
