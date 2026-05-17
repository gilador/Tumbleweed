import { test, expect, Page, Locator } from "@playwright/test";
import {
  installInitScript,
  seedShiftState,
  waitForApp,
} from "./helpers";
import fixture from "./fixtures/weekly-view-7d-with-assignments.json" with { type: "json" };

// Group B — desktop Shift Settings intensity model.
//
// Coverage:
// - Open Shift Settings; panel renders artifact layout (slider, stats, how-it-works).
// - Without assignments → no confirm dialog; change applies immediately + undo toast.
// - With seeded assignments → confirm dialog opens (Cancel preserves; Accept changes).
// - Undo within 8s restores prior state; toast disappears after 8s expiry.
// - Rapid double-change: only the second snapshot is undoable (last-write-wins).
// - Hebrew RTL: slider labels translate (מעטות / רבות) without breaking layout.

const SETTINGS_PANEL_HEADING = /^Shift Configuration$/;

async function openDesktopShiftSettings(page: Page): Promise<Locator> {
  const toggle = page.getByRole("button", {
    name: /^Show shift configuration$/,
  });
  await expect(toggle).toBeVisible({ timeout: 5000 });
  await toggle.click();
  await expect(
    page.getByRole("heading", { name: SETTINGS_PANEL_HEADING })
  ).toBeVisible({ timeout: 4000 });
  return page
    .locator(".rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: /^Shift Intensity$/ }) })
    .first();
}

test.describe("Group B — desktop Shift Settings intensity (no assignments)", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
  });

  test("opens Shift Settings panel with slider, stats, and how-it-works", async ({
    page,
  }) => {
    await waitForApp(page);
    const card = await openDesktopShiftSettings(page);

    await expect(card.getByRole("heading", { name: /^Shift Intensity$/ }))
      .toBeVisible();
    await expect(card.getByText(/^Few$/)).toBeVisible();
    await expect(card.getByText(/^Many$/)).toBeVisible();
    await expect(card.getByText(/Shifts:\s*\d+/)).toBeVisible();
    await expect(card.getByText(/How it works/i)).toBeVisible();
  });

  test("changing intensity without assignments applies immediately + shows undo toast", async ({
    page,
  }) => {
    await waitForApp(page);
    const card = await openDesktopShiftSettings(page);

    const ticks = card.locator(".cursor-pointer");
    const tickCount = await ticks.count();
    test.skip(
      tickCount < 2,
      "Need at least 2 feasible levels to switch between"
    );

    const before = await card.getByText(/Shifts:\s*\d+/).first().textContent();
    await ticks.last().click();

    // No confirm dialog — assignments are empty.
    await expect(
      page.getByRole("heading", { name: /^Change shift count$/ })
    ).toHaveCount(0);

    await expect(card.getByText(/Shifts:\s*\d+/).first()).not.toHaveText(
      before ?? "",
      { timeout: 2000 }
    );

    await expect(page.getByText(/^Changed to \d+ shifts$/)).toBeVisible({
      timeout: 2000,
    });
    await expect(page.getByRole("button", { name: /^Undo$/ })).toBeVisible();
  });
});

test.describe("Group B — desktop Shift Settings intensity (with assignments)", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
    await seedShiftState(page, fixture);
  });

  test("Cancel on confirm dialog preserves shift count", async ({ page }) => {
    await waitForApp(page);
    const card = await openDesktopShiftSettings(page);

    const ticks = card.locator(".cursor-pointer");
    test.skip((await ticks.count()) < 2, "Need ≥ 2 feasible levels");

    const before = await card.getByText(/Shifts:\s*\d+/).first().textContent();
    await ticks.last().click();

    await expect(
      page.getByRole("heading", { name: /^Change shift count$/ })
    ).toBeVisible({ timeout: 2000 });
    await expect(page.getByText(/will change to \d+ shifts/i)).toBeVisible();

    await page.getByRole("button", { name: /^Keep current$/ }).click();

    await expect(
      page.getByRole("heading", { name: /^Change shift count$/ })
    ).toHaveCount(0, { timeout: 2000 });
    await expect(card.getByText(/Shifts:\s*\d+/).first()).toHaveText(
      before ?? ""
    );
    await expect(page.getByRole("button", { name: /^Undo$/ })).toHaveCount(0);
  });

  test("Accept then Undo within 8s restores prior shift count", async ({
    page,
  }) => {
    await waitForApp(page);
    const card = await openDesktopShiftSettings(page);

    const ticks = card.locator(".cursor-pointer");
    test.skip((await ticks.count()) < 2, "Need ≥ 2 feasible levels");

    const before = await card.getByText(/Shifts:\s*\d+/).first().textContent();
    await ticks.last().click();
    await page.getByRole("button", { name: /^Change shifts$/ }).click();

    const undoBtn = page.getByRole("button", { name: /^Undo$/ });
    await expect(undoBtn).toBeVisible({ timeout: 2000 });
    await expect(card.getByText(/Shifts:\s*\d+/).first()).not.toHaveText(
      before ?? ""
    );

    await undoBtn.click();

    await expect(undoBtn).toHaveCount(0, { timeout: 2000 });
    await expect(card.getByText(/Shifts:\s*\d+/).first()).toHaveText(
      before ?? "",
      { timeout: 4000 }
    );
  });

  test("undo toast disappears after the 8s timeout (snapshot dropped)", async ({
    page,
  }) => {
    await waitForApp(page);
    const card = await openDesktopShiftSettings(page);

    const ticks = card.locator(".cursor-pointer");
    test.skip((await ticks.count()) < 2, "Need ≥ 2 feasible levels");

    await ticks.last().click();
    await page.getByRole("button", { name: /^Change shifts$/ }).click();

    const undoBtn = page.getByRole("button", { name: /^Undo$/ });
    await expect(undoBtn).toBeVisible({ timeout: 2000 });

    // Wait past the 8s expiry.
    await page.waitForTimeout(8800);
    await expect(undoBtn).toHaveCount(0);
  });

  test("rapid double-change: only the second snapshot is the active undo", async ({
    page,
  }) => {
    await waitForApp(page);
    const card = await openDesktopShiftSettings(page);

    const ticks = card.locator(".cursor-pointer");
    const tickCount = await ticks.count();
    test.skip(tickCount < 3, "Need ≥ 3 feasible levels for double-change");

    const initialShifts = (
      await card.getByText(/Shifts:\s*\d+/).first().textContent()
    )?.match(/\d+/)?.[0];

    // First change — confirm.
    await ticks.last().click();
    await page.getByRole("button", { name: /^Change shifts$/ }).click();
    await expect(page.getByRole("button", { name: /^Undo$/ })).toBeVisible({
      timeout: 2000,
    });
    const intermediate = (
      await card.getByText(/Shifts:\s*\d+/).first().textContent()
    )?.match(/\d+/)?.[0];

    // Second change — confirm if dialog appears (assignments may already be
    // cleared by the first change, so confirm may be skipped).
    await ticks.first().click();
    const secondConfirm = page.getByRole("button", { name: /^Change shifts$/ });
    if (await secondConfirm.count()) {
      await secondConfirm.click();
    }
    await expect(page.getByRole("button", { name: /^Undo$/ })).toBeVisible({
      timeout: 2000,
    });

    const finalShifts = (
      await card.getByText(/Shifts:\s*\d+/).first().textContent()
    )?.match(/\d+/)?.[0];
    // Sanity: the second click did move us off the intermediate value
    // (otherwise the snapshot/undo distinction can't be tested).
    expect(finalShifts).not.toBe(intermediate);

    // Undo restores the SECOND snapshot (intermediate), not the original.
    await page.getByRole("button", { name: /^Undo$/ }).click();
    await page.waitForTimeout(400);
    const restored = (
      await card.getByText(/Shifts:\s*\d+/).first().textContent()
    )?.match(/\d+/)?.[0];
    expect(restored).toBe(intermediate);
    // The original (initialShifts) was never restored — it's no longer in the
    // active undo, confirming last-write-wins.
    if (initialShifts !== intermediate) {
      expect(restored).not.toBe(initialShifts);
    }
  });
});

test.describe("Group B — Hebrew RTL on desktop", () => {
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

  test("desktop slider labels render in Hebrew with no broken layout", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });

    // Hebrew toolbar toggle aria-label (showShiftAdjustment / hideShiftAdjustment).
    const toggle = page.locator(
      'button[aria-label="הצג הגדרות משמרת"], button[aria-label="הסתר הגדרות משמרת"]'
    );
    await expect(toggle.first()).toBeVisible({ timeout: 5000 });
    await toggle.first().click();

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

    // Layout sanity: slider ticks live on a single row (within ~4px).
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
