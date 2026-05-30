import "dotenv/config";
import { seedE2E } from "./seed";

// Runs once before the whole E2E suite. Points the seed at the local test DB
// (the same one the webServer is configured to use) and loads deterministic data.
export default async function globalSetup() {
  if (!process.env.DATABASE_TEST_URL) {
    throw new Error("E2E: DATABASE_TEST_URL must be set to a local test database");
  }
  process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
  await seedE2E();
}
