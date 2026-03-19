import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addToCart, getCart } from "@/lib/cart";
import { createOrderFromCart } from "@/lib/orders";
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

describe("Cart-to-Order Pipeline", () => {
  // Skip all tests if no database
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  it("full pipeline: cart → order with correct snapshots, stock, and cleanup", async () => {
    // --- Setup ---
    const priceLevel = await createTestPriceLevel({
      name: "Dealer",
      discountPercent: new Decimal(20),
    });

    const company = await createTestCompany(priceLevel.id, {
      name: "Test Corp",
      approvalStatus: "APPROVED",
    });

    const { user, customer } = await createTestCustomerWithUser(company.id, {
      name: "Test Buyer",
      email: "buyer@test.com",
    });

    const address = await createTestAddress(company.id, {
      label: "Main Warehouse",
      isDefault: true,
    });

    const category = await createTestCategory({ name: "Tools", slug: "tools" });
    const product = await createTestProduct(category.id, {
      name: "Pro Hammer",
      slug: "pro-hammer",
    });

    const variant = await createTestVariant(product.id, {
      name: "Standard",
      sku: "HAM-STD",
      baseRetailPrice: new Decimal(100),
      stockQuantity: 100,
    });

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

    // Shipping settings (free, to simplify math)
    await createDealerSettings({ flatShippingRate: "15.00" });

    // --- Add to cart ---
    const addBoxResult = await addToCart(customer.id, variant.id, boxUOM.id, 3);
    expect(addBoxResult).toEqual({ success: true });

    const addEachResult = await addToCart(customer.id, variant.id, eachUOM.id, 5);
    expect(addEachResult).toEqual({ success: true });

    // Verify cart has 2 items
    const cart = await getCart(customer.id);
    expect(cart.items).toHaveLength(2);

    // --- Create order ---
    const result = await createOrderFromCart(customer.id, {
      shippingAddressId: address.id,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // --- Verify order ---
    const order = await prisma.order.findUnique({
      where: { id: result.orderId },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        statusHistory: true,
      },
    });

    expect(order).not.toBeNull();
    if (!order) return;

    // Order number format
    const year = new Date().getFullYear();
    expect(order.orderNumber).toMatch(new RegExp(`^ORD-${year}-\\d{4}$`));

    // Status
    expect(order.status).toBe("RECEIVED");

    // 2 line items
    expect(order.items).toHaveLength(2);

    // Find items by UOM
    const boxItem = order.items.find((i) => i.uomNameSnapshot === "Box");
    const eachItem = order.items.find((i) => i.uomNameSnapshot === "Each");

    expect(boxItem).toBeDefined();
    expect(eachItem).toBeDefined();
    if (!boxItem || !eachItem) return;

    // Box item: qty=3, baseUnitQty=36, conversion=12
    expect(boxItem.quantity).toBe(3);
    expect(boxItem.baseUnitQuantity).toBe(36);
    expect(boxItem.uomConversionSnapshot).toBe(12);
    expect(boxItem.productNameSnapshot).toBe("Pro Hammer");
    expect(boxItem.variantNameSnapshot).toBe("Standard");
    expect(boxItem.skuSnapshot).toBe("HAM-STD");

    // Each item: qty=5, baseUnitQty=5, conversion=1
    expect(eachItem.quantity).toBe(5);
    expect(eachItem.baseUnitQuantity).toBe(5);
    expect(eachItem.uomConversionSnapshot).toBe(1);

    // Pricing: base retail = $100, 20% discount
    // Box: 100 * 12 * 0.8 = 960 per box, 960 * 3 = 2880
    // Each: 100 * 1 * 0.8 = 80 per each, 80 * 5 = 400
    // Subtotal = 3280
    expect(Number(boxItem.unitPrice)).toBe(960);
    expect(Number(boxItem.lineTotal)).toBe(2880);
    expect(Number(eachItem.unitPrice)).toBe(80);
    expect(Number(eachItem.lineTotal)).toBe(400);

    const expectedSubtotal = 3280;
    expect(Number(order.subtotal)).toBe(expectedSubtotal);
    expect(Number(order.shippingCost)).toBe(15);
    expect(Number(order.total)).toBe(expectedSubtotal + 15);

    // Price level snapshot
    expect(order.priceLevelSnapshot).toBe("Dealer");
    expect(Number(order.discountPercentSnapshot)).toBe(20);

    // Base retail price snapshot
    expect(Number(boxItem.baseRetailPriceSnapshot)).toBe(100);
    expect(Number(eachItem.baseRetailPriceSnapshot)).toBe(100);

    // --- Verify stock decreased ---
    const updatedVariant = await prisma.productVariant.findUnique({
      where: { id: variant.id },
    });
    // 100 - 36 (3 boxes) - 5 (each) = 59
    expect(updatedVariant?.stockQuantity).toBe(59);

    // --- Verify cart is empty ---
    const cartAfter = await getCart(customer.id);
    expect(cartAfter.items).toHaveLength(0);

    // --- Verify status history ---
    expect(order.statusHistory).toHaveLength(1);
    expect(order.statusHistory[0].status).toBe("RECEIVED");
    expect(order.statusHistory[0].notes).toBe("Order placed");
    expect(order.statusHistory[0].changedById).toBe(user.id);
  });
});
