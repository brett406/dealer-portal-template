import { test, expect } from "@playwright/test";
import { E2E } from "./constants";

// Public category catalog: 30 active products, 24 per page → 2 pages.
test.describe("public category pagination", () => {
  const cards = ".public-product-card";

  test("paginates forward and back with clean page-1 URL", async ({ page }) => {
    await page.goto(`/products/${E2E.categorySlug}`);

    // The count label <p> (exact: distinct from the pager's "… · 30 products").
    await expect(page.getByText("30 products", { exact: true })).toBeVisible();
    await expect(page.locator(cards)).toHaveCount(24);
    await expect(page.locator(".pagination")).toContainText("Page 1 of 2");

    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.locator(cards)).toHaveCount(6);
    await expect(page.locator(".pagination")).toContainText("Page 2 of 2");

    await page.getByRole("link", { name: "Previous" }).click();
    // page 1 is canonical: the ?page param is dropped
    await expect(page).toHaveURL(new RegExp(`/products/${E2E.categorySlug}$`));
    await expect(page.locator(cards)).toHaveCount(24);
  });

  test("overshoot page clamps to the last real page (not empty)", async ({ page }) => {
    await page.goto(`/products/${E2E.categorySlug}?page=99`);
    await expect(page.locator(cards)).toHaveCount(6);
    await expect(page.locator(".pagination")).toContainText("Page 2 of 2");
  });
});
