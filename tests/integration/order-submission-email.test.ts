import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addToCart } from "@/lib/cart";
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

describe("Order Submission Emails", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  it("createOrderFromCart creates order (emails handled by caller, not service)", async () => {
    // The createOrderFromCart service function does NOT send emails itself.
    // Email sending is handled by the server action wrapper (submitOrder in cart/actions.ts).
    // This test verifies the order is created correctly so the caller can send emails.

    await createDealerSettings({ flatShippingRate: "10.00" });

    const priceLevel = await createTestPriceLevel({
      name: "Distributor",
      discountPercent: new Decimal(30),
    });

    const company = await createTestCompany(priceLevel.id, {
      name: "Email Test Corp",
      approvalStatus: "APPROVED",
    });

    const { customer } = await createTestCustomerWithUser(company.id, {
      name: "Email Buyer",
      email: "emailbuyer@test.com",
    });

    const category = await createTestCategory({ slug: "email-cat" });
    const product = await createTestProduct(category.id, {
      name: "Email Product",
      slug: "email-prod",
    });
    const variant = await createTestVariant(product.id, {
      name: "Standard",
      sku: "EMAIL-001",
      baseRetailPrice: new Decimal(80),
      stockQuantity: 50,
    });
    const boxUOM = await createTestUOM(product.id, {
      name: "Box",
      conversionFactor: 12,
    });

    await addToCart(customer.id, variant.id, boxUOM.id, 2);

    const result = await createOrderFromCart(customer.id);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Verify the order has all data an email template would need
    const order = await prisma.order.findUnique({
      where: { id: result.orderId },
      include: {
        items: true,
        company: { select: { name: true } },
        customer: { select: { name: true, email: true } },
      },
    });

    expect(order).not.toBeNull();
    if (!order) return;

    // Email would need:
    expect(order.orderNumber).toBeTruthy();
    expect(order.company.name).toBe("Email Test Corp");
    expect(order.customer.name).toBe("Email Buyer");
    expect(order.customer.email).toBe("emailbuyer@test.com");
    expect(order.priceLevelSnapshot).toBe("Distributor");

    // Line item has UOM info for email template
    const item = order.items[0];
    expect(item.productNameSnapshot).toBe("Email Product");
    expect(item.uomNameSnapshot).toBe("Box");
    expect(item.uomConversionSnapshot).toBe(12);
    expect(item.quantity).toBe(2);

    // Price: 80 * 12 = 960 retail per box, 960 * 0.7 = 672 customer price
    // Line total: 672 * 2 = 1344
    expect(Number(item.unitPrice)).toBe(672);
    expect(Number(item.lineTotal)).toBe(1344);
    expect(Number(order.subtotal)).toBe(1344);
    expect(Number(order.shippingCost)).toBe(10);
    expect(Number(order.total)).toBe(1354);
  });
});
