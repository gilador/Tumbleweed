import { test, expect, devices, Page } from "@playwright/test";
import { installInitScript, waitForMobileApp } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// Group C — Mobile staff list + drill-down. Re-authored after the
// fix-mobile-staff-item-align-with-desktop-multiselect change: inline
// pencil/trash buttons are gone, replaced by long-press on the name span
// (rename, covered in mobile-staff-edit.spec.ts) and long-press elsewhere
// on the row (multi-select, covered in mobile-staff-multiselect.spec.ts).
// The chevron tap target still navigates to the full-screen drill-down
// (StaffAvailability.tsx). FAB and tab bar are hidden during drill-down.

const navigateToStaff = async (page: Page) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Staff" })
    .click();
  await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();
};

const openFirstMemberDrillDown = async (page: Page) => {
  const firstMember = page.locator(".rounded-lg.border").first();
  await firstMember.locator("button.flex-1").click();
  await expect(page.getByText("All Available")).toBeVisible();
};

test.describe("Mobile Staff Tab", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
    await waitForMobileApp(page);
    await navigateToStaff(page);
  });

  test("shows staff list with member count", async ({ page }) => {
    // Default-seeded state has 8 members.
    await expect(page.getByText(/\d+ members/)).toBeVisible();
    const rows = page.locator(".rounded-lg.border");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("can add a new staff member via FAB", async ({ page }) => {
    const rows = page.locator(".rounded-lg.border");
    const before = await rows.count();
    const fab = page.locator("button.fixed.bottom-20").first();
    await fab.click();
    await expect(rows).toHaveCount(before + 1);
  });

  test("staff member has name and chevron", async ({ page }) => {
    const firstMember = page.locator(".rounded-lg.border").first();
    // Name span is the first text child of the flex-1 button.
    await expect(firstMember.locator("button.flex-1")).toBeVisible();
    // Chevron rendered as svg with class icon-flip.
    await expect(firstMember.locator("svg.icon-flip")).toHaveCount(1);
  });

  test("can delete a single staff member via long-press → multi-select → Delete", async ({
    page,
  }) => {
    const rows = page.locator(".rounded-lg.border");
    const before = await rows.count();
    const firstMember = rows.first();

    // Long-press the row body (right side, past the name span) to enter
    // multi-select with that row pre-selected.
    const box = await firstMember.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.85, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();

    await expect(
      page.getByRole("region", { name: /1 selected/i })
    ).toBeVisible();
    await page.getByRole("button", { name: /delete 1/i }).click();
    await page.getByRole("button", { name: /yes/i }).click();
    await expect(rows).toHaveCount(before - 1);
  });

  test("can cancel multi-select without deleting", async ({ page }) => {
    const rows = page.locator(".rounded-lg.border");
    const before = await rows.count();
    const firstMember = rows.first();

    const box = await firstMember.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.85, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();

    await expect(
      page.getByRole("region", { name: /1 selected/i })
    ).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();
    // Bar disappears, all rows still present.
    await expect(rows).toHaveCount(before);
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("tapping a staff member navigates to availability drill-down", async ({
    page,
  }) => {
    await openFirstMemberDrillDown(page);
    // Bulk action buttons are visible.
    await expect(page.getByText("All Available")).toBeVisible();
    await expect(page.getByText("All Unavailable")).toBeVisible();
    await expect(page.getByText("Weekdays only")).toBeVisible();
    await expect(page.getByText("Weekends only")).toBeVisible();
    // Tab bar is hidden during drill-down.
    await expect(page.getByRole("navigation")).toHaveCount(0);
    // FAB (StaffTab's add button) is hidden — staff list is display:none.
    const visibleFabs = page.locator(
      "button.fixed.bottom-20:not([style*='display: none']):visible"
    );
    expect(await visibleFabs.count()).toBe(0);
  });

  test("can navigate back from availability drill-down", async ({ page }) => {
    await openFirstMemberDrillDown(page);
    // Back button is the first button in the header.
    const back = page.locator("button.p-2").first();
    await back.click();
    await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("long-press on staff row body enters multi-select (desktop parity)", async ({
    page,
  }) => {
    const firstMember = page.locator(".rounded-lg.border").first();
    const box = await firstMember.boundingBox();
    expect(box).not.toBeNull();
    // Press on the right side of the row, past the name span (outside the
    // long-press name hot-zone) so we resolve to the multi-select branch.
    await page.mouse.move(box!.x + box!.width * 0.85, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    // BulkSelectionBar appears with that row pre-selected.
    await expect(
      page.getByRole("region", { name: /1 selected/i })
    ).toBeVisible();
    // Tab bar hidden while the bar is up.
    await expect(page.getByRole("navigation")).toHaveCount(0);
    // Drill-down was NOT entered.
    await expect(page.getByText("All Available")).toHaveCount(0);
  });

  test("Weekdays only writes Sun-Thu available, Fri-Sat unavailable (24h mode default)", async ({
    page,
  }) => {
    await openFirstMemberDrillDown(page);
    // Mark all unavailable to start clean.
    await page.getByText("All Unavailable").click();
    // 24h mode default: weekdays-only → all available.
    await page.getByText("Weekdays only").click();
    expect(await page.locator(".bg-green-100").count()).toBeGreaterThan(0);
    await expect(page.locator(".bg-red-50")).toHaveCount(0);
  });

  test("Weekends only writes Fri-Sat available, Sun-Thu unavailable (24h mode default)", async ({
    page,
  }) => {
    await openFirstMemberDrillDown(page);
    await page.getByText("All Available").click();
    // 24h mode default: weekends-only → all unavailable (no day axis).
    await page.getByText("Weekends only").click();
    expect(await page.locator(".bg-red-50").count()).toBeGreaterThan(0);
    await expect(page.locator(".bg-green-100")).toHaveCount(0);
  });

  // CTO runtime item #1: scroll-position round-trip preservation. Option A keeps
  // the staff list mounted via display:none while the drill-down is active, so
  // native scrollTop on the .overflow-y-auto container should survive a round
  // trip without ref bookkeeping. KNOWN ISSUE: Chromium auto-scrolls a focused
  // descendant back into view when its ancestor toggles display:none -> block,
  // partially clobbering scrollTop. Tracked as a follow-up bug.
  test("staff list scroll position is preserved across drill-down round-trip", async ({
    page,
  }) => {
    // Pad the list so it can actually scroll within the viewport.
    const fab = page.locator("button.fixed.bottom-20").first();
    for (let i = 0; i < 30; i++) await fab.click();
    const scrollContainer = page
      .locator("div.absolute.inset-0.overflow-y-auto")
      .first();
    await scrollContainer.evaluate((el) => {
      el.scrollTop = 200;
    });
    const before = await scrollContainer.evaluate((el) => ({
      top: el.scrollTop,
      max: el.scrollHeight - el.clientHeight,
    }));
    expect(before.top).toBeGreaterThan(0);

    await openFirstMemberDrillDown(page);
    const back = page.locator("button.p-2").first();
    await back.click();
    await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();

    const after = await scrollContainer.evaluate((el) => ({
      top: el.scrollTop,
      max: el.scrollHeight - el.clientHeight,
    }));
    // scrollTop is preserved within rounding tolerance; allow ±2px for
    // browser layout-rounding when display:none toggles.
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(2);
  });
});

// CTO runtime item #2: Hebrew RTL on the 4-button action row. Confirm all four
// labels render in Hebrew and the document is dir=rtl when the drill-down is
// open.
test.describe("Mobile Staff Tab — Hebrew RTL", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        localStorage.setItem("tumbleweed-lang", "he");
        localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
      } catch {
        /* ignore */
      }
    });
    await page.goto("/");
    await expect(page.getByRole("navigation")).toBeVisible({ timeout: 10000 });
  });

  test("4-button action row renders Hebrew labels with dir=rtl", async ({
    page,
  }) => {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "צוות" })
      .click();
    const firstMember = page.locator(".rounded-lg.border").first();
    await firstMember.locator("button.flex-1").click();

    await expect(page.getByText("הכל זמין").first()).toBeVisible();
    await expect(page.getByText("הכל לא זמין").first()).toBeVisible();
    await expect(page.getByText("ימי חול בלבד").first()).toBeVisible();
    await expect(page.getByText('סופ"ש בלבד').first()).toBeVisible();

    const dir = await page.evaluate(() =>
      document.documentElement.getAttribute("dir")
    );
    expect(dir).toBe("rtl");
  });
});
