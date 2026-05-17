import { test, expect, devices, Page } from "@playwright/test";
import { installInitScript, seedShiftState, waitForMobileApp } from "./helpers";
import fixture from "./fixtures/weekly-view-7d-with-assignments.json" with { type: "json" };

test.use({ ...devices["Pixel 7"] });

// AssignmentsTab renders the Daily/Weekly toggle only after assignments
// exist (the empty state returns early). Instead of running the LP optimizer
// (which has timing variance), we seed `pakal-shmira-shiftState` with a
// captured 7D-with-assignments snapshot so every test boots straight into
// the desired state.

async function gotoTab(page: Page, name: string) {
  await page.getByRole("navigation").getByRole("button", { name }).click();
}

async function setupWithAssignments(page: Page) {
  await seedShiftState(page, fixture);
  await waitForMobileApp(page);
  await gotoTab(page, "Assignments");
  await expect(
    page.getByRole("heading", { name: /^Assignments$/ })
  ).toBeVisible();
}

test.describe("Mobile Weekly View", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
  });

  test("shows daily/weekly toggle in mobile assignments tab", async ({
    page,
  }) => {
    await setupWithAssignments(page);
    await expect(
      page.getByRole("button", { name: /^Daily$/ }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Weekly$/ }).first()
    ).toBeVisible();
  });

  test("weekly view shows read-only grid on mobile", async ({ page }) => {
    await setupWithAssignments(page);
    await page.getByRole("button", { name: /^Weekly$/ }).first().click();

    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible();
    await expect(page.getByTestId("day-header-0")).toBeVisible();
  });

  test("tap day header navigates to daily view for that day", async ({
    page,
  }) => {
    await setupWithAssignments(page);
    await page.getByRole("button", { name: /^Weekly$/ }).first().click();
    await page.waitForTimeout(200);

    await page.getByTestId("day-header-2").click();

    await expect(page.getByTestId("weekly-roster-grid")).not.toBeVisible();
  });

  test("tap assigned cell reveals staff name, tap again dismisses", async ({
    page,
  }) => {
    await setupWithAssignments(page);
    await page.getByRole("button", { name: /^Weekly$/ }).first().click();
    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible({
      timeout: 10000,
    });

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

    await assignedCell!.click();
    const revealLabel = page.locator("[data-testid^='reveal-name-']");
    await expect(revealLabel).toBeVisible();
    await expect(assignedCell!).toHaveClass(/ring-2/);

    await assignedCell!.click();
    await expect(revealLabel).not.toBeVisible();
  });

  test("tap unassigned cell dismisses existing reveal", async ({ page }) => {
    await setupWithAssignments(page);
    await page.getByRole("button", { name: /^Weekly$/ }).first().click();
    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible({
      timeout: 10000,
    });

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
    test.skip(
      !assignedCell || !unassignedCell,
      "Need at least one assigned and one unassigned cell"
    );

    await assignedCell!.click();
    const revealLabel = page.locator("[data-testid^='reveal-name-']");
    await expect(revealLabel).toBeVisible();

    await unassignedCell!.click();
    await expect(revealLabel).not.toBeVisible();
  });

  test("tap different assigned cell switches reveal", async ({ page }) => {
    await setupWithAssignments(page);
    await page.getByRole("button", { name: /^Weekly$/ }).first().click();
    await expect(page.getByTestId("weekly-roster-grid")).toBeVisible({
      timeout: 10000,
    });

    const allCells = page.locator("[data-testid^='cell-']");
    const cellCount = await allCells.count();
    const assignedCells: typeof allCells[] = [];
    for (let i = 0; i < cellCount && assignedCells.length < 2; i++) {
      const text = await allCells.nth(i).textContent();
      if (text && text.trim() !== "–") {
        assignedCells.push(allCells.nth(i));
      }
    }
    test.skip(
      assignedCells.length < 2,
      "Need at least two assigned cells"
    );

    await assignedCells[0].click();
    await expect(page.locator("[data-testid^='reveal-name-']")).toBeVisible();
    await expect(assignedCells[0]).toHaveClass(/ring-2/);

    await assignedCells[1].click();
    const revealLabels = page.locator("[data-testid^='reveal-name-']");
    await expect(revealLabels).toHaveCount(1);
    await expect(assignedCells[0]).not.toHaveClass(/ring-2/);
    await expect(assignedCells[1]).toHaveClass(/ring-2/);
  });
});
