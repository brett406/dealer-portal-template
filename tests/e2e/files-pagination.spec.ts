import { test, expect } from "@playwright/test";

// Portal files browser (dealer auth). 20 assets total (16 in "Brochures", 4
// unfiled "Catalog"), 15 per page.
test.describe("portal files: folder-aware pagination + search", () => {
  const rows = ".data-table tbody tr";

  test("All Files paginates across the whole library", async ({ page }) => {
    await page.goto("/portal/files");
    await expect(page.locator(".pagination")).toContainText("Page 1 of 2");
    await expect(page.locator(rows)).toHaveCount(15);

    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.locator(rows)).toHaveCount(5);
  });

  test("switching folder scopes the list and resets to page 1", async ({ page }) => {
    await page.goto("/portal/files");
    await page.getByRole("link", { name: /Brochures/ }).click();
    await expect(page).toHaveURL(/[?&]folder=/);
    // 16 in the folder → still 2 pages, back on page 1
    await expect(page.locator(".pagination")).toContainText("Page 1 of 2");
    await expect(page.locator(rows)).toHaveCount(15);
  });

  test("search filters the whole library, not just the page", async ({ page }) => {
    await page.goto("/portal/files");
    const box = page.getByRole("searchbox", { name: "Search files" });
    await box.fill("Catalog");
    await box.press("Enter");
    await expect(page).toHaveURL(/[?&]q=Catalog/);
    // Only the 4 unfiled "Catalog" files match — fewer than one page, no pager.
    await expect(page.locator(rows)).toHaveCount(4);
    await expect(page.locator(".pagination")).toHaveCount(0);
  });
});
