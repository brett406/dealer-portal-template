import { test, expect } from "@playwright/test";

// Admin product list (admin auth). 30 products, 25 per page → 2 pages.
test.describe("admin products pagination", () => {
  const rows = ".data-table tbody tr";

  test("paginates the admin product table", async ({ page }) => {
    await page.goto("/admin/products");
    await expect(page.locator(".pagination")).toContainText("Page 1 of 2");
    await expect(page.locator(rows)).toHaveCount(25);

    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.locator(rows)).toHaveCount(5);
  });
});
