import { expect, type Page } from "@playwright/test";

export const STATIC_OTP = process.env.PLAYWRIGHT_STATIC_OTP ?? "123456";

export type TestUser = { name: string; email: string; password: string; phone: string };

let counter = 0;

/** Deterministic unique user per test (email + phone unique constraints). */
export function testUser(tag = "e2e"): TestUser {
  counter += 1;
  const stamp = `${Date.now().toString(36)}${counter}${Math.floor(Math.random() * 1e4)}`;
  const phoneDigits = `9${String(100000000 + Math.floor(Math.random() * 899999999))}`;
  return {
    name: `E2E ${tag}`,
    email: `${tag}-${stamp}@test.local`,
    password: "Testpass123!",
    phone: `+91${phoneDigits}`,
  };
}

export async function signUp(page: Page, user: TestUser): Promise<void> {
  await page.goto("/auth/sign-up");
  await page.locator("#ba-name").fill(user.name);
  await page.locator("#ba-email").fill(user.email);
  await page.locator("#ba-password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/auth/verify-phone", { timeout: 60_000 });
}

export async function verifyPhone(page: Page, user: TestUser): Promise<void> {
  await page.locator("#vp-phone").fill(user.phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.locator("#vp-code").fill(STATIC_OTP);
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await page.waitForURL("**/dashboard**", { timeout: 90_000 });
}

/** Full funnel: sign up → verify phone → land on dashboard. */
export async function signUpAndVerify(page: Page, user: TestUser): Promise<void> {
  await signUp(page, user);
  await verifyPhone(page, user);
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/auth/sign-in");
  await page.locator("#ba-email").fill(email);
  await page.locator("#ba-password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function completeOnboarding(
  page: Page,
  opts: { business: string; outlet: string },
): Promise<void> {
  await page.goto("/onboarding");
  await page.getByLabel(/Business \/ restaurant name/i).fill(opts.business);
  await page.getByLabel(/Initial outlet name/i).fill(opts.outlet);
  const submit = page.getByRole("button", { name: "Create workspace & start trial" });
  // The dev server occasionally resets a connection mid-submit (cold
  // compile + session lookup race): retry the submit until we either leave
  // onboarding or see an error toast.
  const deadline = Date.now() + 90_000;
  let lastError: string | null = null;
  while (Date.now() < deadline) {
    if (!page.url().includes("/onboarding")) break;
    const toast = page.locator("[data-sonner-toast]");
    if (
      await toast
        .count()
        .then((n) => n > 0)
        .catch(() => false)
    ) {
      lastError = await toast
        .first()
        .innerText()
        .catch(() => "unknown error");
      break;
    }
    await submit.click({ timeout: 15_000 }).catch(() => {});
    try {
      await page.waitForURL("**/dashboard**", { timeout: 15_000 });
      break;
    } catch {
      // Still on onboarding — loop retries the submit.
    }
  }
  if (lastError) throw new Error(`Onboarding failed: ${lastError}`);
  // Stabilize: the dashboard's first-run guard can bounce back to
  // /onboarding on a stale org list right after submit. A fresh load reads
  // server state (the org now exists) and lands correctly.
  await page.goto("/dashboard");
  await expect(page).not.toHaveURL(/onboarding/, { timeout: 30_000 });
}
