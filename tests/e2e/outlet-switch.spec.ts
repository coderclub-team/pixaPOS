import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndVerify, testUser } from "./fixtures/auth";

test.describe("outlet switch", () => {
  test("header switch changes terminal outlet", async ({ page }) => {
    const user = testUser("switch");
    await signUpAndVerify(page, user);
    const stamp = Date.now().toString(36);
    await completeOnboarding(page, { business: `Switch Bhavan ${stamp}`, outlet: "Outlet One" });
    await page.goto("/dashboard/overview");
    await expect(page.locator("#outlet-selector")).toBeVisible({ timeout: 60_000 });

    const before = await page.evaluate(() => window.localStorage.getItem("pixa:activeOutlet"));
    expect(before).toBeTruthy();

    // Second outlet via API in the same session.
    const created = await page.evaluate(async () => {
      const res = await fetch("/api/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: "Outlet Two", code: `OTWO${Date.now().toString(36)}` }),
      });
      const data = (await res.json()) as { outlet?: { id: string } };
      return { status: res.status, id: data.outlet?.id ?? null };
    });
    expect(created.status).toBe(201);

    await page.goto("/dashboard/overview");
    await page.locator("#outlet-selector").click();
    await page.getByRole("option", { name: /Outlet Two/ }).click();

    await expect
      .poll(async () => page.evaluate(() => window.localStorage.getItem("pixa:activeOutlet")), {
        timeout: 30_000,
      })
      .toBe(created.id);
    const trigger = await page.locator("#outlet-selector").innerText();
    expect(trigger).not.toContain("—");
  });
});
