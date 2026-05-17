import { test, expect } from "@playwright/test";
import {
  STAFF_ROW,
  installInitScript,
  waitForApp,
  clickStaffRow,
  postNameLocators,
  bulkRegion,
} from "./helpers";

// Re-authored: legacy "Staff (n)" / "Shift Assignments (n)" headings are
// gone. Counts are now shown as "{n} staff" and "{n} positions" microcopy
// next to the section headers, but the structural assertion the old test
// cared about — counts changing when you add/delete — is now best verified
// by counting `[data-testid="staff-member"]` rows and post-name cells in
// `#assignments-table` directly.

test.beforeEach(async ({ page }) => {
  await installInitScript(page);
});

test.describe("Title Counts Display", () => {
  test("staff and post counts increase when adding items", async ({ page }) => {
    await waitForApp(page);

    const initialStaffCount = await page.locator(STAFF_ROW).count();
    const initialPostsCount = await postNameLocators(page).count();
    expect(initialStaffCount).toBeGreaterThan(0);
    expect(initialPostsCount).toBeGreaterThan(0);

    // Microcopy reflects current counts.
    await expect(
      page.getByText(new RegExp(`^${initialStaffCount} staff$`))
    ).toBeVisible();

    // Add a user.
    await page.getByRole("button", { name: /^Add$/i }).first().click();
    await expect(page.locator(STAFF_ROW)).toHaveCount(initialStaffCount + 1);
    await expect(
      page.getByText(new RegExp(`^${initialStaffCount + 1} staff$`))
    ).toBeVisible();

    // Add a position.
    await page.getByRole("button", { name: /^Add position$/i }).first().click();
    // PostHeadRow auto-focuses an input — commit a name then verify count.
    const grid = page.locator("#assignments-table");
    const editingInput = grid.locator("input").first();
    await expect(editingInput).toBeVisible({ timeout: 3000 });
    await editingInput.press("Enter");
    await expect(postNameLocators(page)).toHaveCount(initialPostsCount + 1);
  });

  test("counts decrease when deleting items via bulk delete", async ({
    page,
  }) => {
    await waitForApp(page);

    const initialStaffCount = await page.locator(STAFF_ROW).count();
    expect(initialStaffCount).toBeGreaterThan(1);

    // Multi-select 2 rows → toggle one off → bulk delete a single row.
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);
    const region = bulkRegion(page);
    await expect(region).toBeVisible();
    await clickStaffRow(page, 1);
    await expect(page.getByText(/^1 selected$/).first()).toBeVisible();

    // Click the trash button (its label is the count "1").
    await region.locator("button").filter({ hasText: "1" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^Yes, please!$/i }).click();

    await expect(page.locator(STAFF_ROW)).toHaveCount(initialStaffCount - 1);
    await expect(
      page.getByText(new RegExp(`^${initialStaffCount - 1} staff$`))
    ).toBeVisible();
  });

  test("counts are displayed in correct format", async ({ page }) => {
    await waitForApp(page);

    // The redesign uses microcopy "{n} staff" and "{n} positions" rather than
    // headings of the form "Staff (n)".
    const staffCount = await page.locator(STAFF_ROW).count();
    const postsCount = await postNameLocators(page).count();
    expect(staffCount).toBeGreaterThanOrEqual(0);
    expect(postsCount).toBeGreaterThanOrEqual(0);

    await expect(
      page.getByText(new RegExp(`^${staffCount} staff$`))
    ).toBeVisible();
    await expect(
      page.getByText(new RegExp(`^${postsCount} positions?$`))
    ).toBeVisible();
  });

  test("counts remain accurate after multiple operations", async ({ page }) => {
    await waitForApp(page);

    const initialStaffCount = await page.locator(STAFF_ROW).count();
    const initialPostsCount = await postNameLocators(page).count();

    const addUser = page.getByRole("button", { name: /^Add$/i }).first();
    await addUser.click();
    await addUser.click();
    await expect(page.locator(STAFF_ROW)).toHaveCount(initialStaffCount + 2);

    const addPosition = page
      .getByRole("button", { name: /^Add position$/i })
      .first();
    await addPosition.click();
    const grid = page.locator("#assignments-table");
    const editingInput = grid.locator("input").first();
    await expect(editingInput).toBeVisible({ timeout: 3000 });
    await editingInput.press("Enter");

    await expect(postNameLocators(page)).toHaveCount(initialPostsCount + 1);
  });
});
