import { test, expect } from "@playwright/test";

test.describe("Mobile Staff Name Editing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tumbleweed/");
    await expect(page.locator("text=Tumbleweed").first()).toBeVisible({
      timeout: 10000,
    });

    // Navigate to staff tab
    await page.locator("text=Staff").last().click();
    await page.waitForTimeout(500);
  });

  test("shows pencil edit icon next to each staff member", async ({
    page,
  }) => {
    // Add a staff member if needed
    const addButton = page.locator("button").filter({ has: page.locator("svg.tabler-icon-plus") }).last();
    await addButton.click();
    await page.waitForTimeout(300);

    // Should see a pencil icon (edit button)
    const pencilButtons = page.locator("svg.tabler-icon-pencil");
    await expect(pencilButtons.first()).toBeVisible();
  });

  test("clicking pencil opens inline edit with current name", async ({
    page,
  }) => {
    // Add a staff member
    const addButton = page.locator("button").filter({ has: page.locator("svg.tabler-icon-plus") }).last();
    await addButton.click();
    await page.waitForTimeout(300);

    // Click pencil icon on first staff member
    const pencilButton = page.locator("svg.tabler-icon-pencil").first().locator("..");
    await pencilButton.click();

    // Input field should appear with the current name
    const input = page.getByTestId("edit-staff-name-input");
    await expect(input).toBeVisible();
    await expect(input).not.toHaveValue("");
  });

  test("can edit staff name and save with check button", async ({ page }) => {
    // Add a staff member
    const addButton = page.locator("button").filter({ has: page.locator("svg.tabler-icon-plus") }).last();
    await addButton.click();
    await page.waitForTimeout(300);

    // Get original name
    const staffName = page.locator(".text-sm.font-medium").first();
    const originalName = await staffName.textContent();

    // Click pencil to edit
    const pencilButton = page.locator("svg.tabler-icon-pencil").first().locator("..");
    await pencilButton.click();

    // Clear and type new name
    const input = page.getByTestId("edit-staff-name-input");
    await input.clear();
    await input.fill("שם חדש");

    // Click check button to save
    const checkButton = page.locator("svg.tabler-icon-check").first().locator("..");
    await checkButton.click();

    // Input should disappear
    await expect(input).not.toBeVisible();

    // Name should be updated
    await expect(page.locator("text=שם חדש")).toBeVisible();
  });

  test("pressing Escape cancels edit without saving", async ({ page }) => {
    // Add a staff member
    const addButton = page.locator("button").filter({ has: page.locator("svg.tabler-icon-plus") }).last();
    await addButton.click();
    await page.waitForTimeout(300);

    // Get original name
    const staffName = page.locator(".text-sm.font-medium").first();
    const originalName = await staffName.textContent();

    // Click pencil to edit
    const pencilButton = page.locator("svg.tabler-icon-pencil").first().locator("..");
    await pencilButton.click();

    // Type something different
    const input = page.getByTestId("edit-staff-name-input");
    await input.clear();
    await input.fill("שם שונה לגמרי");

    // Press Escape to cancel
    await input.press("Escape");

    // Input should disappear, original name should remain
    await expect(input).not.toBeVisible();
    await expect(page.locator(`text=${originalName}`).first()).toBeVisible();
  });

  test("pressing Enter saves the edit", async ({ page }) => {
    // Add a staff member
    const addButton = page.locator("button").filter({ has: page.locator("svg.tabler-icon-plus") }).last();
    await addButton.click();
    await page.waitForTimeout(300);

    // Click pencil to edit
    const pencilButton = page.locator("svg.tabler-icon-pencil").first().locator("..");
    await pencilButton.click();

    // Clear and type new name, then press Enter
    const input = page.getByTestId("edit-staff-name-input");
    await input.clear();
    await input.fill("עובד מעודכן");
    await input.press("Enter");

    // Input should disappear, new name should appear
    await expect(input).not.toBeVisible();
    await expect(page.locator("text=עובד מעודכן")).toBeVisible();
  });
});
