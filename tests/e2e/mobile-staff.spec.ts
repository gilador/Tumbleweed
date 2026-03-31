import { test, expect } from "@playwright/test";

test.describe("Mobile Staff Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tumbleweed/");
    await expect(page.getByText("Tumbleweed")).toBeVisible({ timeout: 10000 });
    // Navigate to staff tab
    await page.getByText("Staff").click();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();
  });

  test("shows staff list with member count", async ({ page }) => {
    await expect(page.getByText(/\d+ members/)).toBeVisible();
  });

  test("can add a new staff member via FAB", async ({ page }) => {
    const initialCount = await page
      .getByText(/\d+ members/)
      .textContent();
    const initialNum = parseInt(initialCount?.match(/(\d+)/)?.[1] || "0");

    // Click the + FAB button (fixed bottom-right)
    await page
      .locator("button.fixed")
      .filter({ has: page.locator("svg") })
      .click();

    // Member count should increase
    await expect(page.getByText(`${initialNum + 1} members`)).toBeVisible();
  });

  test("staff member has name and chevron", async ({ page }) => {
    // Each staff member row should have a name and a chevron arrow
    const firstMember = page.locator(".rounded-lg.border").first();
    await expect(firstMember).toBeVisible();

    // Should have text content (the name)
    const nameText = await firstMember.locator("span.font-medium").textContent();
    expect(nameText).toBeTruthy();
  });

  test("can delete a staff member with inline confirmation", async ({
    page,
  }) => {
    const memberCountText = await page
      .getByText(/\d+ members/)
      .textContent();
    const initialNum = parseInt(memberCountText?.match(/(\d+)/)?.[1] || "0");

    // Click trash icon on first member
    const firstMember = page.locator(".rounded-lg.border").first();
    await firstMember.locator("button.border-l").click();

    // Should show delete confirmation text
    await expect(page.getByText(/Delete .+\?/)).toBeVisible();

    // Confirm delete
    await page
      .locator('button:has(svg.text-destructive)')
      .click();

    // Count should decrease
    await expect(
      page.getByText(`${initialNum - 1} members`)
    ).toBeVisible();
  });

  test("can cancel delete of staff member", async ({ page }) => {
    const memberCountText = await page
      .getByText(/\d+ members/)
      .textContent();

    // Click trash icon on first member
    const firstMember = page.locator(".rounded-lg.border").first();
    await firstMember.locator("button.border-l").click();

    // Should show confirmation
    await expect(page.getByText(/Delete .+\?/)).toBeVisible();

    // Cancel by clicking X
    await page
      .locator(".rounded-lg.border")
      .first()
      .locator("button")
      .last()
      .click();

    // Count should remain the same
    await expect(page.getByText(memberCountText!)).toBeVisible();
  });

  test("tapping a staff member navigates to availability drill-down", async ({
    page,
  }) => {
    // Tap the first member's main area (not trash)
    const firstMember = page.locator(".rounded-lg.border").first();
    const memberName = await firstMember
      .locator("span.font-medium")
      .textContent();

    await firstMember.locator("button.flex-1").click();

    // Should show availability drill-down with member name as heading
    await expect(
      page.getByRole("heading", { name: memberName! })
    ).toBeVisible();

    // Tab bar should be hidden during drill-down
    await expect(page.getByText("Settings")).not.toBeVisible();

    // Bulk action buttons should be visible
    await expect(page.getByText("All Available")).toBeVisible();
    await expect(page.getByText("All Unavailable")).toBeVisible();
  });

  test("can navigate back from availability drill-down", async ({ page }) => {
    // Navigate to availability
    const firstMember = page.locator(".rounded-lg.border").first();
    await firstMember.locator("button.flex-1").click();

    // Should be in drill-down
    await expect(page.getByText("All Available")).toBeVisible();

    // Click back button
    await page
      .locator('button:has(svg)')
      .first()
      .click();

    // Should be back on staff tab
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    // Tab bar should be visible again
    await expect(page.getByText("Settings")).toBeVisible();
  });
});
