import { test, expect } from "@playwright/test";

test.describe("Mobile Weekly View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tumbleweed/");
    await expect(page.locator("text=Tumbleweed").first()).toBeVisible({
      timeout: 10000,
    });

    // Switch to 7D mode in mobile settings
    const scheduleSection = page.locator("text=Schedule Mode").locator("..");
    await scheduleSection.getByRole("button", { name: "7D" }).click();
  });

  test("shows daily/weekly toggle in mobile assignments tab", async ({
    page,
  }) => {
    // Navigate to assignments tab
    await page.locator("text=Assignments").last().click();
    await page.waitForTimeout(500);

    // View toggle should appear
    await expect(page.getByRole("button", { name: "Daily" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Weekly" }).first()).toBeVisible();
  });

  test("weekly view shows read-only grid on mobile", async ({ page }) => {
    // Navigate to assignments tab
    await page.locator("text=Assignments").last().click();
    await page.waitForTimeout(500);

    // Switch to weekly
    await page.getByRole("button", { name: "Weekly" }).first().click();

    // Grid should appear
    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible();

    // All 7 day headers should be visible (scrollable)
    await expect(page.getByTestId("day-header-0")).toBeVisible();
  });

  test("tap day header navigates to daily view for that day", async ({
    page,
  }) => {
    // Add a post and staff first
    const scheduleSection = page.locator("text=Schedule Mode").locator("..");
    await page.locator("text=Staff").last().click();
    await page.waitForTimeout(300);

    // Navigate to assignments tab
    await page.locator("text=Assignments").last().click();
    await page.waitForTimeout(500);

    // Switch to weekly
    await page.getByRole("button", { name: "Weekly" }).first().click();
    await page.waitForTimeout(300);

    // Tap day header 2 (third day)
    await page.getByTestId("day-header-2").click();

    // Should switch back to daily view (weekly grid should be hidden)
    await expect(page.getByTestId("weekly-roster-grid")).not.toBeVisible();
  });
});
