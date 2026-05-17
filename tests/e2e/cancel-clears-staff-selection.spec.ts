import { test, expect } from "@playwright/test";
import {
  installInitScript,
  seedShiftState,
  waitForApp,
  STAFF_ROW,
} from "./helpers";
import assignmentsFixture from "./fixtures/weekly-view-7d-with-assignments.json" with { type: "json" };

// Round 5 — Cancel must clear `selectedStaffIdState` (the viewing-selection)
// in addition to exiting multi-select. CTO directive: behavioral coverage in
// e2e for the click-Cancel-then-availability-empty flow.
//
// Reproduction:
//   1. Open the app (seeded with 4 staff).
//   2. Click one staff row → enters single-view (availability panel renders).
//   3. Click a second row → enters multi-select (both rows checked, ring on
//      both via `isHighlighted = isChecked`).
//   4. Click the multi-select bar's Cancel button.
//   5. Assert: no `ring-2 ring-primary` class on any staff row, and the
//      availability panel is back to its empty/default placeholder state
//      (the "Pick a staff member to view their availability" message).
test.describe("Cancel clears staff viewing-selection", () => {
  test("Cancel exits multi-select AND clears single-view availability", async ({
    page,
  }) => {
    await installInitScript(page);
    await seedShiftState(page, assignmentsFixture as Record<string, unknown>);
    await waitForApp(page);

    const rows = page.locator(STAFF_ROW);
    await expect(rows).toHaveCount(4, { timeout: 10000 });

    const firstRow = rows.nth(0);
    const secondRow = rows.nth(1);

    // Step 2: Click first row → single-view selection.
    await firstRow.click();

    // Step 3: Click second row → enters multi-select. We expect at least one
    // ring on a checked row, and the BulkSelectionBar Cancel button visible.
    await secondRow.click();

    const cancelBtn = page.getByRole("button", { name: /^Cancel selection$/ });
    await expect(cancelBtn).toBeVisible({ timeout: 5000 });

    // Sanity: at least one row currently has the ring while we are in
    // multi-select. Checking via attribute selector on the staff row container.
    const ringedBefore = await page
      .locator(`${STAFF_ROW} .ring-2.ring-primary, ${STAFF_ROW}.ring-2.ring-primary`)
      .count();
    expect(ringedBefore).toBeGreaterThan(0);

    // Step 4: Click Cancel.
    await cancelBtn.click();

    // BulkSelectionBar must be gone.
    await expect(cancelBtn).toBeHidden({ timeout: 5000 });

    // Assertion (a): no row carries `ring-2 ring-primary` after Cancel.
    // Probe the rendered tree directly — class lives on the row container or
    // an immediate descendant in the highlighted state.
    const ringedAfter = await page
      .locator(`${STAFF_ROW} .ring-2.ring-primary, ${STAFF_ROW}.ring-2.ring-primary`)
      .count();
    expect(ringedAfter).toBe(0);

    // Assertion (b): availability panel is in its empty/placeholder state.
    // The empty state renders an "Availability" h3 + "Pick a teammate" h4 +
    // "Click someone in the list to view their assignments" body. No
    // "{{name}}'s Availability" header should be present.
    await expect(
      page.getByRole("heading", { name: /^Pick a teammate$/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("text=/'s Availability/")
    ).toHaveCount(0);
  });
});
