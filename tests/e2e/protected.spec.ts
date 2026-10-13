import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndVerify, testUser } from "./fixtures/auth";

test.describe("protected surfaces", () => {
  test("fresh admin reaches /pos after onboarding", async ({ page }) => {
    const user = testUser("pos-access");
    await signUpAndVerify(page, user);
    const stamp = Date.now().toString(36);
    await completeOnboarding(page, { business: `E2E POS ${stamp}`, outlet: "Counter 1" });
    await page.goto("/pos");
    await expect(page).not.toHaveURL(/auth\/sign-in/, { timeout: 60_000 });
    await expect(page).toHaveURL(/pos/);
  });

  test("session persists across reload on dashboard", async ({ page }) => {
    const user = testUser("persist");
    await signUpAndVerify(page, user);
    const stamp = Date.now().toString(36);
    await completeOnboarding(page, { business: `E2E Persist ${stamp}`, outlet: "Counter 1" });
    await page.reload();
    await expect(page).not.toHaveURL(/auth\/sign-in/, { timeout: 60_000 });
    await expect(page).toHaveURL(/dashboard/);
  });
});
