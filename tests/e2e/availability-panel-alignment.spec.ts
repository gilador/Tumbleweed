import { test, expect, Page } from "@playwright/test";
import {
  STAFF_ROW,
  clickStaffRow,
  installInitScript,
  waitForApp,
} from "./helpers";

// Hebrew variant: forces tumbleweed-lang=he so the app boots in RTL.
async function installHebrewInitScript(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem("tumbleweed-lang", "he");
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    } catch {
      /* ignore */
    }
  });
}

const HEATMAP = '[data-testid="availability-heatmap"]';
// Tolerance widened from 1px to 2px to absorb sub-pixel layout rounding at
// CI device pixel ratios. Pre-fix gap is 8px, so this still fails cleanly
// without the pt-2 alignment shim on the heatmap wrapper.
const TOLERANCE_PX = 2;

async function ensureStaff(page: Page) {
  if ((await page.locator(STAFF_ROW).count()) === 0) {
    await page.getByRole("button", { name: /^Add$/i }).first().click();
    await expect(page.locator(STAFF_ROW).first()).toBeVisible();
  }
}

async function assertTopAlignment(page: Page) {
  const firstCard = page.locator(STAFF_ROW).first();
  const heatmap = page.locator(HEATMAP);
  await expect(firstCard).toBeVisible();
  await expect(heatmap).toBeVisible();
  const cardBox = await firstCard.boundingBox();
  const heatmapBox = await heatmap.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(heatmapBox).not.toBeNull();
  const delta = Math.abs(cardBox!.y - heatmapBox!.y);
  expect(delta).toBeLessThanOrEqual(TOLERANCE_PX);
}

test.describe("Availability panel top alignment", () => {
  test("first worker card top aligns with availability panel top (LTR)", async ({
    page,
  }) => {
    await installInitScript(page);
    await waitForApp(page);
    await ensureStaff(page);
    await assertTopAlignment(page);
  });

  test("alignment holds in RTL (Hebrew)", async ({ page }) => {
    await installHebrewInitScript(page);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
    await ensureStaff(page);
    await assertTopAlignment(page);
  });

  test("alignment holds with a staff selected (LTR heatmap + actions)", async ({
    page,
  }) => {
    await installInitScript(page);
    await waitForApp(page);
    await ensureStaff(page);
    await clickStaffRow(page, 0);
    // Heatmap sub-view is the default after picking a staff.
    await assertTopAlignment(page);
    // Flip to Actions sub-view and re-assert.
    await page.getByRole("button", { name: /^Actions$/ }).click();
    await assertTopAlignment(page);
  });

  test("alignment holds with a staff selected (RTL heatmap + actions)", async ({
    page,
  }) => {
    await installHebrewInitScript(page);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
    await ensureStaff(page);
    await clickStaffRow(page, 0);
    await assertTopAlignment(page);
    // he.json:111 → "actionsToggle": "פעולות"
    await page.getByRole("button", { name: /^פעולות$/ }).click();
    await assertTopAlignment(page);
  });
});
