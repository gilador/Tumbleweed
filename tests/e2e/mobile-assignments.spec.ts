import { test, expect, devices, Page } from "@playwright/test";
import { installInitScript, waitForMobileApp } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// AssignmentsTab.tsx layout reference:
//   - Empty state: <h1>Assignments</h1>, "No assignments yet" + hint copy.
//   - FAB: button.fixed.rounded-full (FloatingActionButton).
//   - Header has trash button with title="Clear All Assignments?".
//   - Group toggle: two <button>s with text "Time" and "Post".
//   - Clear dialog: DialogTitle "Clear All Assignments?", buttons "Clear" /
//     "Cancel".

async function gotoAssignments(page: Page) {
  await waitForMobileApp(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Assignments" })
    .click();
  await expect(
    page.getByRole("heading", { name: /^Assignments$/ })
  ).toBeVisible();
}

async function setupForOptimization(page: Page) {
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

  await page.waitForTimeout(300);
}

async function runOptimization(page: Page) {
  const fab = page.locator("button.fixed.rounded-full");
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(page.getByText("No assignments yet")).not.toBeVisible({
    timeout: 30000,
  });
}

test.describe("Mobile Assignments Tab", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
  });

  test("shows empty state when no assignments", async ({ page }) => {
    await gotoAssignments(page);
    await expect(page.getByText("No assignments yet")).toBeVisible();
    await expect(
      page.getByText("Tap the optimize button to generate assignments")
    ).toBeVisible();
  });

  test("shows optimize FAB button", async ({ page }) => {
    await gotoAssignments(page);
    const fab = page.locator("button.fixed.rounded-full");
    await expect(fab).toBeVisible();
  });

  test("can run optimization and see results", async ({ page }) => {
    await setupForOptimization(page);
    await runOptimization(page);

    await expect(page.getByRole("button", { name: /^Time$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Post$/ })).toBeVisible();

    await expect(
      page.getByText(/\d{2}:\d{2}\s*→\s*\d{2}:\d{2}/).first()
    ).toBeVisible();
  });

  test("can toggle between time and post grouping", async ({ page }) => {
    await setupForOptimization(page);
    await runOptimization(page);

    await page.getByRole("button", { name: /^Post$/ }).click();
    const postCards = page.locator("span.font-semibold");
    expect(await postCards.count()).toBeGreaterThan(0);

    await page.getByRole("button", { name: /^Time$/ }).click();
    await expect(
      page.getByText(/\d{2}:\d{2}\s*→\s*\d{2}:\d{2}/).first()
    ).toBeVisible();
  });

  test("can clear all assignments via dialog", async ({ page }) => {
    await setupForOptimization(page);
    await runOptimization(page);

    await page.locator('button[title="Clear All Assignments?"]').click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/^Clear All Assignments\?$/)
    ).toBeVisible();

    await dialog.getByRole("button", { name: /^Clear$/ }).click();

    await expect(page.getByText("No assignments yet")).toBeVisible();
  });

  test("can cancel clear assignments dialog", async ({ page }) => {
    await setupForOptimization(page);
    await runOptimization(page);

    await page.locator('button[title="Clear All Assignments?"]').click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/^Clear All Assignments\?$/)
    ).toBeVisible();

    await dialog.getByRole("button", { name: /^Cancel$/ }).click();

    await expect(page.getByText("No assignments yet")).not.toBeVisible();
  });

  test("assignment cards are expandable/collapsible", async ({ page }) => {
    await setupForOptimization(page);
    await runOptimization(page);

    const firstCard = page.locator(".rounded-lg.border").first();
    const headerButton = firstCard.locator("button").first();
    await expect(headerButton).toBeVisible();

    const wasExpanded = (await firstCard.locator(".divide-y").count()) > 0;
    await headerButton.click();

    if (wasExpanded) {
      await expect(firstCard.locator(".divide-y")).toHaveCount(0);
    } else {
      await expect(firstCard.locator(".divide-y")).toHaveCount(1);
    }
  });
});
