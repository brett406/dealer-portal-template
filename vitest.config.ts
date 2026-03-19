import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/auth.ts",           // NextAuth config — requires Next.js runtime
        "lib/auth-redirects.ts", // URL builders — tested indirectly via guards
        "lib/auth-security.ts",  // Requires Request headers — tested via auth flow
        "lib/email.ts",          // Resend client — integration-only
        "lib/email-templates.ts", // HTML templates — visual verification
        "lib/theme.ts",          // YAML config reader — deterministic
        "lib/prisma.ts",         // DB client singleton
        "lib/cms.ts",            // Thin Prisma wrappers — tested via integration
        "lib/content-config.ts", // YAML config reader
        "lib/uploads.ts",        // File I/O — tested manually
        "lib/env.ts",            // Env validation — tested at startup
        "lib/rate-limit.ts",     // In-memory store — tested indirectly
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 95,
      },
    },
    pool: "forks",
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
