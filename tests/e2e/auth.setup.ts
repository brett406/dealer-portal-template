import { test as setup, expect, type Page } from "@playwright/test";
import { E2E, ADMIN_STATE, CUSTOMER_STATE } from "./constants";

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Successful login redirects away from /auth/login (to /admin or /portal).
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 20_000 });
}

setup("authenticate as admin", async ({ page }) => {
  await login(page, E2E.adminEmail, E2E.password);
  await page.context().storageState({ path: ADMIN_STATE });
});

setup("authenticate as customer", async ({ page }) => {
  await login(page, E2E.customerEmail, E2E.password);
  await page.context().storageState({ path: CUSTOMER_STATE });
});
