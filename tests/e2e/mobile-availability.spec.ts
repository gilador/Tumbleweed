import { test, expect } from "@playwright/test";

test.describe("Mobile Staff Availability", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tumbleweed/");
    await expect(page.getByText("Tumbleweed")).toBeVisible({ timeout: 10000 });

    // Navigate to staff tab
    await page.getByText("Staff").click();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    // Navigate to first member's availability
    const firstMember = page.locator(".rounded-lg.border").first();
    await firstMember.locator("button.flex-1").click();

    // Should be in availability drill-down
    await expect(page.getByText("All Available")).toBeVisible();
  });

  test("shows post sections with time slots", async ({ page }) => {
    // Should have at least one post section
    const postSections = page.locator(".rounded-lg.border.overflow-hidden");
    const count = await postSections.count();
    expect(count).toBeGreaterThan(0);

    // Each section should have a header with post name and availability count
    const firstSection = postSections.first();
    await expect(firstSection.locator("button").first()).toContainText(/\d+\/\d+/);
  });

  test("can toggle a time slot availability", async ({ page }) => {
    // Find the first time slot button (inside the post sections)
    const postSection = page.locator(".rounded-lg.border.overflow-hidden").first();
    const firstSlot = postSection.locator(".divide-y > button").first();

    // Get current availability state (green check or red X)
    const hasGreenCheck = await firstSlot
      .locator(".bg-green-100")
      .count();
    const wasAvailable = hasGreenCheck > 0;

    // Toggle
    await firstSlot.click();

    // Should have flipped
    if (wasAvailable) {
      await expect(firstSlot.locator(".bg-red-50")).toBeVisible();
    } else {
      await expect(firstSlot.locator(".bg-green-100")).toBeVisible();
    }
  });

  test("bulk set all available", async ({ page }) => {
    // First set all unavailable so we have a known state
    await page.getByText("All Unavailable").click();

    // All slots should be red
    const redSlots = page.locator(".bg-red-50");
    const redCount = await redSlots.count();
    expect(redCount).toBeGreaterThan(0);

    // Now set all available
    await page.getByText("All Available").click();

    // All slots should be green
    const greenSlots = page.locator(".bg-green-100");
    const greenCount = await greenSlots.count();
    expect(greenCount).toBeGreaterThan(0);

    // No red slots should remain
    await expect(page.locator(".bg-red-50")).toHaveCount(0);
  });

  test("bulk set all unavailable", async ({ page }) => {
    // First set all available
    await page.getByText("All Available").click();

    // Now set all unavailable
    await page.getByText("All Unavailable").click();

    // All slots should be red
    const greenSlots = await page.locator(".bg-green-100").count();
    expect(greenSlots).toBe(0);

    const redSlots = await page.locator(".bg-red-50").count();
    expect(redSlots).toBeGreaterThan(0);
  });

  test("tapping post header toggles all its time slots", async ({ page }) => {
    // First set all available
    await page.getByText("All Available").click();

    // Click the first post header
    const postSection = page.locator(".rounded-lg.border.overflow-hidden").first();
    const postHeader = postSection.locator("button.bg-muted\\/50").first();
    await postHeader.click();

    // The slots under this post should now be unavailable (toggled from all-available)
    const redSlotsInPost = postSection.locator(".bg-red-50");
    const redCount = await redSlotsInPost.count();
    expect(redCount).toBeGreaterThan(0);
  });

  test("availability count updates in post header", async ({ page }) => {
    // Set all available first
    await page.getByText("All Available").click();

    const postSection = page.locator(".rounded-lg.border.overflow-hidden").first();
    const postHeader = postSection.locator("button.bg-muted\\/50").first();

    // Header should show all available (e.g., "5/5 ✓")
    await expect(postHeader).toContainText("✓");

    // Toggle the post off
    await postHeader.click();

    // Header should no longer show checkmark
    await expect(postHeader).not.toContainText("✓");
  });
});
