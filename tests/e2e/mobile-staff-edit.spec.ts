import { test, expect, devices, Page } from "@playwright/test";
import { installInitScript, waitForMobileApp } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// Group C — Mobile staff name editing. Rename is a STAFF LIST affordance,
// not part of the drill-down (architect plan: list-level pencil per row).
// StaffTab.tsx renders an `[data-testid="edit-staff-${userId}"]` pencil
// button per row; tapping it opens an inline input
// `[data-testid="edit-staff-name-input"]` with current name pre-filled.

const navigateToStaff = async (page: Page) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Staff" })
    .click();
  await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();
};

test.describe("Mobile Staff Name Editing", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
    await waitForMobileApp(page);
    await navigateToStaff(page);
  });

  test("shows pencil edit icon next to each staff member", async ({ page }) => {
    const pencils = page.locator('[data-testid^="edit-staff-"]');
    const rows = page.locator(".rounded-lg.border");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    expect(await pencils.count()).toBe(rowCount);
  });

  test("clicking pencil opens inline edit with current name", async ({
    page,
  }) => {
    const firstRow = page.locator(".rounded-lg.border").first();
    const originalName = (
      await firstRow.locator("button.flex-1 span").first().textContent()
    )?.trim();
    expect(originalName).toBeTruthy();

    await firstRow.locator('[data-testid^="edit-staff-"]').click();
    const input = page.locator('[data-testid="edit-staff-name-input"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue(originalName!);
  });

  test("can edit staff name and save with check button", async ({ page }) => {
    const firstRow = page.locator(".rounded-lg.border").first();
    await firstRow.locator('[data-testid^="edit-staff-"]').click();
    const input = page.locator('[data-testid="edit-staff-name-input"]');
    await input.fill("RenamedAlpha");
    // Save button is the first non-input button next to the input (check icon).
    await firstRow.locator("button").first().click();
    await expect(input).toHaveCount(0);
    await expect(firstRow.getByText("RenamedAlpha")).toBeVisible();
  });

  test("pressing Escape cancels edit without saving", async ({ page }) => {
    const firstRow = page.locator(".rounded-lg.border").first();
    const originalName = (
      await firstRow.locator("button.flex-1 span").first().textContent()
    )?.trim();
    expect(originalName).toBeTruthy();

    await firstRow.locator('[data-testid^="edit-staff-"]').click();
    const input = page.locator('[data-testid="edit-staff-name-input"]');
    await input.fill("ShouldNotPersist");
    await input.press("Escape");
    await expect(input).toHaveCount(0);
    await expect(firstRow.getByText(originalName!)).toBeVisible();
    await expect(firstRow.getByText("ShouldNotPersist")).toHaveCount(0);
  });

  test("pressing Enter saves the edit", async ({ page }) => {
    const firstRow = page.locator(".rounded-lg.border").first();
    await firstRow.locator('[data-testid^="edit-staff-"]').click();
    const input = page.locator('[data-testid="edit-staff-name-input"]');
    await input.fill("EnterSaved");
    await input.press("Enter");
    await expect(input).toHaveCount(0);
    await expect(firstRow.getByText("EnterSaved")).toBeVisible();
  });
});
