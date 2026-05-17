import { test, expect, devices, Page } from "@playwright/test";
import {
  installInitScript,
  seedShiftState,
  waitForMobileApp,
} from "./helpers";
import fixture from "./fixtures/weekly-view-7d-with-assignments.json" with { type: "json" };

test.use({ ...devices["Pixel 7"] });

// Group B mobile parity — Posts tab inline intensity panel.
//
// Coverage:
// - Posts tab renders intensity panel inline (no modal) on mobile.
// - Slider hit-boxes ≥ 44px tap target (mobile variant uses w-11 h-11).
// - Undo toast button ≥ 44px tap target.
// - Hebrew RTL: slider labels (מעטות / רבות) render and layout is sane.
// - Confirm + Undo flow with seeded assignments restores prior state.

async function ensureMultipleFeasibleLevels(page: Page) {
  // Add 5 staff so multiple feasible intensity levels exist.
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Staff" })
    .click();
  await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();
  const addFab = page
    .locator("button.fixed")
    .filter({ has: page.locator("svg") });
  for (let i = 0; i < 5; i++) {
    await addFab.click();
    await page.waitForTimeout(100);
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Posts" })
    .click();
  await expect(
    page.getByRole("heading", { name: /^Operation Hours$/ })
  ).toBeVisible();
}

function intensityCard(page: Page) {
  return page
    .locator(".rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: /^Shift Intensity$/ }) })
    .first();
}

test.describe("Mobile Group B — intensity panel on Posts tab", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
  });

  test("Posts tab renders intensity panel inline (no modal)", async ({
    page,
  }) => {
    await waitForMobileApp(page);
    const card = intensityCard(page);
    await expect(card).toBeVisible({ timeout: 4000 });
    await expect(card.getByText(/^Few$/)).toBeVisible();
    await expect(card.getByText(/^Many$/)).toBeVisible();
  });

  test("slider tap targets are ≥ 44px on mobile", async ({ page }) => {
    await waitForMobileApp(page);
    await ensureMultipleFeasibleLevels(page);

    const card = intensityCard(page);
    const ticks = card.locator(".cursor-pointer");
    const count = await ticks.count();
    test.skip(count < 2, "Need ≥ 2 feasible levels");

    for (let i = 0; i < count; i++) {
      const box = await ticks.nth(i).boundingBox();
      expect(box, `tick ${i} should have a bounding box`).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });

  test("undo button has ≥ 44px tap target on mobile", async ({ page }) => {
    await waitForMobileApp(page);
    await ensureMultipleFeasibleLevels(page);

    const card = intensityCard(page);
    const ticks = card.locator(".cursor-pointer");
    test.skip((await ticks.count()) < 2, "Need ≥ 2 feasible levels");

    await ticks.last().click();
    const undoBtn = page.getByRole("button", { name: /^Undo$/ });
    await expect(undoBtn).toBeVisible({ timeout: 2000 });

    const box = await undoBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  });
});

test.describe("Mobile Group B — confirm + undo flow with assignments", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
    await seedShiftState(page, fixture);
  });

  test("confirm dialog appears, Accept then Undo restores prior state", async ({
    page,
  }) => {
    await waitForMobileApp(page);
    const card = intensityCard(page);
    await expect(card).toBeVisible({ timeout: 4000 });

    const ticks = card.locator(".cursor-pointer");
    test.skip((await ticks.count()) < 2, "Need ≥ 2 feasible levels");

    const before = (
      await card.getByText(/Shifts:\s*\d+/).first().textContent()
    )?.match(/\d+/)?.[0];

    await ticks.last().click();

    await expect(
      page.getByRole("heading", { name: /^Change shift count$/ })
    ).toBeVisible({ timeout: 2000 });
    await page.getByRole("button", { name: /^Change shifts$/ }).click();

    const undoBtn = page.getByRole("button", { name: /^Undo$/ });
    await expect(undoBtn).toBeVisible({ timeout: 2000 });

    await undoBtn.click();
    await page.waitForTimeout(400);
    const restored = (
      await card.getByText(/Shifts:\s*\d+/).first().textContent()
    )?.match(/\d+/)?.[0];
    expect(restored).toBe(before);
  });
});

test.describe("Mobile Group B — Hebrew RTL", () => {
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
  });

  test("Posts tab slider labels render in Hebrew with no broken layout", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation")).toBeVisible({ timeout: 10000 });

    const card = page
      .locator(".rounded-lg.border")
      .filter({ has: page.getByRole("heading", { name: /עצימות/ }) })
      .first();
    await expect(card).toBeVisible({ timeout: 4000 });
    await expect(card.getByText("מעטות")).toBeVisible();
    await expect(card.getByText("רבות")).toBeVisible();

    const dir = await page.evaluate(() =>
      document.documentElement.getAttribute("dir")
    );
    expect(dir).toBe("rtl");

    const ticks = card.locator(".cursor-pointer");
    if ((await ticks.count()) >= 2) {
      const firstBox = await ticks.first().boundingBox();
      const lastBox = await ticks.last().boundingBox();
      expect(firstBox).not.toBeNull();
      expect(lastBox).not.toBeNull();
      expect(Math.abs(firstBox!.y - lastBox!.y)).toBeLessThan(4);
    }
  });
});
