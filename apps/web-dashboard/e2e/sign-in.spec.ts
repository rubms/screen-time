import { test, expect } from "@playwright/test";

test("sign-in page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("sign-in fits narrow viewport", async ({ page }) => {
    await page.goto("/");
    const box = await page.getByRole("button", { name: /sign in with google/i }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(375);
  });
});
