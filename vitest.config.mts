import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "apps/web/**/*.{test,spec}.{ts,tsx}",
      "packages/*/src/**/*.{test,spec}.{ts,tsx}",
      "packages/**/*.{test,spec}.{ts,tsx}",
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "tests/integration/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**", "**/.next/**", "tests/e2e/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    // Integration suites share one Postgres test database: run files
    // serially so per-file TRUNCATE isolation can't clobber a sibling file.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": `${import.meta.dirname}/apps/web`,
      react: `${import.meta.dirname}/apps/web/node_modules/react`,
      "react-dom": `${import.meta.dirname}/apps/web/node_modules/react-dom`,
      "@pixa/db": `${import.meta.dirname}/packages/db/index.ts`,
      "@pixa/contracts": `${import.meta.dirname}/packages/contracts/index.ts`,
    },
  },
});
