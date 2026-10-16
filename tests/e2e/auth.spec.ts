import { expect, test } from "@playwright/test";
import { signIn, signUp, testUser, verifyPhone } from "./fixtures/auth";

test.describe("auth gates", () => {
  test("anonymous /dashboard redirects to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/auth\/sign-in/, { timeout: 60_000 });
  });

  test("anonymous /pos redirects to sign-in", async ({ page }) => {
    await page.goto("/pos");
    await expect(page).toHaveURL(/auth\/sign-in/, { timeout: 60_000 });
  });

  test("kiosk stays public", async ({ page }) => {
    await page.goto("/kiosk");
    await expect(page).not.toHaveURL(/auth\/sign-in/);
  });

  test("wrong password shows an inline error, no navigation", async ({ page }) => {
    const user = testUser("badpass");
    await signUp(page, user);
    // Fresh session for the negative case.
    await page.context().clearCookies();
    await signIn(page, user.email, "Wrongpass999!");
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/auth\/sign-in/);
  });

  test("signup lands on phone verification", async ({ page }) => {
    const user = testUser("landing");
    await signUp(page, user);
    await expect(page.getByText("Verify your mobile number")).toBeVisible({ timeout: 30_000 });
    // Leave backend state discoverable for debugging, then verify to keep
    // the shared dev DB tidy-ish (verified users are harmless).
    await verifyPhone(page, user);
  });
});
