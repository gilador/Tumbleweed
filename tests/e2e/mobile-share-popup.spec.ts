import { test, expect, devices, Page } from "@playwright/test";
import { installInitScript, waitForMobileApp } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// SharePopup trigger has title="Share Schedule" (en). Dialog body contains
// Full Roster / Staff Member toggle, Download PDF / Print / WhatsApp options.

async function setupMobileWithAssignments(page: Page) {
  await waitForMobileApp(page);

  // Navigate to staff and add 3 staff via FAB.
  await page.getByRole("navigation").getByRole("button", { name: "Staff" }).click();
  await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();

  const addFab = page.locator("button.fixed").filter({ has: page.locator("svg") });
  for (let i = 0; i < 3; i++) {
    await addFab.click();
    await page.waitForTimeout(150);
  }

  // Navigate to assignments.
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Assignments" })
    .click();
  await expect(
    page.getByRole("heading", { name: /^Assignments$/ })
  ).toBeVisible();

  // Run optimization.
  const fab = page.locator("button.fixed.rounded-full");
  await fab.click();
  await expect(page.getByText("No assignments yet")).not.toBeVisible({
    timeout: 30000,
  });
}

async function openSharePopup(page: Page) {
  const shareBtn = page.locator('button[title="Share Schedule"]');
  await expect(shareBtn).toBeVisible();
  await shareBtn.click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
}

test.describe("Mobile Share Popup", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
  });

  test("opens share dialog and shows all controls", async ({ page }) => {
    await setupMobileWithAssignments(page);
    await openSharePopup(page);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.getByText("Full Roster", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Staff Member", { exact: true })).toBeVisible();

    await expect(dialog.getByText("Download PDF")).toBeVisible();
    await expect(dialog.getByText("Print", { exact: true })).toBeVisible();
    await expect(dialog.getByText("WhatsApp")).toBeVisible();
  });

  test("can switch to staff member view and see staff list", async ({ page }) => {
    await setupMobileWithAssignments(page);
    await openSharePopup(page);

    const dialog = page.locator('[role="dialog"]');
    await dialog.getByText("Staff Member", { exact: true }).click();

    const staffList = dialog.locator(".max-h-\\[160px\\]");
    await expect(staffList).toBeVisible();

    const staffButtons = staffList.locator("button");
    expect(await staffButtons.count()).toBeGreaterThan(0);
  });

  test("download PDF works on mobile", async ({ page }) => {
    await setupMobileWithAssignments(page);
    await openSharePopup(page);

    const dialog = page.locator('[role="dialog"]');
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await dialog.getByText("Download PDF").click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
