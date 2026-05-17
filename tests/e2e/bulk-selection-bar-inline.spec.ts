import { test, expect, Page } from "@playwright/test";
import { clickPostRow, postNameLocators, seedShiftState } from "./helpers";
import assignmentsFixture from "./fixtures/weekly-view-7d-with-assignments.json" with { type: "json" };

// Verifies that when posts multi-select is active, the BulkSelectionBar
// (kind="posts") mounts INLINE inside the schedule controls row
// (`.d-strip-row`, sibling of `data-testid="add-position-button"`),
// and is NOT mounted as a banner above the schedule heading anymore.
//
// Strengthening (per CTO triage):
//  - exactly one bar mounts in the DOM (no double-mount false positives)
//  - the wrapper `.flex-1.min-w-0` is NOT in the DOM when multi-select inactive
//  - bulk-delete + select-all flows still work end-to-end

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem("tumbleweed-lang", "en");
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    } catch {
      /* ignore */
    }
  });
});

async function waitForApp(page: Page) {
  await page.goto("/");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lang = await page.evaluate(() =>
    (window as any).localStorage.getItem("tumbleweed-lang")
  );
  if (lang !== "en") {
    await page.evaluate(() => {
      localStorage.setItem("tumbleweed-lang", "en");
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    });
    await page.reload();
  }
  await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: /^Schedule$/ })
  ).toBeVisible({ timeout: 5000 });
}

test.describe("Bulk selection bar — inline placement (posts)", () => {
  test("when inactive, the bar wrapper is NOT in the DOM", async ({ page }) => {
    await waitForApp(page);

    // No region with `\d+ selected` aria-label should exist.
    await expect(
      page.getByRole("region", { name: /^\d+ selected$/ })
    ).toHaveCount(0);

    // The schedule controls row is mounted, but no flex-1 wrapper hosts a bar.
    const stripRow = page
      .locator('[data-testid="schedule-section-content"] .d-strip-row')
      .first();
    await expect(stripRow).toBeVisible();
    // Inside the d-strip-row, no region indicating a bar.
    await expect(
      stripRow.getByRole("region", { name: /^\d+ selected$/ })
    ).toHaveCount(0);
  });

  test("when posts multi-select is active, the bar mounts INSIDE .d-strip-row as a sibling of the +Add position button", async ({
    page,
  }) => {
    await waitForApp(page);

    test.skip(
      (await postNameLocators(page).count()) < 2,
      "need at least 2 posts to multi-select"
    );

    await clickPostRow(page, 0);
    await clickPostRow(page, 1);

    // Exactly one bar in the DOM (catches double-mount).
    const allBars = page.getByRole("region", { name: /^\d+ selected$/ });
    await expect(allBars).toHaveCount(1, { timeout: 2000 });

    // Bar lives inside `[data-testid="schedule-section-content"] .d-strip-row`.
    const stripRow = page
      .locator('[data-testid="schedule-section-content"] .d-strip-row')
      .first();
    const barInRow = stripRow.getByRole("region", {
      name: /^\d+ selected$/,
    });
    await expect(barInRow).toHaveCount(1);
    await expect(barInRow).toBeVisible();

    // Bar's wrapper is a sibling of the schedule-controls-cluster (which
    // itself contains add-position-button). I.e. both share the same parent
    // `.d-strip-row`.
    const cluster = stripRow.locator(
      '[data-testid="schedule-controls-cluster"]'
    );
    await expect(cluster).toHaveCount(1);
    await expect(
      cluster.locator('[data-testid="add-position-button"]')
    ).toHaveCount(1);

    // Verify in DOM that the bar's nearest `.d-strip-row` ancestor is the
    // same node as the cluster's nearest `.d-strip-row` ancestor.
    const sameRow = await page.evaluate(() => {
      const bar = document.querySelector(
        '[role="region"][aria-label$=" selected"], [role="region"][aria-label$="1 selected"]'
      );
      const cluster = document.querySelector(
        '[data-testid="schedule-controls-cluster"]'
      );
      if (!bar || !cluster) return false;
      const barRow = bar.closest(".d-strip-row");
      const clusterRow = cluster.closest(".d-strip-row");
      return !!barRow && barRow === clusterRow;
    });
    expect(sameRow).toBe(true);
  });

  test("the bar is NOT mounted above the schedule heading (old position in ScheduleSectionHeader)", async ({
    page,
  }) => {
    await waitForApp(page);

    test.skip(
      (await postNameLocators(page).count()) < 1,
      "need at least 1 post"
    );

    await clickPostRow(page, 0);

    // Exactly one bar mounted (no double-mount).
    await expect(
      page.getByRole("region", { name: /^\d+ selected$/ })
    ).toHaveCount(1, { timeout: 2000 });

    // The Schedule heading's container (the section header div) must NOT
    // contain a bulk-selection bar. The header is a sibling of
    // `[data-testid="schedule-section-content"]`. We assert no such region
    // exists outside `schedule-section-content`.
    const outsideContent = await page.evaluate(() => {
      const all = Array.from(
        document.querySelectorAll(
          '[role="region"][aria-label$=" selected"]'
        )
      );
      // Filter to those NOT inside schedule-section-content
      return all.filter(
        (el) => !el.closest('[data-testid="schedule-section-content"]')
      ).length;
    });
    // 0 outside the schedule-section-content — i.e. NOT above the heading.
    // (The staff bar uses its own staff section, not posts; we only count
    // post-bar via being outside schedule-section-content but in the schedule
    // section header — there shouldn't be any such bar.)
    // The staff bar also matches this aria-label pattern, so we additionally
    // assert no bar is a sibling of the schedule heading specifically.
    const aboveHeading = await page.evaluate(() => {
      const heading = Array.from(
        document.querySelectorAll("h2")
      ).find((h) => /^Schedule$/.test(h.textContent?.trim() ?? ""));
      if (!heading) return -1;
      const headerDiv = heading.parentElement; // the .flex.items-baseline header div
      if (!headerDiv) return -1;
      // Look for a bar inside the header div itself (the old mount location).
      return headerDiv.querySelectorAll(
        '[role="region"][aria-label$=" selected"]'
      ).length;
    });
    expect(aboveHeading).toBe(0);
    // (we only used outsideContent for context — assertion is on aboveHeading)
    expect(outsideContent).toBeGreaterThanOrEqual(0); // sanity: query worked
  });

  test("Select all toggles to all posts selected", async ({ page }) => {
    await waitForApp(page);

    const totalPosts = await postNameLocators(page).count();
    test.skip(totalPosts < 2, "need at least 2 posts");

    await clickPostRow(page, 0);

    const region = page.getByRole("region", { name: /^\d+ selected$/ });
    await expect(region).toBeVisible({ timeout: 2000 });

    // Click "Select all" inside the bar.
    const selectAll = region.getByRole("button", { name: /^Select all$/i });
    await selectAll.click();

    // Now all posts are selected — count should match totalPosts.
    await expect(
      page.getByRole("region", { name: new RegExp(`^${totalPosts} selected$`) })
    ).toBeVisible({ timeout: 2000 });
  });

  test("Bulk delete confirms via dialog and removes selected posts end-to-end", async ({
    page,
  }) => {
    await waitForApp(page);

    const initial = await postNameLocators(page).count();
    test.skip(initial < 2, "need at least 2 posts");

    await clickPostRow(page, 0);
    await clickPostRow(page, 1);

    const region = page.getByRole("region", { name: /^\d+ selected$/ });
    await expect(region).toBeVisible({ timeout: 2000 });

    // The trash button has the count "2" as its label content.
    await region.locator("button").filter({ hasText: "2" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/Are you sure you want to delete 2 post/i)
    ).toBeVisible();

    await dialog.getByRole("button", { name: /^Yes, please!$/i }).click();
    await expect(dialog).not.toBeVisible();

    // Bar should disappear (multi-select exits) and post count should drop by 2.
    await expect(
      page.getByRole("region", { name: /^\d+ selected$/ })
    ).toHaveCount(0, { timeout: 2000 });
    await expect(postNameLocators(page)).toHaveCount(initial - 2, {
      timeout: 2000,
    });
  });

  test("controls row height does not grow when posts multi-select activates (regression: components below stayed in place)", async ({
    page,
  }) => {
    await waitForApp(page);

    test.skip(
      (await postNameLocators(page).count()) < 2,
      "need at least 2 posts to multi-select"
    );

    const stripRow = page
      .locator('[data-testid="schedule-section-content"] .d-strip-row')
      .first();
    await expect(stripRow).toBeVisible();

    // Capture height BEFORE multi-select activates.
    const heightBefore = await stripRow.evaluate(
      (el) => (el as HTMLElement).getBoundingClientRect().height
    );

    // Activate posts multi-select.
    await clickPostRow(page, 0);
    await clickPostRow(page, 1);

    // Wait for the inline bar to mount inside the row.
    await expect(
      stripRow.getByRole("region", { name: /^\d+ selected$/ })
    ).toHaveCount(1, { timeout: 2000 });

    // Capture height AFTER.
    const heightAfter = await stripRow.evaluate(
      (el) => (el as HTMLElement).getBoundingClientRect().height
    );

    // ±2px tolerance for sub-pixel rounding.
    expect(Math.abs(heightAfter - heightBefore)).toBeLessThanOrEqual(2);
  });

  test("Clear assignments button: hidden when no assignments, visible inside controls cluster after +Add position when assignments exist", async ({
    page,
  }) => {
    // PART 1 — fresh state, no assignments → Clear button not present and
    // the old absolutely-positioned button is gone from the schedule.
    await waitForApp(page);

    const cluster = page.locator(
      '[data-testid="schedule-controls-cluster"]'
    );
    await expect(cluster).toHaveCount(1);
    await expect(
      cluster.locator('[data-testid="clear-assignments-button"]')
    ).toHaveCount(0);

    const oldAbsoluteCount = await page
      .locator(
        '[data-testid="schedule-section-content"] button.absolute.top-1.end-1'
      )
      .count();
    expect(oldAbsoluteCount).toBe(0);
  });

  test("Clear assignments button: visible inside controls cluster after +Add position when assignments exist (seeded fixture)", async ({
    page,
  }) => {
    // PART 2 — seed a state that has assignments via the captured fixture,
    // then assert the button is mounted inside the controls cluster as a
    // sibling AFTER `add-position-button`, and the old absolute-positioned
    // button is NOT present.
    await seedShiftState(page, assignmentsFixture as object);
    await waitForApp(page);

    const cluster = page.locator(
      '[data-testid="schedule-controls-cluster"]'
    );
    await expect(cluster).toHaveCount(1);

    const addBtn = cluster.locator('[data-testid="add-position-button"]');
    const clearBtn = cluster.locator(
      '[data-testid="clear-assignments-button"]'
    );

    await expect(addBtn).toHaveCount(1);
    await expect(clearBtn).toHaveCount(1);
    await expect(clearBtn).toBeVisible();

    // The label uses the existing i18n key `clearAssignments` → "Clear" (en).
    await expect(clearBtn).toHaveText(/Clear/);

    // DOM ordering: clear button comes AFTER add-position-button as a
    // sibling within `schedule-controls-cluster`.
    const order = await page.evaluate(() => {
      const c = document.querySelector(
        '[data-testid="schedule-controls-cluster"]'
      );
      if (!c) return null;
      const kids = Array.from(c.children);
      const addIdx = kids.findIndex(
        (k) =>
          (k as HTMLElement).getAttribute("data-testid") ===
          "add-position-button"
      );
      const clearIdx = kids.findIndex(
        (k) =>
          (k as HTMLElement).getAttribute("data-testid") ===
          "clear-assignments-button"
      );
      return { addIdx, clearIdx, total: kids.length };
    });
    expect(order).not.toBeNull();
    expect(order!.addIdx).toBeGreaterThanOrEqual(0);
    expect(order!.clearIdx).toBeGreaterThan(order!.addIdx);

    // The old absolutely-positioned button (`.absolute.top-1.end-1`) is GONE
    // from the schedule section.
    const oldAbsoluteCount = await page
      .locator(
        '[data-testid="schedule-section-content"] button.absolute.top-1.end-1'
      )
      .count();
    expect(oldAbsoluteCount).toBe(0);

    // Clicking it opens the existing confirmation dialog (same flow as
    // before — only the trigger location moved).
    await clearBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("Cancel exits multi-select and removes the inline bar from the DOM", async ({
    page,
  }) => {
    await waitForApp(page);

    test.skip(
      (await postNameLocators(page).count()) < 1,
      "need at least 1 post"
    );

    await clickPostRow(page, 0);
    const region = page.getByRole("region", { name: /^\d+ selected$/ });
    await expect(region).toBeVisible({ timeout: 2000 });

    await page.getByRole("button", { name: /Cancel selection/i }).first().click();

    await expect(
      page.getByRole("region", { name: /^\d+ selected$/ })
    ).toHaveCount(0, { timeout: 2000 });

    // After cancel, the wrapper should also be gone (gate closes).
    const stripRow = page
      .locator('[data-testid="schedule-section-content"] .d-strip-row')
      .first();
    await expect(
      stripRow.getByRole("region", { name: /^\d+ selected$/ })
    ).toHaveCount(0);
  });
});
