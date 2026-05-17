import { test, expect, devices } from "@playwright/test";
import { installInitScript, waitForMobileApp } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// StaffAvailability.tsx renders post sections inside
// `.rounded-lg.border.overflow-hidden`. Each post header is the first button
// (with `bg-muted/50`). Time slot rows live inside `.divide-y > button` and
// use `.bg-green-100` (available) / `.bg-red-50` (unavailable) on a small
// inner span. Page heading is `<h1>{user.name} – Availability</h1>` so the
// user is recognisable by the visible "Availability" suffix.

test.describe("Mobile Staff Availability", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
    await waitForMobileApp(page);

    // Navigate to staff tab
    await page.getByRole("navigation").getByRole("button", { name: "Staff" }).click();
    await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();

    // Open first member's availability via the flex-1 button in the row.
    const firstMember = page.locator(".rounded-lg.border").first();
    await firstMember.locator("button.flex-1").click();

    // Drill-down sanity: bulk action buttons are visible.
    await expect(page.getByText("All Available")).toBeVisible();
  });

  test("shows post sections with time slots", async ({ page }) => {
    const postSections = page.locator(".rounded-lg.border.overflow-hidden");
    const count = await postSections.count();
    expect(count).toBeGreaterThan(0);

    // Each section's first button (post header) shows "n/m".
    const firstSection = postSections.first();
    await expect(firstSection.locator("button").first()).toContainText(/\d+\/\d+/);
  });

  test("can toggle a time slot availability", async ({ page }) => {
    const postSection = page
      .locator(".rounded-lg.border.overflow-hidden")
      .first();
    const firstSlot = postSection.locator(".divide-y > button").first();

    const hasGreenCheck = await firstSlot.locator(".bg-green-100").count();
    const wasAvailable = hasGreenCheck > 0;

    await firstSlot.click();

    if (wasAvailable) {
      await expect(firstSlot.locator(".bg-red-50")).toBeVisible();
    } else {
      await expect(firstSlot.locator(".bg-green-100")).toBeVisible();
    }
  });

  test("bulk set all available", async ({ page }) => {
    await page.getByText("All Unavailable").click();
    expect(await page.locator(".bg-red-50").count()).toBeGreaterThan(0);

    await page.getByText("All Available").click();
    expect(await page.locator(".bg-green-100").count()).toBeGreaterThan(0);
    await expect(page.locator(".bg-red-50")).toHaveCount(0);
  });

  test("bulk set all unavailable", async ({ page }) => {
    await page.getByText("All Available").click();
    await page.getByText("All Unavailable").click();

    expect(await page.locator(".bg-green-100").count()).toBe(0);
    expect(await page.locator(".bg-red-50").count()).toBeGreaterThan(0);
  });

  test("tapping post header toggles all its time slots", async ({ page }) => {
    await page.getByText("All Available").click();

    const postSection = page
      .locator(".rounded-lg.border.overflow-hidden")
      .first();
    const postHeader = postSection.locator("button.bg-muted\\/50").first();
    await postHeader.click();

    expect(await postSection.locator(".bg-red-50").count()).toBeGreaterThan(0);
  });

  test("availability count updates in post header", async ({ page }) => {
    await page.getByText("All Available").click();

    const postSection = page
      .locator(".rounded-lg.border.overflow-hidden")
      .first();
    const postHeader = postSection.locator("button.bg-muted\\/50").first();

    await expect(postHeader).toContainText("✓");

    await postHeader.click();

    await expect(postHeader).not.toContainText("✓");
  });
});
