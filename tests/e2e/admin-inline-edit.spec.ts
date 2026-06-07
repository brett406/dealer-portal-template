import { test, expect } from "@playwright/test";

// Inline "edit on the page" editing (Phase 2). Runs in the `admin` project,
// which uses the seeded SUPER_ADMIN storage state.
test("admin edits a page field inline and it persists", async ({ page }) => {
  const newTitle = `E2E Inline Title ${Date.now()}`;

  await page.goto("/about");

  // Editors see the floating edit toolbar.
  const toggle = page.locator(".cms-edit-toggle");
  await expect(toggle).toBeVisible();

  // Enter edit mode.
  await toggle.click();

  // The title field (the EditableField wrapping the <h1>) is now click-to-edit.
  const titleField = page.locator(".cms-editable").filter({ has: page.locator("h1") }).first();
  await titleField.click();

  // Edit the value and save (only this field is submitted, via __partial).
  await page.locator(".cms-editing .cms-editing-input").first().fill(newTitle);
  await page.locator(".cms-btn-save").first().click();

  // The new value renders after the save + refresh.
  await expect(page.locator("h1", { hasText: newTitle })).toBeVisible({ timeout: 15_000 });

  // And it persisted: a fresh load shows it.
  await page.goto("/about");
  await expect(page.locator("h1", { hasText: newTitle })).toBeVisible();
});
