import { test, expect, devices, Page } from "@playwright/test";
import { installInitScript, waitForMobileApp } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// Schedule Mode card has buttons "24H" / "7D". When 7D is active a date input
// (input[type="date"]) appears under "Starting date".

function scheduleModeCard(page: Page) {
  return page
    .locator(".rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: /^Schedule Mode$/ }) });
}

test.describe("Mobile Weekly Roster", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
    await waitForMobileApp(page);
  });

  test("shows schedule mode toggle in mobile settings", async ({ page }) => {
    const card = scheduleModeCard(page);
    await expect(card.getByRole("button", { name: /^24H$/ })).toBeVisible();
    await expect(card.getByRole("button", { name: /^7D$/ })).toBeVisible();
  });

  test("can switch to 7D mode and see date picker", async ({ page }) => {
    const card = scheduleModeCard(page);
    await card.getByRole("button", { name: /^7D$/ }).click();

    await expect(page.getByText("Starting date")).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test("staff preserved when switching 24H to 7D in mobile", async ({
    page,
  }) => {
    const card = scheduleModeCard(page);
    await card.getByRole("button", { name: /^7D$/ }).click();

    await page.getByRole("navigation").getByRole("button", { name: "Staff" }).click();
    await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();

    // Staff list should not show empty state.
    await expect(page.getByText("No staff yet")).not.toBeVisible();
  });

  test("can switch back from 7D to 24H in mobile", async ({ page }) => {
    const card = scheduleModeCard(page);

    await card.getByRole("button", { name: /^7D$/ }).click();
    await expect(page.getByText("Starting date")).toBeVisible();

    await card.getByRole("button", { name: /^24H$/ }).click();
    await expect(page.getByText("Starting date")).not.toBeVisible();
  });
});
