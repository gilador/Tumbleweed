import { test, expect, Page } from "@playwright/test";
import { STAFF_ROW, installInitScript, waitForApp } from "./helpers";

// Hebrew variant: forces tumbleweed-lang=he so the app boots in RTL.
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

const SCHEDULE_CONTENT = '[data-testid="schedule-section-content"]';
const STAFF_CONTENT = '[data-testid="staff-section-content"]';
// 2px tolerance mirrors availability-panel-alignment.spec.ts — absorbs
// sub-pixel layout rounding at non-1.0 DPRs while still failing cleanly
// against the pre-fix gap (8px between visible content edges of the two
// section wrappers, before the schedule wrapper's start padding was bumped
// to compensate for the SplitScreen-side `border-primary-rounded-lg` padding).
const TOLERANCE_PX = 2;

async function ensureStaff(page: Page) {
  if ((await page.locator(STAFF_ROW).count()) === 0) {
    await page.getByRole("button", { name: /^Add$/i }).first().click();
    await expect(page.locator(STAFF_ROW).first()).toBeVisible();
  }
}

/**
 * Returns the visual start-edge x of `selector` in viewport coordinates.
 * Accounts for the element's inline-start padding so the comparison reflects
 * the leftmost (LTR) / rightmost (RTL) edge of the *visible content*, not the
 * outer border box (which can sit at the parent's border edge while the
 * element's own padding pushes content inward).
 */
async function visualStartEdge(page: Page, selector: string): Promise<number> {
  const el = page.locator(selector);
  await expect(el).toBeVisible();
  const box = await el.boundingBox();
  expect(box).not.toBeNull();
  const { padStartPx, isRtl } = await el.evaluate((node) => {
    const cs = getComputedStyle(node);
    const dir =
      cs.direction === "rtl" ||
      (node.closest("[dir='rtl']") !== null);
    const padInlineStartRaw = cs.paddingInlineStart || (dir ? cs.paddingRight : cs.paddingLeft);
    return {
      padStartPx: parseFloat(padInlineStartRaw) || 0,
      isRtl: dir,
    };
  });
  return isRtl ? box!.x + box!.width - padStartPx : box!.x + padStartPx;
}

async function assertLeftEdgeAlignment(page: Page) {
  const scheduleEdge = await visualStartEdge(page, SCHEDULE_CONTENT);
  const staffEdge = await visualStartEdge(page, STAFF_CONTENT);
  const delta = Math.abs(scheduleEdge - staffEdge);
  expect(delta).toBeLessThanOrEqual(TOLERANCE_PX);
}

test.describe("Schedule and Staff section left-edge alignment", () => {
  test("schedule and staff content share start edge (LTR)", async ({
    page,
  }) => {
    await installInitScript(page);
    await waitForApp(page);
    await ensureStaff(page);
    await assertLeftEdgeAlignment(page);
  });

  test("alignment holds in RTL (Hebrew)", async ({ page }) => {
    await installHebrewInitScript(page);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
    await ensureStaff(page);
    await assertLeftEdgeAlignment(page);
  });
});
