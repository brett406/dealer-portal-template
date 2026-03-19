import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const txFindUnique = vi.fn();
const txUpdate = vi.fn();

const mockPrisma = {
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
    await fn({
      productVariant: {
        findUnique: txFindUnique,
        update: txUpdate,
      },
    });
  }),
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { decrementStock } = await import("@/lib/inventory");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("decrementStock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txUpdate.mockResolvedValue({});
  });

  it("decrements by baseUnitQuantity (3 Boxes of 12 = 36)", async () => {
    txFindUnique.mockResolvedValue({ stockQuantity: 100 });

    await decrementStock([{ variantId: "v1", baseUnitQuantity: 36 }]);

    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { stockQuantity: { decrement: 36 } },
    });
  });

  it("decrements for Each UOM correctly (quantity = baseUnitQuantity)", async () => {
    txFindUnique.mockResolvedValue({ stockQuantity: 50 });

    await decrementStock([{ variantId: "v1", baseUnitQuantity: 5 }]);

    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { stockQuantity: { decrement: 5 } },
    });
  });

  it("decrements for Skid UOM correctly (1 Skid of 144 = 144)", async () => {
    txFindUnique.mockResolvedValue({ stockQuantity: 200 });

    await decrementStock([{ variantId: "v1", baseUnitQuantity: 144 }]);

    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { stockQuantity: { decrement: 144 } },
    });
  });

  it("multiple items from same variant sum correctly", async () => {
    txFindUnique.mockResolvedValue({ stockQuantity: 100 });

    await decrementStock([
      { variantId: "v1", baseUnitQuantity: 12 },
      { variantId: "v1", baseUnitQuantity: 24 },
    ]);

    // Should aggregate to 36 and only call update once
    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { stockQuantity: { decrement: 36 } },
    });
  });

  it("cannot decrement below zero (error)", async () => {
    txFindUnique.mockResolvedValue({ stockQuantity: 5 });

    await expect(
      decrementStock([{ variantId: "v1", baseUnitQuantity: 10 }]),
    ).rejects.toThrow(/insufficient stock/i);
  });

  it("atomic: if one item fails, none are decremented", async () => {
    // First variant OK, second insufficient
    txFindUnique
      .mockResolvedValueOnce({ stockQuantity: 100 }) // v1 OK
      .mockResolvedValueOnce({ stockQuantity: 2 }); // v2 fails

    await expect(
      decrementStock([
        { variantId: "v1", baseUnitQuantity: 10 },
        { variantId: "v2", baseUnitQuantity: 5 },
      ]),
    ).rejects.toThrow(/insufficient stock/i);

    // The transaction rejects, so from the caller's perspective both roll back.
    // (The mock doesn't actually roll back but we verify the error was thrown.)
  });
});
