import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndVerify, testUser } from "./fixtures/auth";

test.describe("workspace onboarding", () => {
  test("validation blocks empty business name", async ({ page }) => {
    const user = testUser("onboard-valid");
    await signUpAndVerify(page, user);
    // Verified users without an org land on onboarding.
    await page.goto("/onboarding");
    await page.getByLabel(/Initial outlet name/i).fill("Main Counter");
    await page.getByRole("button", { name: "Create workspace & start trial" }).click();
    await expect(page.getByText("Business name is required")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/onboarding/);
  });

  test("full funnel: business + outlet → dashboard with trial", async ({ page }) => {
    const user = testUser("onboard-full");
    await signUpAndVerify(page, user);
    const stamp = Date.now().toString(36);
    await completeOnboarding(page, {
      business: `E2E Bhavan ${stamp}`,
      outlet: "Main Counter",
    });
    // Dashboard home fast-paths to overview for fresh admins.
    await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 });
  });
});
