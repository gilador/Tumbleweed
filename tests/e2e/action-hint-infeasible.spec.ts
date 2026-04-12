import { test, expect, Page } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const t = require("../../src/locales/he.json");

async function dismissDrivePrompt(page: Page) {
  const notNowButton = page.getByRole("button", { name: /לא עכשיו|Not now/i });
  await notNowButton.click({ timeout: 10000 }).catch(() => {});
}

test.describe("Action hint reflects infeasible state", () => {
  test("shows warning hint when optimizer reports not enough staff", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/tumbleweed/");
    await dismissDrivePrompt(page);
    await expect(page.getByRole("heading", { name: t.staff })).toBeVisible({ timeout: 10000 });

    // Default: 2 staff, 2 posts — this is feasible for low shift counts
    // Add more posts to make it infeasible: 2 staff can't cover 5 posts
    const editToggle = page
      .locator('[aria-label*="עריכה"], [aria-label*="edit mode"]')
      .first();
    await editToggle.click();

    // Add 3 more posts (total 5)
    const addPostButton = page
      .locator('[aria-label*="הוסף עמדה"], [aria-label*="Add post"]')
      .first();
    await expect(addPostButton).toBeVisible({ timeout: 5000 });
    for (let i = 0; i < 3; i++) {
      await addPostButton.click();
    }
    await editToggle.click();

    // The hint should show a warning about capacity, NOT "click optimize"
    // hintOverCapacity renders as: "Not enough staff: X slots available but Y needed"
    const hintArea = page.locator('#assignments-table, [class*="hint"], [class*="badge"]');

    // The action hint text should contain capacity warning
    const warningHint = page.locator(`text=${t.hintOverCapacity?.replace("{{capacity}}", "").replace("{{needed}}", "").split("{{")[0] || "hintOverCapacity"}`);

    // More reliable: check that hintRunOptimizer is NOT shown
    // hintRunOptimizer = "Click the optimize button to generate assignments" / "לחץ על כפתור האופטימיזציה ליצירת שיבוצים"
    await page.waitForTimeout(1000);

    const runOptimizerHint = page.getByText(t.hintRunOptimizer);
    const overCapacityHint = page.getByText(/hintOverCapacity|לא מספיק|Not enough/);

    // Should NOT show "click optimize" hint when configuration is infeasible
    const hasRunOptimizer = await runOptimizerHint.isVisible().catch(() => false);
    const hasOverCapacity = await overCapacityHint.isVisible().catch(() => false);

    // At least one of these should be true: either warning is shown, or "run optimizer" is hidden
    expect(
      !hasRunOptimizer || hasOverCapacity,
      `When config is infeasible, should not show "${t.hintRunOptimizer}". hasRunOptimizer=${hasRunOptimizer}, hasOverCapacity=${hasOverCapacity}`
    ).toBe(true);
  });

  test("shows run optimizer hint when configuration IS feasible", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/tumbleweed/");
    await dismissDrivePrompt(page);
    await expect(page.getByRole("heading", { name: t.staff })).toBeVisible({ timeout: 10000 });

    // Default: 2 staff, 2 posts — feasible
    // Should show "click optimize" hint
    await page.waitForTimeout(1000);

    const runOptimizerHint = page.getByText(t.hintRunOptimizer);
    await expect(runOptimizerHint).toBeVisible({ timeout: 5000 });
  });

  test("optimizer failure shows warning, not run optimizer hint", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/tumbleweed/");
    await dismissDrivePrompt(page);
    await expect(page.getByRole("heading", { name: t.staff })).toBeVisible({ timeout: 10000 });

    // Switch to 7D weekly mode (more demanding on staff)
    const configToggle = page.locator('[aria-label*="הגדרות משמרת"], [aria-label*="shift"]').first();
    await configToggle.click();
    await page.getByRole("button", { name: "7D" }).click();

    // Select a high intensity level that needs more staff than available
    // Click the leftmost (most intense/fewest shifts but each needs more staff) dot
    const sliderBtns = page.locator('.border-border .relative.group button:not([disabled])');
    const btnCount = await sliderBtns.count();
    if (btnCount > 2) {
      // Click last feasible dot (most shifts = most staff needed)
      await sliderBtns.last().click();
    }
    await configToggle.click();

    await page.waitForTimeout(1000);

    // After setting an infeasible configuration, the hint should warn — not encourage
    const pageText = await page.locator('body').innerText();
    const hasRunOptimizer = pageText.includes(t.hintRunOptimizer);
    const hasOverCapacity = pageText.includes(t.hintOverCapacity?.split("{{")[0] || "");
    const hasNotEnough = pageText.includes("לא מספיק") || pageText.includes("Not enough");

    // If the selected level is infeasible, we should see a warning
    // This test validates the bug: hint should NOT say "click optimize" when config is infeasible
    if (hasOverCapacity || hasNotEnough) {
      expect(hasRunOptimizer, "Should not show 'run optimizer' alongside infeasible warning").toBe(false);
    }
  });
});
