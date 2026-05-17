import { test, expect, Page } from "@playwright/test";
import { installInitScript, waitForApp } from "./helpers";

// Desktop: the schedule-mode toggle (24H / 7D) lives inside the
// ShiftInfoSettingsView panel, which opens via the "Show shift configuration"
// button (renamed from "Show shift adjustment"). Once the user has selected
// 7D the panel can be closed via "Close shift configuration"; the
// Daily/Weekly toggle and weekly-roster grid then become available in the
// assignments header.

async function switchToSevenD(page: Page) {
  await page.getByRole("button", { name: /Show shift configuration/i }).click();

  const panel = page.locator(".rounded-lg.border-2");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: /^7D$/ }).click();

  // Close the panel.
  await page
    .getByRole("button", { name: /Close shift configuration/i })
    .click();
  await expect(panel).not.toBeVisible();
}

test.describe("Weekly View Toggle (Desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
    await waitForApp(page);
    await switchToSevenD(page);
  });

  test("shows daily/weekly toggle in 7D mode", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^Daily$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Weekly$/ })).toBeVisible();
  });

  test("defaults to daily view", async ({ page }) => {
    const dailyBtn = page.getByRole("button", { name: /^Daily$/ });
    await expect(dailyBtn).toBeVisible();
    await expect(page.getByRole("tablist")).toBeVisible();
  });

  test("switch to weekly view shows grid with all days", async ({ page }) => {
    await page.getByRole("button", { name: /^Weekly$/ }).click();

    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible();

    for (let i = 0; i < 7; i++) {
      await expect(page.getByTestId(`day-header-${i}`)).toBeVisible();
    }

    await expect(page.getByRole("tablist")).not.toBeVisible();
  });

  test("switch back to daily view hides weekly grid", async ({ page }) => {
    await page.getByRole("button", { name: /^Weekly$/ }).click();
    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible();

    await page.getByRole("button", { name: /^Daily$/ }).click();

    await expect(page.getByTestId("weekly-roster-grid")).not.toBeVisible();
    await expect(page.getByRole("tablist")).toBeVisible();
  });

  test("click assignment cell in weekly view opens reassignment dropdown", async ({
    page,
  }) => {
    // Add a post and a staff member.
    await page.getByRole("button", { name: /^Add position$/i }).first().click();
    // Commit the new post name (PostHeadRow renders inline-edit input).
    const grid = page.locator("#assignments-table");
    const editingInput = grid.locator("input").first();
    if (await editingInput.isVisible().catch(() => false)) {
      await editingInput.press("Enter");
    }
    await page.getByRole("button", { name: /^Add$/i }).first().click();

    await page.getByRole("button", { name: /^Weekly$/ }).click();

    const cell = page.getByTestId("cell-0-0");
    await cell.click();

    await expect(page.locator(".absolute.z-30")).toBeVisible();
  });
});
