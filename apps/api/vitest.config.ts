import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      exclude: [
        "dist/**",
        "*.config.ts",
        "prisma/**/*.ts",
      ],
      thresholds: {
        statements: 50,
      },
    },
  },
});
