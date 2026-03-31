import { test, expect } from "@playwright/test";

test.describe("Mobile Weekly Roster", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tumbleweed/");
    await expect(page.locator("text=Tumbleweed").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows schedule mode toggle in mobile settings", async ({ page }) => {
    await expect(page.getByText("Schedule Mode")).toBeVisible();
    const scheduleSection = page.locator("text=Schedule Mode").locator("..");
    await expect(
      scheduleSection.getByRole("button", { name: "24H" })
    ).toBeVisible();
    await expect(
      scheduleSection.getByRole("button", { name: "7D" })
    ).toBeVisible();
  });

  test("can switch to 7D mode and see date picker", async ({ page }) => {
    const scheduleSection = page.locator("text=Schedule Mode").locator("..");
    await scheduleSection.getByRole("button", { name: "7D" }).click();

    // Date picker should appear
    await expect(page.getByText("Starting date")).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test("staff preserved when switching 24H to 7D in mobile", async ({
    page,
  }) => {
    // Switch to 7D in settings (already on settings tab)
    const scheduleSection = page.locator("text=Schedule Mode").locator("..");
    await scheduleSection.getByRole("button", { name: "7D" }).click();

    // Navigate to staff tab via bottom tab bar
    await page.locator("text=Staff").last().click();
    await page.waitForTimeout(500);

    // Staff should still be there (not empty state)
    await expect(page.getByText("No staff yet")).not.toBeVisible();
  });

  test("can switch back from 7D to 24H in mobile", async ({ page }) => {
    const scheduleSection = page.locator("text=Schedule Mode").locator("..");

    // Switch to 7D first
    await scheduleSection.getByRole("button", { name: "7D" }).click();
    await expect(page.getByText("Starting date")).toBeVisible();

    // Switch back to 24H
    await scheduleSection.getByRole("button", { name: "24H" }).click();

    // Date picker should disappear
    await expect(page.getByText("Starting date")).not.toBeVisible();
  });
});
