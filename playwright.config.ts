import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3111";
const CI = !!process.env.CI;

/**
 * E2E against a dedicated Next dev server on :3111 (never the :3000 dev
 * loop). The server runs the same build + .env.local as local dev, so
 * OTP_STATIC_CODE makes phone verification deterministic.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/e2e-report" }]],
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec next dev -p 3111 -H 127.0.0.1",
    cwd: "./apps/web",
    url: `${BASE_URL}/api/health`,
    // Never reuse a stray server: a manually-booted instance lacks the
    // BETTER_AUTH_URL override and fails auth with "Invalid origin".
    // Opt back in explicitly with PW_REUSE_SERVER=1 when you own the server.
    reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
    timeout: 240_000,
    env: {
      ...process.env,
      PORT: "3111",
      // Real env beats apps/web/.env.local in Next.js: align the auth
      // origin with the e2e base URL so better-auth accepts our origin.
      BETTER_AUTH_URL: BASE_URL,
    } as Record<string, string>,
  },
});
