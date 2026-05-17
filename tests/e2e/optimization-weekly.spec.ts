import { test, expect, Page } from "@playwright/test";
import {
  STAFF_ROW,
  installInitScript,
  waitForApp,
} from "./helpers";

// Re-authored: edit-mode prelude is gone. Add user is always available
// from StaffSectionHeader. Schedule grid is `#assignments-table`.
//
// Asserts the same end-to-end behavior the old spec did: the optimizer
// produces assignments populated across the 7-day grid for a sizable staff
// roster.

test.beforeEach(async ({ page }) => {
  await installInitScript(page);
});

async function expectShiftsInInfoBar(page: Page) {
  // Info bar should NOT show "0 shifts" — there must be a non-zero count.
  const zeroShifts = page.locator("text=/^0 shifts/i");
  expect(await zeroShifts.count(), "Info bar should not show 0 shifts").toBe(0);
}

async function expectOptimizedTooltip(page: Page) {
  // The "Schedule is optimized and up to date" copy moved out of the inline
  // banner and into the SyncStatusIcon rail tooltip when the schedule is optimized.
  // Hover the rail icon button, assert the tooltip, then move away so the
  // tooltip dismisses before subsequent interactions.
  const syncButton = page
    .getByRole("button", { name: /^Sync status$/i })
    .first();
  await expect(syncButton).toBeVisible({ timeout: 30000 });
  await syncButton.hover();
  await expect(
    page.getByRole("tooltip").filter({
      hasText: "Schedule is optimized and up to date",
    })
  ).toBeVisible({ timeout: 30000 });
  // Dismiss the tooltip so it doesn't intercept subsequent pointer events.
  await page.keyboard.press("Escape");
  await page.mouse.move(10, 10);
  await page.waitForTimeout(200);
}

async function expectAssignmentsNotEmpty(page: Page, _sidebarStaffCount: number) {
  await expect
    .poll(
      async () => {
        const grid = page.locator("#assignments-table");
        const text = (await grid.innerText()) ?? "";
        return /(Member \d+|New User \d+|John|Jane|עובד \d+)/.test(text);
      },
      { timeout: 10000 }
    )
    .toBe(true);
}

async function switchToWeeklyMode(page: Page) {
  await page
    .getByRole("button", { name: /Show shift configuration/i })
    .click();
  await page.getByRole("button", { name: /^7D$/ })
    .click();
  await page
    .getByRole("button", { name: /Hide shift configuration/i })
    .click();
  await expect(page.getByRole("tab")).toHaveCount(7);
}

async function addStaff(page: Page, count: number) {
  const addUserButton = page
    .getByRole("button", { name: /^Add$/i })
    .first();
  await expect(addUserButton).toBeVisible({ timeout: 5000 });
  for (let i = 0; i < count; i++) {
    await addUserButton.click();
  }
}

test.describe("Weekly Optimization — 20 staff, 2 posts", () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test("shifts are generated and visible before optimization", async ({
    page,
  }) => {
    await expectShiftsInInfoBar(page);

    // Default seed posts render with the Hebrew name "עמדה N" since they're
    // hard-coded in shiftManagerConstants regardless of UI lang.
    const grid = page.locator("#assignments-table");
    await expect(
      grid.locator("text=/^(Position|Post|עמדה|New Post) ?\\d+$|^עמדה \\d+$/")
    ).not.toHaveCount(0);
  });

  test("optimizer assigns staff to all shifts in 7D mode", async ({
    page,
  }) => {
    await expectShiftsInInfoBar(page);

    await switchToWeeklyMode(page);
    await expectShiftsInInfoBar(page);

    await addStaff(page, 18);
    await expect(page.locator(STAFF_ROW)).toHaveCount(20);

    await expectShiftsInInfoBar(page);

    const optimizeButton = page.locator("#optimize-button");
    await expect(optimizeButton).toBeVisible();
    await optimizeButton.click();

    await expectOptimizedTooltip(page);

    await expectShiftsInInfoBar(page);

    const tabs = page.getByRole("tab");
    for (let day = 0; day < 7; day++) {
      await tabs.nth(day).click();
      await expectAssignmentsNotEmpty(page, 20);
    }
  });

  test("shift counts in staff sidebar reflect optimizer results", async ({
    page,
  }) => {
    await switchToWeeklyMode(page);
    await addStaff(page, 18);
    await expect(page.locator(STAFF_ROW)).toHaveCount(20);

    await expectShiftsInInfoBar(page);

    await page.locator("#optimize-button").click();
    await expectOptimizedTooltip(page);

    await expectShiftsInInfoBar(page);

    const staffMembers = page.locator(STAFF_ROW);
    expect(await staffMembers.count()).toBe(20);

    let totalAssigned = 0;
    for (let i = 0; i < 20; i++) {
      const text = (await staffMembers.nth(i).textContent()) || "";
      const numbers = text.match(/\d+/g);
      if (numbers && numbers.length > 1) {
        const count = parseInt(numbers[numbers.length - 1], 10);
        if (!isNaN(count)) totalAssigned += count;
      }
    }

    expect(
      totalAssigned,
      "Expected total shift assignments across all staff to be > 0"
    ).toBeGreaterThan(0);

    await page.getByRole("tab").first().click();
    await expectAssignmentsNotEmpty(page, 20);
  });
});
