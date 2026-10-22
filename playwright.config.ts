import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3111";
const CI = !!process.env.CI;

/**
 * Fail fast unless the dev server's database looks non-production.
 * The spawned `next dev` loads apps/web/.env.local, so read the same file.
 * This guard exists because e2e runs once wrote test fixtures into prod.
 */
function assertNonProdDatabase(): void {
  let url = "";
  try {
    const env = readFileSync(join(process.cwd(), "apps", "web", ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("DATABASE_URL=")) continue;
      url = trimmed.slice("DATABASE_URL=".length).trim();
    }
  } catch {
    // No local env file (e.g. CI injects env directly) — nothing to check here.
    return;
  }
  if (!url) return;
  const m = url.match(/^postgresql:\/\/.*@([^/]+)\/([^?]+)/);
  const dbName = m ? m[2] : "";
  if (!/dev|test/i.test(dbName)) {
    throw new Error(
      `[e2e] refusing to run: DATABASE_URL points at database "${dbName || "<unparseable>"}" ` +
        `which does not look like a dev/test database. Point local dev at the sage dev DB first.`,
    );
  }
}

assertNonProdDatabase();

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
