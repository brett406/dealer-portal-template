import "dotenv/config";
import { beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/tests/helpers/db";

beforeEach(async () => {
  try {
    await resetDatabase();
  } catch {
    // Skip DB reset for unit tests that mock prisma
  }
});

afterAll(async () => {
  try {
    await prisma.$disconnect();
  } catch {
    // Skip disconnect for unit tests that mock prisma
  }
});
