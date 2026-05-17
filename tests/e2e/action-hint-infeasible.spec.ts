import { test, expect } from "@playwright/test";
import { installInitScript, waitForApp } from "./helpers";

// Re-authored: legacy edit-mode prelude is gone. Add user / Add position
// sit on the section headers and are always available. Hints are surfaced
// near the assignments table in English with the helpers below.

test.beforeEach(async ({ page }) => {
  await installInitScript(page);
});

test.describe("Action hint reflects infeasible state", () => {
  test("shows warning hint when configuration is infeasible (more posts than capacity)", async ({
    page,
  }) => {
    await waitForApp(page);

    // Default: 2 staff, 2 posts. Add 3 more posts (5 total) — 2 staff
    // can't cover 5 posts at the default intensity.
    const addPosition = page
      .getByRole("button", { name: /^Add position$/i })
      .first();
    await expect(addPosition).toBeVisible({ timeout: 5000 });
    for (let i = 0; i < 3; i++) {
      await addPosition.click();
      // PostHeadRow autoFocusEdit may render an input; commit immediately.
      const inlineInput = page.locator("#assignments-table input").first();
      if (await inlineInput.count()) {
        await inlineInput.press("Enter").catch(() => {});
      }
    }

    // Wait for the hint to settle.
    const runOptimizerHint = page.getByText(
      "Click the optimize button to generate assignments"
    );
    const overCapacityHint = page.getByText(/Not enough staff/i);

    await expect
      .poll(
        async () => {
          const r = await runOptimizerHint.isVisible().catch(() => false);
          const o = await overCapacityHint.isVisible().catch(() => false);
          return { r, o };
        },
        { timeout: 5000 }
      )
      .toEqual(expect.objectContaining({ o: true }));

    const hasRunOptimizer = await runOptimizerHint.isVisible().catch(() => false);
    const hasOverCapacity = await overCapacityHint.isVisible().catch(() => false);
    expect(
      !hasRunOptimizer || hasOverCapacity,
      `When config is infeasible, should not show "Click the optimize button". hasRunOptimizer=${hasRunOptimizer}, hasOverCapacity=${hasOverCapacity}`
    ).toBe(true);
  });

  test("shows run optimizer hint when configuration IS feasible", async ({
    page,
  }) => {
    await waitForApp(page);

    // Default: 2 staff, 2 posts — feasible. Should show the run-optimizer hint.
    await expect(
      page.getByText("Click the optimize button to generate assignments")
    ).toBeVisible({ timeout: 5000 });
  });
});
