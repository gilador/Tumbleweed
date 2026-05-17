import { test, expect, Page } from "@playwright/test";
import { installInitScript, waitForApp } from "./helpers";

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

const ROW = ".d-strip-row";
const CLUSTER = '[data-testid="schedule-controls-cluster"]';
// Mirrors section-left-alignment.spec.ts — absorbs sub-pixel rounding at CI DPRs.
const TOLERANCE_PX = 2;

/**
 * Returns the visual start-edge x of `selector` in viewport coordinates,
 * accounting for the element's inline-start padding (so we compare visible
 * content edges, not outer border boxes).
 */
async function visualStartEdge(
  page: Page,
  selector: string
): Promise<{ edge: number; isRtl: boolean }> {
  const el = page.locator(selector);
  await expect(el).toBeVisible();
  const box = await el.boundingBox();
  expect(box).not.toBeNull();
  const { padStartPx, isRtl } = await el.evaluate((node) => {
    const cs = getComputedStyle(node);
    const dir =
      cs.direction === "rtl" || node.closest("[dir='rtl']") !== null;
    const padInlineStartRaw =
      cs.paddingInlineStart || (dir ? cs.paddingRight : cs.paddingLeft);
    return {
      padStartPx: parseFloat(padInlineStartRaw) || 0,
      isRtl: dir,
    };
  });
  const edge = isRtl
    ? box!.x + box!.width - padStartPx
    : box!.x + padStartPx;
  return { edge, isRtl };
}

async function assertClusterStartAligned(page: Page) {
  const row = page.locator(ROW).first();
  const cluster = page.locator(CLUSTER);
  await expect(row).toBeVisible();
  await expect(cluster).toBeVisible();

  const rowBox = await row.boundingBox();
  const clusterBox = await cluster.boundingBox();
  expect(rowBox).not.toBeNull();
  expect(clusterBox).not.toBeNull();

  const { edge: rowStart, isRtl } = await visualStartEdge(page, ROW);
  // For the cluster we read its outer-box start edge (no inner padding on the
  // cluster wrapper itself), then compare to the row's content-start edge.
  const clusterStart = isRtl
    ? clusterBox!.x + clusterBox!.width
    : clusterBox!.x;

  // 1) Cluster center sits in the START half of the row.
  const rowCenter = rowBox!.x + rowBox!.width / 2;
  const clusterCenter = clusterBox!.x + clusterBox!.width / 2;
  if (isRtl) {
    expect(clusterCenter).toBeGreaterThan(rowCenter);
  } else {
    expect(clusterCenter).toBeLessThan(rowCenter);
  }

  // 2) Stricter: cluster's start edge ≈ row's content-start edge (±2px).
  expect(Math.abs(clusterStart - rowStart)).toBeLessThanOrEqual(TOLERANCE_PX);
}

test.describe("Schedule controls cluster start alignment", () => {
  test("controls cluster sits at start side (LTR)", async ({ page }) => {
    await installInitScript(page);
    await waitForApp(page);
    await assertClusterStartAligned(page);
  });

  test("controls cluster sits at start side (RTL)", async ({ page }) => {
    await installHebrewInitScript(page);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
    await assertClusterStartAligned(page);
  });
});
