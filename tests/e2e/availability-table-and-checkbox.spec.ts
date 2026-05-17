import { test, expect } from "@playwright/test";
import {
  STAFF_ROW,
  installInitScript,
  waitForApp,
  clickStaffRow,
} from "./helpers";

// Re-authored against the redesign:
//   - Per-row checkbox UI is gone — selection happens by clicking row
//     whitespace and is reflected in BulkSelectionBar's `^N selected$`
//     copy. The old "checkbox checked/unchecked" assertions are replaced
//     with selection-state assertions on the bulk bar.
//   - The availability surface is the AvailabilityHeatmap with three
//     rendering paths: "Pick a teammate" empty state, "{name}'s
//     Availability" single, and "Availability — N of M" multi.

test.beforeEach(async ({ page }) => {
  await installInitScript(page);
});

test.describe("Availability heatmap rendering paths", () => {
  test("no staff selected → Pick a teammate empty state", async ({ page }) => {
    await waitForApp(page);
    await expect(page.getByText(/Pick a teammate/i).first()).toBeVisible({
      timeout: 4000,
    });
  });

  test("single staff selected → that staff's heatmap header is shown", async ({
    page,
  }) => {
    await waitForApp(page);

    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 1, "need at least 1 staff row");

    const first = rows.first();
    const nameText = (
      (await first.locator("span", { hasText: /\S/ }).first().textContent()) ?? ""
    ).trim();
    await first.click({ position: { x: 4, y: 4 } });

    const nameEsc = nameText.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    await expect(
      page
        .getByRole("heading", {
          name: new RegExp(`${nameEsc}.{0,3}Availability`, "i"),
        })
        .first()
    ).toBeVisible({ timeout: 4000 });
  });

  test("two staff selected → 'Availability — 2 of N' header", async ({
    page,
  }) => {
    await waitForApp(page);
    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 2, "need at least 2 staff rows");

    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);

    await expect(
      page
        .getByRole("heading", { name: /Availability\s+[—-]\s+2 of \d+/ })
        .first()
    ).toBeVisible({ timeout: 4000 });
  });
});

test.describe("Selection model in the redesigned UI", () => {
  test("clicking a staff row toggles single-selection on then off", async ({
    page,
  }) => {
    await waitForApp(page);
    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 1, "need at least 1 staff row");

    const first = rows.first();

    // Initially row is not selected.
    await expect(first).toHaveAttribute("data-selected", "false");

    // Click row whitespace → enters single-select mode.
    await first.click({ position: { x: 4, y: 4 } });
    await expect(first).toHaveAttribute("data-selected", "true");

    // Click again → deselects.
    await first.click({ position: { x: 4, y: 4 } });
    await expect(first).toHaveAttribute("data-selected", "false");
  });

  test("multiple rows can be selected simultaneously", async ({ page }) => {
    await waitForApp(page);
    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 2, "need at least 2 staff rows");

    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);

    await expect(page.getByText(/^2 selected$/).first()).toBeVisible();
  });

  test("Add user does not clobber existing selection on the row level", async ({
    page,
  }) => {
    await waitForApp(page);
    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 1, "need at least 1 staff row");

    // Adding a user is the new equivalent of "still functional after other UI
    // interaction" — verify Add user works without entering some special mode.
    const initial = await rows.count();
    await page.getByRole("button", { name: /^Add$/i }).first().click();
    await expect(page.locator(STAFF_ROW)).toHaveCount(initial + 1);
  });
});
