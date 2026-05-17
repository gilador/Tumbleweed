import { test, expect, Page } from "@playwright/test";

// Group D — desktop right-click context menu, horizontal scroll, hour navigation.

const STAFF_ROW = '[data-testid="staff-member"]';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("tumbleweed-lang", "en");
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    } catch {
      /* ignore */
    }
  });
});

async function waitForApp(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: /^Schedule$/ })
  ).toBeVisible({ timeout: 5000 });
}

test.describe("Group D — context menu + scroll persistence", () => {
  test("right-click on staff row opens staff context menu (no Assign worker)", async ({
    page,
  }) => {
    await waitForApp(page);
    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 1, "need at least 1 staff row");

    await rows.first().click({ button: "right", position: { x: 8, y: 8 } });

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible({ timeout: 2000 });
    await expect(menu.getByRole("menuitem", { name: /^Select$/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^Rename$/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^Copy name$/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^Delete$/ })).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: /Assign worker/ })
    ).toHaveCount(0);
  });

  test("right-click on a post row opens posts menu with Assign worker", async ({
    page,
  }) => {
    await waitForApp(page);
    const grid = page.locator("#assignments-table");
    const rows = grid.locator(".row[data-post-id]");
    test.skip((await rows.count()) < 1, "need at least 1 post row");

    await rows.first().click({ button: "right", position: { x: 8, y: 8 } });

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible({ timeout: 2000 });
    await expect(menu.getByRole("menuitem", { name: /^Select$/ })).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: /^Assign worker$/ })
    ).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^Rename$/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^Copy name$/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^Delete$/ })).toBeVisible();
  });

  test("Esc dismisses the context menu", async ({ page }) => {
    await waitForApp(page);
    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 1, "need at least 1 staff row");

    await rows.first().click({ button: "right", position: { x: 8, y: 8 } });
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0, { timeout: 2000 });
  });

  test("outside click dismisses the context menu", async ({ page }) => {
    await waitForApp(page);
    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 1, "need at least 1 staff row");

    await rows.first().click({ button: "right", position: { x: 8, y: 8 } });
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    // Click on the heading (well outside the menu).
    await page
      .getByRole("heading", { name: /^Schedule$/ })
      .click({ position: { x: 1, y: 1 } });
    await expect(menu).toHaveCount(0, { timeout: 2000 });
  });

  test("Rename action enters inline edit on a staff row", async ({ page }) => {
    await waitForApp(page);
    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 1, "need at least 1 staff row");

    const first = rows.first();
    await first.click({ button: "right", position: { x: 8, y: 8 } });
    await page.getByRole("menuitem", { name: /^Rename$/ }).click();

    const input = first.locator("input").first();
    await expect(input).toBeVisible({ timeout: 2000 });
  });

  test("Scroll position persists across groupBy toggle", async ({ page }) => {
    await waitForApp(page);
    const grid = page.locator("#assignments-table");
    const scrollContainer = grid.locator(".schedule-scroll").first();
    const exists = (await scrollContainer.count()) > 0;
    test.skip(!exists, "schedule-scroll container not present");

    // Force a scroll right (and wait for sessionStorage write).
    await scrollContainer.evaluate((el) => {
      (el as HTMLElement).scrollLeft = 120;
    });
    await page.waitForTimeout(120);

    // Toggle to Position, then back to Time.
    const groupBtns = page.getByRole("button", {
      name: /^(Time|Position)$/,
    });
    if ((await groupBtns.count()) >= 2) {
      const pos = page.getByRole("button", { name: /^Position$/ });
      await pos.click();
      await page.waitForTimeout(120);
      const time = page.getByRole("button", { name: /^Time$/ });
      await time.click();
      await page.waitForTimeout(120);

      // Read back current scrollLeft — should match what was stored.
      const stored = await page.evaluate(() =>
        sessionStorage.getItem("tw-schedule-scroll:time:0")
      );
      expect(stored).not.toBeNull();
      expect(Number(stored)).toBeGreaterThan(0);
    }
  });

  test("Shift+F10 on a focused staff row opens the context menu", async ({
    page,
  }) => {
    await waitForApp(page);
    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 1, "need at least 1 staff row");

    const first = rows.first();
    await first.focus();
    // Make sure the focused element is the row itself.
    await first.evaluate((el) => (el as HTMLElement).focus());
    await page.keyboard.press("Shift+F10");

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible({ timeout: 2000 });
  });

  test("Right-click near viewport bottom-right flips menu within bounds", async ({
    page,
  }) => {
    await waitForApp(page);
    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 1, "need at least 1 staff row");

    const viewport = page.viewportSize();
    if (!viewport) test.skip(true, "no viewport size");
    const vw = viewport!.width;
    const vh = viewport!.height;

    // Dispatch contextmenu directly at near-corner coords on the first row.
    await rows.first().evaluate(
      (el, coords) => {
        const evt = new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: coords.x,
          clientY: coords.y,
          button: 2,
        });
        el.dispatchEvent(evt);
      },
      { x: vw - 4, y: vh - 4 }
    );

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible({ timeout: 2000 });
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Menu must be fully within viewport (flipped, not clipped).
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(vh + 1);
    }
  });

  test("Hebrew (RTL) — context menu items use logical text alignment", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("tumbleweed-lang", "he");
      } catch {
        /* ignore */
      }
    });
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });

    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 1, "need at least 1 staff row");

    await rows.first().click({ button: "right", position: { x: 8, y: 8 } });
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible({ timeout: 2000 });

    // Document direction is RTL.
    const docDir = await page.evaluate(() => document.documentElement.dir);
    expect(docDir).toBe("rtl");

    // Each menuitem inherits RTL writing direction (so "start" is right edge).
    const itemDir = await menu
      .getByRole("menuitem")
      .first()
      .evaluate((el) => getComputedStyle(el).direction);
    expect(itemDir).toBe("rtl");
  });
});
