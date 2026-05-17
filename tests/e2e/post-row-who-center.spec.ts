import { test, expect, Page } from "@playwright/test";
import { installInitScript, waitForApp } from "./helpers";

// CEO directive bbox probe: in schedule card rows the WhoCell's leading edge
// must land within ±2px of the row's horizontal midpoint, in both LTR and
// RTL, in both Time (TimeViewPostRow) and Position (PostCard) groupings.
//
// Per feedback_rtl_bidi_visual_verify: RTL bidi quirks make eyeballing
// alignment unreliable; always probe getBoundingClientRect in both locales.

const TOLERANCE_PX = 2;

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

async function assertNameVisibleInsideWhoCell(page: Page) {
  // Round 2 regression guard: removing `max-w-[30%]` from WhoCell allows
  // the truncated name span next to the avatar to render with non-zero
  // width. Pre-fix, the cap collapsed it to 0 — only the avatar was visible.
  // We probe a non-empty WhoCell (`.who:not(.empty)`) since empty-state cells
  // intentionally render no name.
  const grid = page.locator("#assignments-table");
  const assignedWho = grid
    .locator(".row[data-post-id] .who:not(.empty)")
    .first();
  const count = await assignedWho.count();
  if (count === 0) {
    // No assignments in the seeded state — name-visibility assertion is N/A.
    return;
  }
  await expect(assignedWho).toBeVisible();
  const nameSpan = assignedWho.locator("span.truncate").first();
  await expect(nameSpan).toBeVisible();
  const nameBox = await nameSpan.boundingBox();
  expect(nameBox).not.toBeNull();
  expect(nameBox!.width).toBeGreaterThan(0);
  const text = (await nameSpan.textContent())?.trim() ?? "";
  expect(text.length).toBeGreaterThan(0);
}

async function assertWhoCellCenteredLTR(page: Page) {
  const grid = page.locator("#assignments-table");
  await expect(grid).toBeVisible();
  const row = grid.locator(".row[data-post-id]").first();
  await expect(row).toBeVisible();
  const who = row.locator(".who").first();
  await expect(who).toBeVisible();
  const rowBox = await row.boundingBox();
  const whoBox = await who.boundingBox();
  expect(rowBox).not.toBeNull();
  expect(whoBox).not.toBeNull();
  const rowCenterX = rowBox!.x + rowBox!.width / 2;
  // LTR: WhoCell's leading edge is its left edge.
  const delta = Math.abs(whoBox!.x - rowCenterX);
  expect(delta).toBeLessThanOrEqual(TOLERANCE_PX);
  await assertNameVisibleInsideWhoCell(page);
}

async function assertWhoCellCenteredRTL(page: Page) {
  const grid = page.locator("#assignments-table");
  await expect(grid).toBeVisible();
  const row = grid.locator(".row[data-post-id]").first();
  await expect(row).toBeVisible();
  const who = row.locator(".who").first();
  await expect(who).toBeVisible();
  const rowBox = await row.boundingBox();
  const whoBox = await who.boundingBox();
  expect(rowBox).not.toBeNull();
  expect(whoBox).not.toBeNull();
  const rowCenterX = rowBox!.x + rowBox!.width / 2;
  // RTL: WhoCell's leading edge is its right edge.
  const whoRight = whoBox!.x + whoBox!.width;
  const delta = Math.abs(whoRight - rowCenterX);
  expect(delta).toBeLessThanOrEqual(TOLERANCE_PX);
  await assertNameVisibleInsideWhoCell(page);
}

async function switchToPositionView(page: Page) {
  const grid = page.locator("#assignments-table");
  const postBtn = grid.locator('button[data-group="post"]');
  await postBtn.click();
  await expect(postBtn).toHaveAttribute("aria-pressed", "true");
}

test.describe("Schedule card row: WhoCell leading edge sits at row midpoint", () => {
  test("Time view, LTR — WhoCell.left aligns with row center ±2px", async ({
    page,
  }) => {
    await installInitScript(page);
    await waitForApp(page);
    await assertWhoCellCenteredLTR(page);
  });

  test("Position view, LTR — WhoCell.left aligns with row center ±2px", async ({
    page,
  }) => {
    await installInitScript(page);
    await waitForApp(page);
    await switchToPositionView(page);
    await assertWhoCellCenteredLTR(page);
  });

  test("Time view, RTL (Hebrew) — WhoCell.right aligns with row center ±2px", async ({
    page,
  }) => {
    await installHebrewInitScript(page);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe("rtl");
    await assertWhoCellCenteredRTL(page);
  });

  test("Position view, RTL (Hebrew) — WhoCell.right aligns with row center ±2px", async ({
    page,
  }) => {
    await installHebrewInitScript(page);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe("rtl");
    await switchToPositionView(page);
    await assertWhoCellCenteredRTL(page);
  });
});
