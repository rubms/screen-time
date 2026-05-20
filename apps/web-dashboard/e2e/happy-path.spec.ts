import { test, expect } from "@playwright/test";

/**
 * Full happy-path against Firebase emulators requires `firebase emulators:start`
 * and `VITE_USE_EMULATORS=true`. This smoke test verifies the app shell loads.
 */
test("app shell loads without auth", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
});
