import path from "node:path";
import { defineConfig } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrations: {
    // Prisma 7 reads the seed command from here (not package.json). The seed
    // script has its own prod/populated-DB guards (DATABASE_SAFETY.md §3c).
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
