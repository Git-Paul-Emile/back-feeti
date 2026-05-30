import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    setupFiles: [],
    coverage: {
      provider: "v8",
      include: [
        "src/utils/financial.ts",
        "src/services/transaction.service.ts",
        "src/services/payout.service.ts",
        "src/services/wallet.service.ts",
        "src/services/loyalty.service.ts",
        "src/services/auth.service.ts",
        "src/services/ticket.service.ts",
        "src/services/access.service.ts",
        "src/utils/AppError.ts",
      ],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
});
