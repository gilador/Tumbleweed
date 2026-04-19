import { test, expect, Page } from "@playwright/test";

async function setupWithAssignments(page: Page) {
  await page.goto("/tumbleweed/");
  await expect(page.locator("text=Tumbleweed").first()).toBeVisible({
    timeout: 10000,
  });

  // Switch to 7D mode
  const scheduleSection = page.locator("text=Schedule Mode").locator("..");
  await scheduleSection.getByRole("button", { name: "7D" }).click();

  // Add extra staff for optimization
  await page.locator("text=Staff").last().click();
  await page.waitForTimeout(300);
  const addFab = page.locator("button.fixed").filter({ has: page.locator("svg") });
  for (let i = 0; i < 3; i++) {
    await addFab.click();
    await page.waitForTimeout(200);
  }

  // Navigate to assignments and switch to weekly
  await page.locator("text=Assignments").last().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Weekly" }).first().click();
  await page.waitForTimeout(300);

  // Run optimizer via FAB
  const fab = page.locator("button.fixed.rounded-full");
  await fab.click();
  await page.waitForTimeout(5000);
}

test.describe("Mobile Weekly View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tumbleweed/");
    await expect(page.locator("text=Tumbleweed").first()).toBeVisible({
      timeout: 10000,
    });

    // Switch to 7D mode in mobile settings
    const scheduleSection = page.locator("text=Schedule Mode").locator("..");
    await scheduleSection.getByRole("button", { name: "7D" }).click();
  });

  test("shows daily/weekly toggle in mobile assignments tab", async ({
    page,
  }) => {
    // Navigate to assignments tab
    await page.locator("text=Assignments").last().click();
    await page.waitForTimeout(500);

    // View toggle should appear
    await expect(page.getByRole("button", { name: "Daily" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Weekly" }).first()).toBeVisible();
  });

  test("weekly view shows read-only grid on mobile", async ({ page }) => {
    // Navigate to assignments tab
    await page.locator("text=Assignments").last().click();
    await page.waitForTimeout(500);

    // Switch to weekly
    await page.getByRole("button", { name: "Weekly" }).first().click();

    // Grid should appear
    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible();

    // All 7 day headers should be visible (scrollable)
    await expect(page.getByTestId("day-header-0")).toBeVisible();
  });

  test("tap day header navigates to daily view for that day", async ({
    page,
  }) => {
    // Add a post and staff first
    const scheduleSection = page.locator("text=Schedule Mode").locator("..");
    await page.locator("text=Staff").last().click();
    await page.waitForTimeout(300);

    // Navigate to assignments tab
    await page.locator("text=Assignments").last().click();
    await page.waitForTimeout(500);

    // Switch to weekly
    await page.getByRole("button", { name: "Weekly" }).first().click();
    await page.waitForTimeout(300);

    // Tap day header 2 (third day)
    await page.getByTestId("day-header-2").click();

    // Should switch back to daily view (weekly grid should be hidden)
    await expect(page.getByTestId("weekly-roster-grid")).not.toBeVisible();
  });

  test("tap assigned cell reveals staff name, tap again dismisses", async ({
    page,
  }) => {
    await setupWithAssignments(page);
    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible({ timeout: 10000 });

    // Find an assigned cell (badge is not "–")
    const allCells = page.locator("[data-testid^='cell-']");
    const cellCount = await allCells.count();
    let assignedCell = null;
    for (let i = 0; i < cellCount; i++) {
      const text = await allCells.nth(i).textContent();
      if (text && text.trim() !== "–") {
        assignedCell = allCells.nth(i);
        break;
      }
    }
    expect(assignedCell, "Expected at least one assigned cell").not.toBeNull();

    // Tap the assigned cell — reveal label should appear
    await assignedCell!.click();
    const revealLabel = page.locator("[data-testid^='reveal-name-']");
    await expect(revealLabel).toBeVisible();

    // Cell should have a ring highlight
    await expect(assignedCell!).toHaveClass(/ring-2/);

    // Tap the same cell again — reveal label should disappear
    await assignedCell!.click();
    await expect(revealLabel).not.toBeVisible();
  });

  test("tap unassigned cell dismisses existing reveal", async ({ page }) => {
    await setupWithAssignments(page);
    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible({ timeout: 10000 });

    const allCells = page.locator("[data-testid^='cell-']");
    const cellCount = await allCells.count();
    let assignedCell = null;
    let unassignedCell = null;
    for (let i = 0; i < cellCount; i++) {
      const text = await allCells.nth(i).textContent();
      if (text && text.trim() !== "–" && !assignedCell) {
        assignedCell = allCells.nth(i);
      } else if (text && text.trim() === "–" && !unassignedCell) {
        unassignedCell = allCells.nth(i);
      }
      if (assignedCell && unassignedCell) break;
    }
    expect(assignedCell, "Expected at least one assigned cell").not.toBeNull();
    expect(unassignedCell, "Expected at least one unassigned cell").not.toBeNull();

    // Tap assigned cell — reveal label should appear
    await assignedCell!.click();
    const revealLabel = page.locator("[data-testid^='reveal-name-']");
    await expect(revealLabel).toBeVisible();

    // Tap unassigned cell — reveal should be dismissed
    await unassignedCell!.click();
    await expect(revealLabel).not.toBeVisible();
  });

  test("tap different assigned cell switches reveal", async ({ page }) => {
    await setupWithAssignments(page);
    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible({ timeout: 10000 });

    // Find two assigned cells
    const allCells = page.locator("[data-testid^='cell-']");
    const cellCount = await allCells.count();
    const assignedCells: typeof allCells[] = [];
    for (let i = 0; i < cellCount && assignedCells.length < 2; i++) {
      const text = await allCells.nth(i).textContent();
      if (text && text.trim() !== "–") {
        assignedCells.push(allCells.nth(i));
      }
    }
    expect(assignedCells.length, "Expected at least two assigned cells").toBe(2);

    // Tap first cell — label appears
    await assignedCells[0].click();
    await expect(page.locator("[data-testid^='reveal-name-']")).toBeVisible();
    await expect(assignedCells[0]).toHaveClass(/ring-2/);

    // Tap second cell — first label dismissed, second label appears
    await assignedCells[1].click();
    const revealLabels = page.locator("[data-testid^='reveal-name-']");
    await expect(revealLabels).toHaveCount(1);
    await expect(assignedCells[0]).not.toHaveClass(/ring-2/);
    await expect(assignedCells[1]).toHaveClass(/ring-2/);
  });
});
