import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";
import { E2E, ADMIN_STATE, CUSTOMER_STATE } from "./tests/e2e/constants";

const DB = process.env.DATABASE_TEST_URL;
if (!DB) throw new Error("playwright: DATABASE_TEST_URL must point at a local test DB");

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1, // single worker: one seeded DB + one server, deterministic counts
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: E2E.baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "public",
      testMatch: /public-.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "customer",
      testMatch: /files-.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: CUSTOMER_STATE },
      dependencies: ["setup"],
    },
    {
      name: "admin",
      testMatch: /admin-.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STATE },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // `next dev` (not build+start): the app uses output:"standalone", which
    // `next start` does not serve. Dev mode behaves identically for the
    // server-rendered pagination under test and needs no build step.
    command: `npx next dev -p ${E2E.port}`,
    url: E2E.baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: DB,
      AUTH_SECRET: process.env.AUTH_SECRET || "e2e-secret-please-change",
      AUTH_URL: E2E.baseURL,
      NEXT_PUBLIC_SITE_URL: E2E.baseURL,
    },
  },
});
