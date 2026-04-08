import { test, expect } from "@playwright/test";

test.describe("Weekly View Toggle (Desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();

    // Switch to 7D mode
    await page
      .getByRole("button", { name: "Show shift adjustment" })
      .click();
    await page
      .locator("text=Schedule Mode")
      .locator("..")
      .getByRole("button", { name: "7D" })
      .click();
    await page
      .getByRole("button", { name: "Hide shift adjustment" })
      .click();
  });

  test("shows daily/weekly toggle in 7D mode", async ({ page }) => {
    // View toggle should appear in the assignments header
    await expect(page.getByRole("button", { name: "Daily" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Weekly" })).toBeVisible();
  });

  test("defaults to daily view", async ({ page }) => {
    // Daily button should be active (has primary styling)
    const dailyBtn = page.getByRole("button", { name: "Daily" });
    await expect(dailyBtn).toBeVisible();

    // Day tab strip should be visible (daily mode shows tabs)
    await expect(page.getByRole("tablist")).toBeVisible();
  });

  test("switch to weekly view shows grid with all days", async ({ page }) => {
    // Click weekly toggle
    await page.getByRole("button", { name: "Weekly" }).click();

    // Weekly roster grid should appear
    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible();

    // Should have 7 day headers
    for (let i = 0; i < 7; i++) {
      await expect(page.getByTestId(`day-header-${i}`)).toBeVisible();
    }

    // Day tab strip should be hidden
    await expect(page.getByRole("tablist")).not.toBeVisible();
  });

  test("switch back to daily view hides weekly grid", async ({ page }) => {
    // Switch to weekly
    await page.getByRole("button", { name: "Weekly" }).click();
    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible();

    // Switch back to daily
    await page.getByRole("button", { name: "Daily" }).click();

    // Weekly grid should be hidden, day tabs visible
    await expect(page.getByTestId("weekly-roster-grid")).not.toBeVisible();
    await expect(page.getByRole("tablist")).toBeVisible();
  });

  test("click assignment cell in weekly view opens reassignment dropdown", async ({
    page,
  }) => {
    // Add a post and staff member first
    await page.getByRole("button", { name: "Add Post" }).click();
    await page.getByRole("button", { name: "Add user" }).click();

    // Switch to weekly view
    await page.getByRole("button", { name: "Weekly" }).click();

    // Click a cell
    const cell = page.getByTestId("cell-0-0");
    await cell.click();

    // Reassignment dropdown should appear
    await expect(page.locator(".absolute.z-30")).toBeVisible();
  });
});
