import { test, expect } from "@playwright/test";

// BOM costing smoke (docs/BOM-COSTING.md §18.3). Admin auth via the shared
// storage state. The E2E seed enables bomCostingEnabled and creates 30 widgets
// with one variant each; this flow builds a tiny BOM on Widget 01:
//   material $10.00 × qty 2, labor $60.00/h × 0.5h, markups 0% (site default)
//   → price = 20.00 + 30.00 = $50.00
test.describe("BOM costing admin smoke", () => {
  test("material + labor rate → product BOM → read-only computed price", async ({ page }) => {
    // 1. Create a labor rate via the inline add form.
    await page.goto("/admin/labor-rates");
    await page.getByRole("button", { name: "Add Labor Rate" }).click();
    await page.locator('input[name="name"]').fill("Smoke Welder");
    await page.locator('input[name="ratePerHour"]').fill("60.00");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Smoke Welder")).toBeVisible();

    // 2. Create a raw material via the New Material modal (redirects to detail).
    await page.goto("/admin/materials");
    await page.getByRole("button", { name: "New Material" }).click();
    await page.locator('input[name="name"]').fill("Smoke Steel");
    await page.locator('input[name="unitCost"]').fill("10.00");
    await page.getByRole("button", { name: /create/i }).click();
    await page.waitForURL(/\/admin\/materials\/[^/]+$/);

    // 3. Open the seeded product's edit page from the admin list.
    await page.goto("/admin/products");
    await page
      .getByRole("row", { name: /E2E Widget 01/ })
      .getByRole("link", { name: "Edit" })
      .click();
    await page.waitForURL(/\/admin\/products\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: "BOM (Bill of Materials) Costing" }),
    ).toBeVisible();

    // 4. Enable BOM pricing via the status card (off by default; the editor
    //    is hidden until it's turned on). Markups inherit the 0% site defaults.
    await expect(page.getByText("BOM pricing for this product is off")).toBeVisible();
    await page.getByRole("button", { name: "Turn on BOM pricing" }).click();
    await expect(page.getByText("BOM pricing for this product is on")).toBeVisible();
    await expect(page.getByRole("button", { name: "Turn off BOM pricing" })).toBeVisible();

    // 5. Add a component line: 2 × Smoke Steel.
    await page.getByRole("button", { name: "Add Component" }).first().click();
    await page.locator('select[name="materialId"]').selectOption({ label: "Smoke Steel — $10.0000/each" });
    await page.locator('input[name="quantity"]').fill("2");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    // Line saved → it renders in the product BOM list.
    await expect(page.getByText("Smoke Steel").first()).toBeVisible();

    // 6. Add a labor line: 0.5 h of Smoke Welder.
    await page.getByRole("button", { name: "Add Labor", exact: true }).first().click();
    await page.locator('select[name="laborRateId"]').selectOption({ label: "Smoke Welder — $60.00/h" });
    await page.locator('input[name="hours"]').fill("0.5");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    // 7. Live breakdown shows the computed price ($50.00) and the variant's
    //    price column is BOM-locked (§5 read-only guardrail).
    await expect(page.getByText("Computed price").first()).toBeVisible();
    await expect(page.getByText("$50.00").first()).toBeVisible();
    await expect(page.locator(".bom-badge").first()).toBeVisible();

    // 8. The public catalog shows the repriced variant.
    await page.goto("/products/e2e-widgets");
    await expect(page.getByText("E2E Widget 01").first()).toBeVisible();
    await expect(
      page.getByText("$50.00").first(),
      "public catalog should show the BOM-computed price",
    ).toBeVisible();
  });
});
