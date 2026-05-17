import { test, expect } from "@playwright/test";
import {
  STAFF_ROW,
  installInitScript,
  waitForApp,
  clickStaffRow,
} from "./helpers";

// Re-authored:
//   - "Enter edit mode" toggle / per-row checkboxes are gone — Add user is
//     always available on StaffSectionHeader, row clicks select directly.
//   - Schedule Mode 24H / 7D toggle still lives in the shift-adjustment
//     dialog; that part of the test is unchanged.

test.beforeEach(async ({ page }) => {
  await installInitScript(page);
});

test.describe("Weekly Roster Mode", () => {
  test("shows schedule mode toggle in shift adjustment dialog", async ({
    page,
  }) => {
    await waitForApp(page);
    await page
      .getByRole("button", { name: /Show shift configuration/i })
      .click();

    await expect(page.getByText(/Schedule Mode/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^24H$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^7D$/ })).toBeVisible();
  });

  test("can switch from 24H to 7D mode", async ({ page }) => {
    await waitForApp(page);
    await page
      .getByRole("button", { name: /Show shift configuration/i })
      .click();

    await page.getByRole("button", { name: /^7D$/ }).click();

    // Switching to 7D reveals the date input.
    await expect(page.locator('input[type="date"]')).toBeVisible();

    await page
      .getByRole("button", { name: /Hide shift configuration/i })
      .click();

    await expect(page.getByRole("tablist")).toBeVisible();
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(7);
  });

  test("day tab strip shows 7 days and allows navigation", async ({ page }) => {
    await waitForApp(page);
    await page
      .getByRole("button", { name: /Show shift configuration/i })
      .click();
    await page.getByRole("button", { name: /^7D$/ })
      .click();
    await page
      .getByRole("button", { name: /Hide shift configuration/i })
      .click();

    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(7);

    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");
  });

  test("can switch from 7D back to 24H mode", async ({ page }) => {
    await waitForApp(page);
    await page
      .getByRole("button", { name: /Show shift configuration/i })
      .click();
    await page.getByRole("button", { name: /^7D$/ })
      .click();
    await expect(page.getByRole("tablist")).toBeVisible();

    await page.getByRole("button", { name: /^24H$/ })
      .click();
    await expect(page.locator('input[type="date"]')).not.toBeVisible();
  });

  test("staff members are preserved when switching modes", async ({ page }) => {
    await waitForApp(page);
    const initial = await page.locator(STAFF_ROW).count();
    expect(initial).toBeGreaterThan(0);

    await page
      .getByRole("button", { name: /Show shift configuration/i })
      .click();
    await page.getByRole("button", { name: /^7D$/ })
      .click();

    await expect(page.locator(STAFF_ROW)).toHaveCount(initial);

    await page.getByRole("button", { name: /^24H$/ })
      .click();

    await expect(page.locator(STAFF_ROW)).toHaveCount(initial);
  });

  test("staff added in 24H mode are preserved when switching to 7D", async ({
    page,
  }) => {
    await waitForApp(page);
    const initial = await page.locator(STAFF_ROW).count();

    await page.getByRole("button", { name: /^Add$/i }).first().click();
    await expect(page.locator(STAFF_ROW)).toHaveCount(initial + 1);

    await page
      .getByRole("button", { name: /Show shift configuration/i })
      .click();
    await page.getByRole("button", { name: /^7D$/ })
      .click();

    await expect(page.locator(STAFF_ROW)).toHaveCount(initial + 1);
  });

  test("info bar shows shifts/day in 7D mode", async ({ page }) => {
    await waitForApp(page);
    await page
      .getByRole("button", { name: /Show shift configuration/i })
      .click();
    await page.getByRole("button", { name: /^7D$/ })
      .click();
    await page
      .getByRole("button", { name: /Hide shift configuration/i })
      .click();

    await expect(page.locator("text=shifts/day").first()).toBeVisible();
  });

  test("day tabs remain visible when selecting a staff member", async ({
    page,
  }) => {
    await waitForApp(page);
    await page
      .getByRole("button", { name: /Show shift configuration/i })
      .click();
    await page.getByRole("button", { name: /^7D$/ })
      .click();
    await page
      .getByRole("button", { name: /Close shift configuration/i })
      .click();

    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(7);

    await clickStaffRow(page, 0);

    await expect(tabs.first()).toBeVisible();
  });

  test("adding multiple users works without breaking interactions", async ({
    page,
  }) => {
    await waitForApp(page);

    const addUser = page.getByRole("button", { name: /^Add$/i }).first();
    await addUser.click();
    await addUser.click();
    await addUser.click();

    const staffMembers = page.locator(STAFF_ROW);
    expect(await staffMembers.count()).toBeGreaterThan(0);

    await staffMembers.first().click({ position: { x: 4, y: 4 } });

    // Sanity that page still works after multiple adds + a click.
    await expect(staffMembers.first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Schedule$/ })
    ).toBeVisible();
  });
});
