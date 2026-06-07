import { test, expect } from "@playwright/test";

// Anonymous visitors must get NO inline-editing UI (and, by design, none of the
// CMS edit client bundle). Runs in the `public` project (no auth state).
test("anonymous visitors get no inline edit UI", async ({ page }) => {
  await page.goto("/about");
  await expect(page.locator("h1")).toBeVisible(); // page rendered
  await expect(page.locator(".cms-edit-toolbar")).toHaveCount(0);
  await expect(page.locator(".cms-editable")).toHaveCount(0);
});
