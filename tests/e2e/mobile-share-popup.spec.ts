import { test, expect, Page } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const t = require("../../src/locales/he.json");

async function dismissDrivePrompt(page: Page) {
  const notNowButton = page.getByRole("button", { name: /לא עכשיו|Not now/i });
  await notNowButton.click({ timeout: 10000 }).catch(() => {});
}

async function setupMobileWithAssignments(page: Page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/tumbleweed/");
  await dismissDrivePrompt(page);

  await expect(page.locator("h1").first()).toBeVisible({ timeout: 10000 });

  // Go to staff tab using bottom nav
  const bottomNav = page.locator("nav, [role='tablist']");
  const staffNavItem = bottomNav.locator(`text=${t.staff}`).first();
  if (await staffNavItem.isVisible().catch(() => false)) {
    await staffNavItem.click();
  }

  await expect(page.getByRole("heading", { name: t.staff })).toBeVisible({ timeout: 5000 });

  // Add 3 staff via FAB
  const addFab = page.locator("button.fixed").filter({ has: page.locator("svg") });
  for (let i = 0; i < 3; i++) {
    await addFab.click();
    await page.waitForTimeout(200);
  }

  // Navigate to assignments tab
  const assignmentsNavItem = bottomNav.locator(`text=${t.assignments}`).first();
  if (await assignmentsNavItem.isVisible().catch(() => false)) {
    await assignmentsNavItem.click();
  }
  await expect(page.getByRole("heading", { name: t.assignments })).toBeVisible({ timeout: 5000 });

  // Run optimization via FAB
  const optimizeFab = page.locator("button.fixed.rounded-full");
  await optimizeFab.click();
  await expect(
    page.getByText(t.noAssignmentsYet)
  ).not.toBeVisible({ timeout: 30000 });
}

async function openSharePopup(page: Page) {
  const shareBtn = page.locator(`button[title="${t.shareSchedule}"]`);
  await expect(shareBtn).toBeVisible();
  await shareBtn.click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
}

test.describe("Mobile Share Popup", () => {
  test("opens share dialog and shows all controls", async ({ page }) => {
    await setupMobileWithAssignments(page);
    await openSharePopup(page);

    const dialog = page.locator('[role="dialog"]');

    await expect(dialog.getByText(t.fullRoster, { exact: true })).toBeVisible();
    await expect(dialog.getByText(t.staffMember, { exact: true })).toBeVisible();

    await expect(dialog.getByText(t.downloadPdf)).toBeVisible();
    await expect(dialog.getByText(t.print, { exact: true })).toBeVisible();
    await expect(dialog.getByText(t.whatsapp)).toBeVisible();
  });

  test("can switch to staff member view and see staff list", async ({ page }) => {
    await setupMobileWithAssignments(page);
    await openSharePopup(page);

    const dialog = page.locator('[role="dialog"]');
    await dialog.getByText(t.staffMember, { exact: true }).click();

    const staffList = dialog.locator(".max-h-\\[160px\\]");
    await expect(staffList).toBeVisible();

    const staffButtons = staffList.locator("button");
    const count = await staffButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("download PDF works on mobile", async ({ page }) => {
    await setupMobileWithAssignments(page);
    await openSharePopup(page);

    const dialog = page.locator('[role="dialog"]');
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await dialog.getByText(t.downloadPdf).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
