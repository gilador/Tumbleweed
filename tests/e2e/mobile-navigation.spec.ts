import { test, expect, devices } from "@playwright/test";
import { installInitScript, waitForMobileApp } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// Mobile tab bar labels (MobileTabBar.tsx):
//   settings tab -> labelKey "posts" -> "Posts"
//   staff tab    -> labelKey "staff" -> "Staff"
//   assignments  -> labelKey "assignments" -> "Assignments"
// Each tab is rendered as a <button>. The Staff/Assignments page bodies render
// an <h1> with the same name, so when scoping for the tab itself use the
// nav-scoped role lookup (helper-style) or rely on click-vs-heading distinction.

test.describe("Mobile Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
  });

  test("shows mobile layout with tab bar", async ({ page }) => {
    await waitForMobileApp(page);
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("button", { name: "Posts" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Staff" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Assignments" })).toBeVisible();
  });

  test("settings tab is the default tab", async ({ page }) => {
    await waitForMobileApp(page);
    await expect(
      page.getByRole("heading", { name: /^Operation Hours$/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Posts$/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Shift Intensity$/ })
    ).toBeVisible();
  });

  test("can navigate to staff tab", async ({ page }) => {
    await waitForMobileApp(page);
    await page.getByRole("navigation").getByRole("button", { name: "Staff" }).click();
    await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();
  });

  test("can navigate to assignments tab", async ({ page }) => {
    await waitForMobileApp(page);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Assignments" })
      .click();
    await expect(
      page.getByRole("heading", { name: /^Assignments$/ })
    ).toBeVisible();
  });

  test("can navigate between all tabs", async ({ page }) => {
    await waitForMobileApp(page);
    const nav = page.getByRole("navigation");

    await nav.getByRole("button", { name: "Staff" }).click();
    await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();

    await nav.getByRole("button", { name: "Assignments" }).click();
    await expect(
      page.getByRole("heading", { name: /^Assignments$/ })
    ).toBeVisible();

    await nav.getByRole("button", { name: "Posts" }).click();
    await expect(
      page.getByRole("heading", { name: /^Operation Hours$/ })
    ).toBeVisible();
  });
});
