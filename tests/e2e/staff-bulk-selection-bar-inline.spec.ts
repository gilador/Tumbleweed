import { test, expect, Page } from "@playwright/test";
import {
  STAFF_ROW,
  installInitScript,
  waitForApp,
  clickStaffRow,
} from "./helpers";

// Verifies the fix-staff-bulk-selection-bar-inline change:
//
// Acceptance criteria:
//  - Reset (↺) and +Add buttons sit inside the same flex row
//    `[data-testid="staff-controls-row"]` as the staff BulkSelectionBar.
//  - When staff multi-select is ACTIVE the inline bar mounts inside that
//    same row (not as a separate banner above/below).
//  - When INACTIVE the row collapses to just the buttons — no banner-shaped
//    empty space; row height stays close to button height (≤ 36px).
//  - Layout works in both RTL (Hebrew) and LTR (English): button cluster
//    sits on the start side, bar fills toward the end side.
//  - Bar actions (Select all, bulk-delete, Cancel) remain present and
//    clickable.

const STAFF_CONTROLS_ROW = '[data-testid="staff-controls-row"]';

async function installHebrewInitScript(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem("tumbleweed-lang", "he");
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    } catch {
      /* ignore */
    }
  });
}

async function waitForHebrewApp(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
  // Hebrew Staff heading
  await expect(
    page.getByRole("heading", { name: /^צוות$/ })
  ).toBeVisible({ timeout: 5000 });
}

async function ensureStaff(page: Page, lang: "en" | "he") {
  if ((await page.locator(STAFF_ROW).count()) === 0) {
    const addRe = lang === "en" ? /^Add$/ : /^הוסף$/;
    await page.getByRole("button", { name: addRe }).first().click();
    await expect(page.locator(STAFF_ROW).first()).toBeVisible();
  }
}

test.describe("Staff bulk selection bar — inline placement (LTR)", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
  });

  test("controls row contains [reset][+Add][bar-wrapper]; bar absent when inactive, mounted inside the same row when active", async ({
    page,
  }) => {
    await waitForApp(page);
    await ensureStaff(page, "en");

    const row = page.locator(STAFF_CONTROLS_ROW);
    await expect(row).toHaveCount(1);
    await expect(row).toBeVisible();

    // Reset and +Add buttons live INSIDE the row.
    const resetBtn = row.getByRole("button", {
      name: /Reset all user availability/i,
    });
    const addBtn = row.getByRole("button", { name: /^Add$/ });
    await expect(resetBtn).toHaveCount(1);
    await expect(addBtn).toHaveCount(1);

    // Inactive: no bulk-bar region anywhere in the DOM.
    await expect(
      page.getByRole("region", { name: /^\d+ selected$/ })
    ).toHaveCount(0);

    // Capture height while inactive (button height baseline).
    const inactiveHeight = await row.evaluate(
      (el) => (el as HTMLElement).getBoundingClientRect().height
    );

    // Activate staff multi-select by selecting two rows.
    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 2, "need at least 2 staff rows");
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);

    // Bar mounts and is INSIDE the staff-controls-row (same flex row).
    const barInRow = row.getByRole("region", { name: /^\d+ selected$/ });
    await expect(barInRow).toHaveCount(1, { timeout: 2000 });
    await expect(barInRow).toBeVisible();

    // Exactly one bar overall — no banner double-mount.
    await expect(
      page.getByRole("region", { name: /^\d+ selected$/ })
    ).toHaveCount(1);

    // Bar's nearest staff-controls-row ancestor is the same node as the
    // +Add button's nearest staff-controls-row ancestor.
    const sameRow = await page.evaluate(() => {
      const bar = document.querySelector(
        '[data-testid="staff-controls-row"] [role="region"]'
      );
      const addBtn = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '[data-testid="staff-controls-row"] button'
        )
      ).find((b) => b.textContent?.trim() === "Add");
      if (!bar || !addBtn) return false;
      const barRow = bar.closest('[data-testid="staff-controls-row"]');
      const addRow = addBtn.closest('[data-testid="staff-controls-row"]');
      return !!barRow && barRow === addRow;
    });
    expect(sameRow).toBe(true);

    // Reset/+Add still inside the row alongside the bar.
    await expect(resetBtn).toHaveCount(1);
    await expect(addBtn).toHaveCount(1);

    // Row height when active should be close to inactive height (no banner).
    const activeHeight = await row.evaluate(
      (el) => (el as HTMLElement).getBoundingClientRect().height
    );
    expect(Math.abs(activeHeight - inactiveHeight)).toBeLessThanOrEqual(4);
    // And height stays around button-height (≤ 36px) — not a banner.
    expect(inactiveHeight).toBeLessThanOrEqual(36);
    expect(activeHeight).toBeLessThanOrEqual(36);
  });

  test("button cluster sits at start side (left) in LTR; bar extends toward end side", async ({
    page,
  }) => {
    await waitForApp(page);
    await ensureStaff(page, "en");

    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 2, "need at least 2 staff rows");
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);

    const row = page.locator(STAFF_CONTROLS_ROW);
    const addBtn = row.getByRole("button", { name: /^Add$/ });
    const bar = row.getByRole("region", { name: /^\d+ selected$/ });

    await expect(bar).toBeVisible({ timeout: 2000 });

    const addBox = await addBtn.boundingBox();
    const barBox = await bar.boundingBox();
    expect(addBox).not.toBeNull();
    expect(barBox).not.toBeNull();

    // LTR: +Add is to the LEFT of the bar.
    expect(addBox!.x + addBox!.width).toBeLessThanOrEqual(barBox!.x + 1);
  });

  test("clicking a staff row from an empty selection checks its checkbox AND selects it for viewing (combined behavior)", async ({
    page,
  }) => {
    await waitForApp(page);
    await ensureStaff(page, "en");

    const rowsLoc = page.locator(STAFF_ROW);
    test.skip((await rowsLoc.count()) < 1, "need at least 1 staff row");

    // No row is checked yet — bulk bar should be absent.
    await expect(
      page.getByRole("region", { name: /^\d+ selected$/ })
    ).toHaveCount(0);

    // Click the first staff row body. New combined behavior: the row's
    // checkbox should toggle ON, AND the row should be selected for
    // viewing (data-selected="true"). The inline bar should appear since
    // checking a row activates multi-select.
    await clickStaffRow(page, 0);

    const firstRow = rowsLoc.nth(0);
    await expect(firstRow).toHaveAttribute("data-selected", "true");
    const checked = await firstRow
      .locator(".check-mark")
      .evaluate((el) => el.classList.contains("bg-primary"));
    expect(checked).toBe(true);

    // Bulk selection bar appears since multi-select is now active.
    const row = page.locator(STAFF_CONTROLS_ROW);
    await expect(
      row.getByRole("region", { name: /^1 selected$/ })
    ).toBeVisible({ timeout: 2000 });
  });

  test("when multi-select is active, clicking a staff row toggles that row's checkbox (does not just highlight)", async ({
    page,
  }) => {
    await waitForApp(page);
    await ensureStaff(page, "en");

    // Need at least 3 rows so we can verify the third row toggles cleanly
    // while the first two stay in the multi-set.
    const rowsLoc = page.locator(STAFF_ROW);
    while ((await rowsLoc.count()) < 3) {
      await page.getByRole("button", { name: /^Add$/ }).first().click();
      await expect(rowsLoc.nth((await rowsLoc.count()) - 1)).toBeVisible();
    }

    // Click rows 0 and 1 — both check, bar reaches "2 selected".
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);

    const row = page.locator(STAFF_CONTROLS_ROW);
    const bar = row.getByRole("region", { name: /^\d+ selected$/ });
    await expect(bar).toBeVisible({ timeout: 2000 });
    await expect(
      row.getByRole("region", { name: /^2 selected$/ })
    ).toBeVisible();

    // Now click the third (index 2) staff row's whitespace WHILE multi
    // mode is active. This should TOGGLE that row's checkbox (count → 3).
    await clickStaffRow(page, 2);

    // Bar count increments to 3.
    await expect(
      row.getByRole("region", { name: /^3 selected$/ })
    ).toBeVisible({ timeout: 2000 });

    // The third row's checkbox is now visually checked (data-selected="true"
    // on the row, and the inner check button has the bg-primary class which
    // identifies the checked state in WorkerList).
    const thirdRow = rowsLoc.nth(2);
    await expect(thirdRow).toHaveAttribute("data-selected", "true");
    const checkedClassPresent = await thirdRow
      .locator(".check-mark")
      .evaluate((el) => el.classList.contains("bg-primary"));
    expect(checkedClassPresent).toBe(true);

    // Clicking the same row again toggles it back off — count drops to 2.
    await clickStaffRow(page, 2);
    await expect(
      row.getByRole("region", { name: /^2 selected$/ })
    ).toBeVisible({ timeout: 2000 });
    const checkedAfterUntoggle = await thirdRow
      .locator(".check-mark")
      .evaluate((el) => el.classList.contains("bg-primary"));
    expect(checkedAfterUntoggle).toBe(false);
  });

  test("clicking an already-checked different row toggles its checkbox off; the bar count drops by 1 and selected-for-viewing remains valid (AC #3)", async ({
    page,
  }) => {
    await waitForApp(page);
    await ensureStaff(page, "en");

    const rowsLoc = page.locator(STAFF_ROW);
    while ((await rowsLoc.count()) < 2) {
      await page.getByRole("button", { name: /^Add$/ }).first().click();
      await expect(rowsLoc.nth((await rowsLoc.count()) - 1)).toBeVisible();
    }

    // Row 0: combined click → row 0 is checked AND selected-for-viewing.
    await clickStaffRow(page, 0);
    // Row 1: combined click → row 1 also checked. Bar shows "2 selected".
    await clickStaffRow(page, 1);

    const row = page.locator(STAFF_CONTROLS_ROW);
    await expect(
      row.getByRole("region", { name: /^2 selected$/ })
    ).toBeVisible({ timeout: 2000 });

    const firstRow = rowsLoc.nth(0);
    const secondRow = rowsLoc.nth(1);

    // Click row 1 again — already-checked, "different" from currently
    // selected-for-viewing (row 0). Toggle checkbox OFF; bar drops to 1.
    await clickStaffRow(page, 1);
    await expect(
      row.getByRole("region", { name: /^1 selected$/ })
    ).toBeVisible({ timeout: 2000 });

    // Row 1's checkbox is unchecked.
    const checkedSecond = await secondRow
      .locator(".check-mark")
      .evaluate((el) => el.classList.contains("bg-primary"));
    expect(checkedSecond).toBe(false);

    // Per CEO R3 directive: clicking a row always toggles the checkbox AND
    // selects-for-viewing. The fix to `handleStaffRowClick` (R4) ensures
    // that even when the click is a toggle-off in active multi-select,
    // selectedStaffId follows to the clicked row — so the avg-shifts
    // heatmap follows the click. After the second click on row 1:
    //   - row 1 is unchecked (count dropped by 1) BUT is now the
    //     selected-for-viewing user → still data-selected="true" via the
    //     isSelected branch of isHighlighted.
    //   - row 0 remains checked (still in the multi set) → data-selected
    //     stays "true" via the isChecked branch.
    // The strict signal that selected-for-viewing moved is therefore
    // captured by row 1 retaining data-selected="true" while its checkbox
    // is unchecked — i.e., highlight without check, only possible when
    // selectedStaffId === row1.
    await expect(secondRow).toHaveAttribute("data-selected", "true");
    const secondCheckedAfter = await secondRow
      .locator(".check-mark")
      .evaluate((el) => el.classList.contains("bg-primary"));
    expect(secondCheckedAfter).toBe(false);
  });

  test("clicking the inner checkbox button does not double-toggle (count moves by exactly 1)", async ({
    page,
  }) => {
    await waitForApp(page);
    await ensureStaff(page, "en");

    const rowsLoc = page.locator(STAFF_ROW);
    while ((await rowsLoc.count()) < 2) {
      await page.getByRole("button", { name: /^Add$/ }).first().click();
      await expect(rowsLoc.nth((await rowsLoc.count()) - 1)).toBeVisible();
    }

    // Activate multi-select first via row click on row 0 (combined behavior).
    await clickStaffRow(page, 0);

    const row = page.locator(STAFF_CONTROLS_ROW);
    await expect(
      row.getByRole("region", { name: /^1 selected$/ })
    ).toBeVisible({ timeout: 2000 });

    // Click row 1's INNER checkbox button (the .check-mark element). This
    // must be exactly +1 — handleCheckClick stops propagation so the row's
    // onClick never fires too.
    const secondRow = rowsLoc.nth(1);
    await secondRow.locator(".check-mark").click();

    // Bar count → 2 (no double-toggle which would have left it at 1).
    await expect(
      row.getByRole("region", { name: /^2 selected$/ })
    ).toBeVisible({ timeout: 2000 });

    const checkedSecond = await secondRow
      .locator(".check-mark")
      .evaluate((el) => el.classList.contains("bg-primary"));
    expect(checkedSecond).toBe(true);
  });

  test("shift-click on a checkbox selects a range of rows", async ({
    page,
  }) => {
    await waitForApp(page);
    await ensureStaff(page, "en");

    const rowsLoc = page.locator(STAFF_ROW);
    while ((await rowsLoc.count()) < 4) {
      await page.getByRole("button", { name: /^Add$/ }).first().click();
      await expect(rowsLoc.nth((await rowsLoc.count()) - 1)).toBeVisible();
    }

    // Click row 0 first to enter multi-select with row 0 checked.
    await clickStaffRow(page, 0);

    const row = page.locator(STAFF_CONTROLS_ROW);
    await expect(
      row.getByRole("region", { name: /^1 selected$/ })
    ).toBeVisible({ timeout: 2000 });

    // Shift-click row 3's check-mark → expected to select range 0..3 (4 rows).
    await rowsLoc
      .nth(3)
      .locator(".check-mark")
      .click({ modifiers: ["Shift"] });

    await expect(
      row.getByRole("region", { name: /^4 selected$/ })
    ).toBeVisible({ timeout: 2000 });
  });

  test("bar actions remain functional (Select all, Cancel) inside the inline row", async ({
    page,
  }) => {
    await waitForApp(page);
    await ensureStaff(page, "en");

    // Make sure we have at least 3 staff rows so that selecting 2 leaves
    // "Select all" as the visible action (rather than collapsing to
    // "Deselect all users" because all rows are already selected).
    const rowsLoc = page.locator(STAFF_ROW);
    while ((await rowsLoc.count()) < 3) {
      await page.getByRole("button", { name: /^Add$/ }).first().click();
      await expect(rowsLoc.nth((await rowsLoc.count()) - 1)).toBeVisible();
    }

    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);

    const row = page.locator(STAFF_CONTROLS_ROW);
    const bar = row.getByRole("region", { name: /^\d+ selected$/ });
    await expect(bar).toBeVisible({ timeout: 2000 });

    // Select all toggles bar to N selected.
    const totalRows = await rowsLoc.count();
    await bar.getByRole("button", { name: /^Select all$/i }).click();
    await expect(
      row.getByRole("region", {
        name: new RegExp(`^${totalRows} selected$`),
      })
    ).toBeVisible({ timeout: 2000 });

    // Cancel exits multi-select; bar leaves DOM.
    await page
      .getByRole("button", { name: /Cancel selection/i })
      .first()
      .click();
    await expect(
      page.getByRole("region", { name: /^\d+ selected$/ })
    ).toHaveCount(0, { timeout: 2000 });

    // Row collapses back; +Add still present.
    await expect(row.getByRole("button", { name: /^Add$/ })).toHaveCount(1);
  });
});

test.describe("Staff bulk selection bar — inline placement (RTL / Hebrew)", () => {
  test.beforeEach(async ({ page }) => {
    await installHebrewInitScript(page);
  });

  test("RTL: button cluster sits at start side (right); bar extends toward end side (left)", async ({
    page,
  }) => {
    await waitForHebrewApp(page);
    await ensureStaff(page, "he");

    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 2, "need at least 2 staff rows");
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);

    const row = page.locator(STAFF_CONTROLS_ROW);
    await expect(row).toBeVisible();

    // The bar's aria-label uses Hebrew copy: "2 נבחרו".
    const bar = row.getByRole("region", { name: /^\d+ נבחרו$/ });
    await expect(bar).toHaveCount(1, { timeout: 2000 });
    await expect(bar).toBeVisible();

    // Verify <html dir="rtl"> (or computed direction is rtl).
    const isRtl = await page.evaluate(() => {
      const html = document.documentElement;
      return (
        html.getAttribute("dir") === "rtl" ||
        getComputedStyle(html).direction === "rtl" ||
        getComputedStyle(document.body).direction === "rtl"
      );
    });
    expect(isRtl).toBe(true);

    const addBtn = row.getByRole("button", { name: /^הוסף$/ });
    await expect(addBtn).toHaveCount(1);

    const addBox = await addBtn.boundingBox();
    const barBox = await bar.boundingBox();
    expect(addBox).not.toBeNull();
    expect(barBox).not.toBeNull();

    // RTL: +Add (start side) is to the RIGHT of the bar; bar extends leftward.
    expect(addBox!.x).toBeGreaterThanOrEqual(barBox!.x + barBox!.width - 1);

    // Same-row anchor invariant holds in RTL too.
    const sameRow = await page.evaluate(() => {
      const bar = document.querySelector(
        '[data-testid="staff-controls-row"] [role="region"]'
      );
      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '[data-testid="staff-controls-row"] button'
        )
      );
      // Hebrew "+Add" — text "הוסף"
      const addBtn = buttons.find((b) =>
        (b.textContent ?? "").includes("הוסף")
      );
      if (!bar || !addBtn) return false;
      return (
        bar.closest('[data-testid="staff-controls-row"]') ===
        addBtn.closest('[data-testid="staff-controls-row"]')
      );
    });
    expect(sameRow).toBe(true);
  });

  test("RTL: row collapses when inactive — no banner-shaped empty space", async ({
    page,
  }) => {
    await waitForHebrewApp(page);
    await ensureStaff(page, "he");

    const row = page.locator(STAFF_CONTROLS_ROW);
    await expect(row).toBeVisible();

    // Inactive: no bar mounted.
    await expect(
      row.getByRole("region", { name: /^\d+ נבחרו$/ })
    ).toHaveCount(0);

    const height = await row.evaluate(
      (el) => (el as HTMLElement).getBoundingClientRect().height
    );
    // Button-sized row, not banner.
    expect(height).toBeLessThanOrEqual(36);
  });
});
