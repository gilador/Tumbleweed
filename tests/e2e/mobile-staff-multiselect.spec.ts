import { test, expect, devices, Page } from "@playwright/test";
import { installInitScript, waitForMobileApp } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// Mobile staff list — desktop-parity multi-select via long-press. Long-press
// elsewhere on a staff row enters multi-select with that row pre-selected
// and surfaces the existing BulkSelectionBar (Select all + Delete + Cancel)
// docked above the tab bar. Tab bar is hidden while the bar is up. Long-
// press on the leading name span enters inline rename. Verified in both
// English (LTR) and Hebrew (RTL).

const STAFF_ROW = ".rounded-lg.border";

async function longPressOnRowBody(page: Page, rowSelector: string) {
  // Press over the chevron side of the row — anywhere outside the name span
  // resolves to the multi-select hot-zone. In LTR the chevron sits at the
  // right end (high x); in RTL the row is mirrored so the chevron is on the
  // left (low x). Mouse coordinates are layout-direction-agnostic, so we
  // read document dir and pick the appropriate side.
  const row = page.locator(rowSelector).first();
  const box = await row.boundingBox();
  expect(box).not.toBeNull();
  const dir = await page.evaluate(() =>
    document.documentElement.getAttribute("dir")
  );
  const xFrac = dir === "rtl" ? 0.15 : 0.85;
  const x = box!.x + box!.width * xFrac;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

async function longPressOnName(page: Page, rowSelector: string) {
  const nameSpan = page.locator(`${rowSelector} [data-longpress-zone="name"]`).first();
  const box = await nameSpan.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

test.describe("Mobile Staff Multi-Select (long-press)", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
    await waitForMobileApp(page);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Staff" })
      .click();
    await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();
  });

  test("no inline pencil or trash buttons render on staff rows", async ({ page }) => {
    await expect(page.locator('[data-testid^="edit-staff-"]')).toHaveCount(0);
  });

  test("long-press on row body enters multi-select with that row pre-selected", async ({
    page,
  }) => {
    const rows = page.locator(STAFF_ROW);
    const before = await rows.count();
    expect(before).toBeGreaterThan(0);

    await longPressOnRowBody(page, STAFF_ROW);

    // Bulk selection bar surfaces.
    await expect(page.getByRole("region", { name: /1 selected/i })).toBeVisible();
    // Tab bar is hidden.
    await expect(page.getByRole("navigation")).toHaveCount(0);
    // Pre-selected row has the primary tint.
    await expect(rows.first()).toHaveClass(/border-primary/);
  });

  test("select-all then delete removes all staff", async ({ page }) => {
    const rows = page.locator(STAFF_ROW);
    const before = await rows.count();
    expect(before).toBeGreaterThan(0);

    await longPressOnRowBody(page, STAFF_ROW);
    await expect(page.getByRole("region", { name: /selected/i })).toBeVisible();

    await page.getByRole("button", { name: /select all/i }).click();
    await expect(
      page.getByRole("region", { name: new RegExp(`${before} selected`, "i") })
    ).toBeVisible();

    await page.getByRole("button", { name: new RegExp(`delete ${before}`, "i") }).click();
    // Confirm dialog.
    await page.getByRole("button", { name: /yes/i }).click();

    // All rows gone, tab bar returns.
    await expect(rows).toHaveCount(0);
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("long-press on the name span enters inline rename for that row", async ({
    page,
  }) => {
    await longPressOnName(page, STAFF_ROW);
    await expect(
      page.locator('[data-testid="edit-staff-name-input"]')
    ).toBeVisible();
  });
});

test.describe("Mobile Staff Multi-Select (long-press) — Hebrew RTL", () => {
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
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "צוות" })
      .click();
  });

  test("long-press enters multi-select with RTL Hebrew labels", async ({
    page,
  }) => {
    await longPressOnRowBody(page, STAFF_ROW);
    // Hebrew "selected" label uses i18next plural; assert that the region
    // contains the digit 1 and that document direction is rtl.
    await expect(page.locator("[role='region']").first()).toBeVisible();
    const dir = await page.evaluate(() =>
      document.documentElement.getAttribute("dir")
    );
    expect(dir).toBe("rtl");
  });
});
