import { test, expect, Page } from "@playwright/test";

/**
 * Helper: dismiss the Google Drive prompt if it appears.
 */
async function dismissDrivePrompt(page: Page) {
  const notNowButton = page.getByRole("button", { name: /לא עכשיו|Not now/i });
  await notNowButton.click({ timeout: 10000 }).catch(() => {});
}

/**
 * Helper: verify the info bar shows non-zero shift count and duration.
 */
async function expectShiftsInInfoBar(page: Page) {
  // The info bar should NOT show "0 משמרות" — it should have a non-zero shift count
  // Check that "0 משמרות" is NOT visible (handles both 24H "0 משמרות" and 7D "0 משמרות/יום")
  await page.waitForTimeout(500);
  const zeroShifts = page.locator("text=/0 משמרות/");
  const hasZero = await zeroShifts.isVisible().catch(() => false);
  expect(hasZero, "Info bar should not show 0 shifts").toBe(false);
}

/**
 * Helper: verify assignment cells contain worker names (not just "-").
 * Checks that the total count of worker name matches exceeds the sidebar count,
 * meaning workers appear in the assignment grid too.
 */
async function expectAssignmentsNotEmpty(page: Page, sidebarStaffCount: number) {
  // Worker names: "עובד N" or "איש צוות חדש N"
  const workerNames = page.locator("text=/עובד \\d+|איש צוות/");
  const totalMatches = await workerNames.count();
  // Sidebar has `sidebarStaffCount` entries. If workers are assigned in the grid,
  // total matches should exceed the sidebar count.
  expect(
    totalMatches,
    `Expected worker names in assignment cells. Total "${totalMatches}" should exceed sidebar count "${sidebarStaffCount}"`
  ).toBeGreaterThan(sidebarStaffCount);
}

/**
 * Helper: switch to 7D weekly mode via settings.
 */
async function switchToWeeklyMode(page: Page) {
  await page.locator('[aria-label*="הגדרות משמרת"], [aria-label*="shift"]').first().click();
  await page.getByRole("button", { name: "7D" }).click();
  await page.locator('[aria-label*="הגדרות משמרת"], [aria-label*="shift"]').first().click();
  await expect(page.getByRole("tab")).toHaveCount(7);
}

/**
 * Helper: add N staff members in edit mode.
 */
async function addStaff(page: Page, count: number) {
  const editToggle = page.locator('[aria-label*="עריכה"], [aria-label*="edit mode"]').first();
  await editToggle.click();
  const addUserButton = page.locator('[aria-label*="הוסף איש"], [aria-label*="Add user"]').first();
  await expect(addUserButton).toBeVisible({ timeout: 5000 });
  for (let i = 0; i < count; i++) {
    await addUserButton.click();
  }
  await editToggle.click();
}

test.describe("Weekly Optimization — 20 staff, 2 posts", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/tumbleweed/");
    await dismissDrivePrompt(page);
    await expect(page.getByRole("heading", { name: "צוות" })).toBeVisible({ timeout: 10000 });
  });

  test("shifts are generated and visible before optimization", async ({ page }) => {
    // Default state: 2 staff, 2 posts, 24H mode
    // Info bar should show non-zero shift count and duration
    await expectShiftsInInfoBar(page);

    // Post rows should be visible in the assignments grid
    const assignmentsTable = page.locator("#assignments-table");
    await expect(assignmentsTable.getByText("עמדה 1")).toBeVisible();
    await expect(assignmentsTable.getByText("עמדה 2")).toBeVisible();
  });

  test("optimizer assigns staff to all shifts in 7D mode", async ({ page }) => {
    // ── Verify shifts exist initially ──
    await expectShiftsInInfoBar(page);

    // ── Switch to 7D mode ──
    await switchToWeeklyMode(page);

    // ── Shifts should still be present after mode switch ──
    await expectShiftsInInfoBar(page);

    // ── Add 18 more staff (20 total) ──
    await addStaff(page, 18);
    await expect(page.locator('[data-testid="staff-member"]')).toHaveCount(20);

    // ── Shifts should still be present after adding staff ──
    await expectShiftsInInfoBar(page);

    // ── Run optimizer ──
    const optimizeButton = page.locator("#optimize-button");
    await expect(optimizeButton).toBeVisible();
    await optimizeButton.click();

    // Wait for optimization success banner
    await expect(page.locator("text=הסידור מיטבי ומעודכן")).toBeVisible({ timeout: 30000 });

    // ── Shifts still visible after optimization ──
    await expectShiftsInInfoBar(page);

    // ── Verify assignments are filled on each day ──
    const tabs = page.getByRole("tab");
    for (let day = 0; day < 7; day++) {
      await tabs.nth(day).click();
      await page.waitForTimeout(300);
      await expectAssignmentsNotEmpty(page, 20);
    }
  });

  test("shift counts in staff sidebar reflect optimizer results", async ({ page }) => {
    // ── Setup: 7D mode, 20 staff ──
    await switchToWeeklyMode(page);
    await addStaff(page, 18);
    await expect(page.locator('[data-testid="staff-member"]')).toHaveCount(20);

    // ── Verify shifts exist ──
    await expectShiftsInInfoBar(page);

    // ── Run optimizer ──
    await page.locator("#optimize-button").click();
    await expect(page.locator("text=הסידור מיטבי ומעודכן")).toBeVisible({ timeout: 30000 });

    // ── Info bar should still show non-zero shifts ──
    await expectShiftsInInfoBar(page);

    // ── Staff sidebar should show non-zero total assignments ──
    const staffMembers = page.locator('[data-testid="staff-member"]');
    expect(await staffMembers.count()).toBe(20);

    let totalAssigned = 0;
    for (let i = 0; i < 20; i++) {
      const member = staffMembers.nth(i);
      const text = await member.textContent() || "";
      const numbers = text.match(/\d+/g);
      if (numbers && numbers.length > 1) {
        const count = parseInt(numbers[numbers.length - 1], 10);
        if (!isNaN(count)) totalAssigned += count;
      }
    }

    expect(
      totalAssigned,
      "Expected total shift assignments across all staff to be > 0 after optimization"
    ).toBeGreaterThan(0);

    // ── Verify actual worker names in assignment grid cells ──
    await page.getByRole("tab").first().click();
    await page.waitForTimeout(300);
    await expectAssignmentsNotEmpty(page, 20);
  });
});
