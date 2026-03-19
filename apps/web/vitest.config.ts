import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      exclude: ["e2e/**"],
      coverage: {
        all: false,
        provider: "v8",
        reporter: ["text", "html"],
        exclude: [
          "dist/**",
          "e2e/**",
          "*.config.ts",
          "env.d.ts",
          "src/**/*.d.ts",
          "src/**/__tests__/**",
          "src/main.ts",
          "src/App.vue",
        ],
        thresholds: {
          statements: 70,
        },
      },
    },
  }),
);