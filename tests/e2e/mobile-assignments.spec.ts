import { test, expect } from "@playwright/test";

// Helper: set up staff and posts so optimization can run
async function setupForOptimization(page: import("@playwright/test").Page) {
  await page.goto("/tumbleweed/");
  await expect(page.getByText("Tumbleweed")).toBeVisible({ timeout: 10000 });

  // Ensure posts exist (settings tab is default)
  await expect(page.getByText("Posts")).toBeVisible();

  // Go to staff tab and add soldiers (need at least as many as posts)
  await page.getByText("Staff").click();
  await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

  // Add 3 soldiers to ensure enough for optimization
  const addFab = page.locator("button.fixed").filter({ has: page.locator("svg") });
  for (let i = 0; i < 3; i++) {
    await addFab.click();
    await page.waitForTimeout(200);
  }

  // Navigate to assignments
  await page.getByText("Assignments").click();
  await expect(
    page.getByRole("heading", { name: "Assignments" })
  ).toBeVisible();

  // Wait briefly for the optimize button state to settle
  await page.waitForTimeout(500);
}

async function runOptimization(page: import("@playwright/test").Page) {
  const fab = page.locator("button.fixed.rounded-full");
  await expect(fab).toBeVisible();

  // Click the FAB
  await fab.click();

  // Wait for the spinner to appear (indicates optimization started)
  // Then wait for assignments to show up
  await expect(page.getByText("No assignments yet")).not.toBeVisible({
    timeout: 30000,
  });
}

test.describe("Mobile Assignments Tab", () => {
  test("shows empty state when no assignments", async ({ page }) => {
    await page.goto("/tumbleweed/");
    await expect(page.getByText("Tumbleweed")).toBeVisible({ timeout: 10000 });
    await page.getByText("Assignments").click();
    await expect(
      page.getByRole("heading", { name: "Assignments" })
    ).toBeVisible();

    await expect(page.getByText("No assignments yet")).toBeVisible();
    await expect(
      page.getByText("Tap the optimize button to generate assignments")
    ).toBeVisible();
  });

  test("shows optimize FAB button", async ({ page }) => {
    await page.goto("/tumbleweed/");
    await expect(page.getByText("Tumbleweed")).toBeVisible({ timeout: 10000 });
    await page.getByText("Assignments").click();
    await expect(
      page.getByRole("heading", { name: "Assignments" })
    ).toBeVisible();

    const fab = page.locator("button.fixed.rounded-full");
    await expect(fab).toBeVisible();
  });

  test("can run optimization and see results", async ({ page }) => {
    await setupForOptimization(page);
    await runOptimization(page);

    // Should see grouping toggle buttons
    await expect(page.getByText("Time")).toBeVisible();
    await expect(page.getByText("Post")).toBeVisible();

    // Should see time range cards
    await expect(
      page.getByText(/\d{2}:\d{2}\s*→\s*\d{2}:\d{2}/).first()
    ).toBeVisible();
  });

  test("can toggle between time and post grouping", async ({ page }) => {
    await setupForOptimization(page);
    await runOptimization(page);

    // Default is "time" grouping — switch to "post"
    await page.getByText("Post").click();

    // Should see post names as section headers
    const postCards = page.locator("span.font-semibold");
    const count = await postCards.count();
    expect(count).toBeGreaterThan(0);

    // Switch back to "time"
    await page.getByText("Time").click();

    // Should see time range headers
    await expect(
      page.getByText(/\d{2}:\d{2}\s*→\s*\d{2}:\d{2}/).first()
    ).toBeVisible();
  });

  test("can clear all assignments via dialog", async ({ page }) => {
    await setupForOptimization(page);
    await runOptimization(page);

    // Click the trash icon to clear
    await page.locator('button[title="Clear all assignments"]').click();

    // Confirmation dialog should appear
    await expect(page.getByText("Clear All Assignments?")).toBeVisible();

    // Click Clear button
    await page.getByRole("button", { name: "Clear" }).click();

    // Should be back to empty state
    await expect(page.getByText("No assignments yet")).toBeVisible();
  });

  test("can cancel clear assignments dialog", async ({ page }) => {
    await setupForOptimization(page);
    await runOptimization(page);

    // Click the trash icon
    await page.locator('button[title="Clear all assignments"]').click();

    // Dialog should appear
    await expect(page.getByText("Clear All Assignments?")).toBeVisible();

    // Click Cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Assignments should still be visible
    await expect(page.getByText("No assignments yet")).not.toBeVisible();
  });

  test("assignment cards are expandable/collapsible", async ({ page }) => {
    await setupForOptimization(page);
    await runOptimization(page);

    // Find the first time card
    const firstCard = page.locator(".rounded-lg.border").first();
    const headerButton = firstCard.locator("button").first();
    await expect(headerButton).toBeVisible();

    // Check if expanded
    const wasExpanded = (await firstCard.locator(".divide-y").count()) > 0;

    // Click to toggle
    await headerButton.click();

    if (wasExpanded) {
      await expect(firstCard.locator(".divide-y")).toHaveCount(0);
    } else {
      await expect(firstCard.locator(".divide-y")).toHaveCount(1);
    }
  });
});
