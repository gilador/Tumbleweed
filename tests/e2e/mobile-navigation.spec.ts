import { test, expect } from "@playwright/test";

test.describe("Mobile Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tumbleweed/");
    // Wait for mobile shell to render
    await expect(page.getByText("Tumbleweed")).toBeVisible({ timeout: 10000 });
  });

  test("shows mobile layout with tab bar", async ({ page }) => {
    // Tab bar should be visible with 3 tabs
    await expect(page.getByText("Settings")).toBeVisible();
    await expect(page.getByText("Staff")).toBeVisible();
    await expect(page.getByText("Assignments")).toBeVisible();
  });

  test("settings tab is the default tab", async ({ page }) => {
    // Settings content should be visible by default
    await expect(page.getByText("Operation Hours")).toBeVisible();
    await expect(page.getByText("Posts")).toBeVisible();
    await expect(page.getByText("Intensity")).toBeVisible();
  });

  test("can navigate to staff tab", async ({ page }) => {
    await page.getByText("Staff").click();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();
  });

  test("can navigate to assignments tab", async ({ page }) => {
    await page.getByText("Assignments").click();
    await expect(
      page.getByRole("heading", { name: "Assignments" })
    ).toBeVisible();
  });

  test("can navigate between all tabs", async ({ page }) => {
    // Settings -> Staff
    await page.getByText("Staff").click();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    // Staff -> Assignments
    await page.getByText("Assignments").click();
    await expect(
      page.getByRole("heading", { name: "Assignments" })
    ).toBeVisible();

    // Assignments -> Settings
    await page.getByText("Settings").click();
    await expect(page.getByText("Operation Hours")).toBeVisible();
  });
});
