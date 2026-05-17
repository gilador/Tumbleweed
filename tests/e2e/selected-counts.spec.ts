import { test, expect } from "@playwright/test";
import {
  STAFF_ROW,
  installInitScript,
  waitForApp,
  clickStaffRow,
  postNameLocators,
  clickPostRow,
  bulkRegion,
} from "./helpers";

// Re-authored: legacy "Staff (n)" / "Staff (n, k selected)" heading copy is
// gone. Selection state lives on BulkSelectionBar which renders
// `^N selected$` text and exposes a region with the same aria-label.

test.beforeEach(async ({ page }) => {
  await installInitScript(page);
});

test.describe("Selected Items Count Display", () => {
  test("shows selected staff count when more than 1 staff member is selected", async ({
    page,
  }) => {
    await waitForApp(page);

    const rows = page.locator(STAFF_ROW);
    const total = await rows.count();
    test.skip(total < 3, "need at least 3 staff rows");

    // Initially, no bulk bar.
    await expect(page.getByText(/^\d+ selected$/)).toHaveCount(0);

    // Click 1st row → enters single-select mode (no bulk bar yet).
    await clickStaffRow(page, 0);

    // Click 2nd → upgrades to multi mode with 2 selected.
    await clickStaffRow(page, 1);
    await expect(page.getByText(/^2 selected$/).first()).toBeVisible();

    // Click 3rd → 3 selected.
    await clickStaffRow(page, 2);
    await expect(page.getByText(/^3 selected$/).first()).toBeVisible();

    // Toggle 3rd off → back to 2.
    await clickStaffRow(page, 2);
    await expect(page.getByText(/^2 selected$/).first()).toBeVisible();

    // Toggle 2nd off → 1 selected (still in multi mode).
    await clickStaffRow(page, 1);
    await expect(page.getByText(/^1 selected$/).first()).toBeVisible();

    // Cancel selection — bulk bar disappears.
    await page.getByRole("button", { name: /Cancel selection/i }).first().click();
    await expect(page.getByText(/^\d+ selected$/)).toHaveCount(0);
  });

  test("shows selected posts count when more than 1 post is selected", async ({
    page,
  }) => {
    await waitForApp(page);

    const posts = postNameLocators(page);
    const postCount = await posts.count();
    test.skip(postCount < 2, "need at least 2 posts to multi-select");

    // No bulk bar initially.
    await expect(page.getByText(/^\d+ selected$/)).toHaveCount(0);

    await clickPostRow(page, 0);
    await expect(page.getByText(/^1 selected$/).first()).toBeVisible();

    await clickPostRow(page, 1);
    await expect(page.getByText(/^2 selected$/).first()).toBeVisible();

    if (postCount >= 3) {
      await clickPostRow(page, 2);
      await expect(page.getByText(/^3 selected$/).first()).toBeVisible();

      await clickPostRow(page, 2);
      await expect(page.getByText(/^2 selected$/).first()).toBeVisible();
    }

    await clickPostRow(page, 1);
    await expect(page.getByText(/^1 selected$/).first()).toBeVisible();

    await clickPostRow(page, 0);
    await expect(page.getByText(/^\d+ selected$/)).toHaveCount(0);
  });

  test("Cancel button restores empty selection state", async ({ page }) => {
    await waitForApp(page);

    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 2, "need at least 2 staff rows");

    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);
    await expect(page.getByText(/^2 selected$/).first()).toBeVisible();

    await page.getByRole("button", { name: /Cancel selection/i }).first().click();
    await expect(page.getByText(/^\d+ selected$/)).toHaveCount(0);

    // Multi-select can be re-entered with two clicks.
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);
    await expect(page.getByText(/^2 selected$/).first()).toBeVisible();
  });

  test("select all functionality updates the selected count correctly", async ({
    page,
  }) => {
    await waitForApp(page);

    const totalStaff = await page.locator(STAFF_ROW).count();
    test.skip(totalStaff < 2, "need at least 2 staff rows");

    // Enter multi-select first by clicking two rows (single→multi upgrade),
    // then use Select all toggle.
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);
    const region = bulkRegion(page);
    await expect(region).toBeVisible();

    if ((await region.getByRole("button", { name: /^Select all$/i }).count()) > 0) {
      await region.getByRole("button", { name: /^Select all$/i }).click();
    }
    // After select-all the count badge equals total staff.
    await expect(
      page.getByText(new RegExp(`^${totalStaff} selected$`)).first()
    ).toBeVisible();
    // Toggle now reads "Deselect all users".
    await expect(
      region.getByRole("button", { name: /^Deselect all users$/i })
    ).toBeVisible();

    // Click again to deselect everyone.
    await region.getByRole("button", { name: /^Deselect all users$/i }).click();
    await expect(page.getByText(/^\d+ selected$/)).toHaveCount(0);
  });

  test("selected count format is correct", async ({ page }) => {
    await waitForApp(page);

    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 2, "need at least 2 staff rows");

    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);

    const region = bulkRegion(page);
    await expect(region).toBeVisible();

    // The region's aria-label is the selected count copy itself.
    const ariaLabel = await region.first().getAttribute("aria-label");
    expect(ariaLabel).toMatch(/^\d+ selected$/);

    // Visible count text inside the bar matches "2 selected".
    await expect(page.getByText(/^2 selected$/).first()).toBeVisible();
  });
});
