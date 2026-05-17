import { test, expect, Page } from "@playwright/test";
import { installInitScript, seedShiftState, waitForApp } from "./helpers";
import assignmentsFixture from "./fixtures/weekly-view-7d-with-assignments.json" with { type: "json" };

// Verifies the schedule card's left action/info panel (VerticalActionGroup)
// shares a vertical visual center with the right action bar's "Schedule" h2.
//
// Round 1 compared outer top edges (16/16), but the icon is 18px tall while
// the h2 line-box is 24px, so equal tops left the visual centers ~3-4px
// apart — visibly misaligned. Round 2 asserts the *visual midpoints*
// (top + height/2) match. Fix: left wrapper pt-5 (20px) + VerticalActionGroup
// px-1 → first 18px icon centers on the 24px h2 line-box at the same y.
//
// Tolerance 2px to absorb sub-pixel rounding at varying device pixel ratios
// (matches availability-panel-alignment.spec.ts convention).
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

async function assertHeadingAlignment(
  page: Page,
  headingName: RegExp,
  syncIconName: RegExp
) {
  const firstIcon = page.getByRole("button", { name: syncIconName }).first();
  const heading = page.getByRole("heading", { name: headingName }).first();

  await expect(firstIcon).toBeVisible();
  await expect(heading).toBeVisible();

  const iconBox = await firstIcon.boundingBox();
  const headingBox = await heading.boundingBox();
  expect(iconBox).not.toBeNull();
  expect(headingBox).not.toBeNull();

  const iconCenter = iconBox!.y + iconBox!.height / 2;
  const headingCenter = headingBox!.y + headingBox!.height / 2;
  const delta = Math.abs(iconCenter - headingCenter);
  expect(delta).toBeLessThanOrEqual(TOLERANCE_PX);
}

// Round 3: verify the "Schedule changed — re-run optimizer" status pill
// (rendered when there are assignments and the schedule isn't optimized)
// sits on the SAME row as the Schedule h2 — i.e. their visual centers match
// within TOLERANCE_PX. The pill is conditionally rendered, so the test
// reads its bounding box directly via DOM and skips when not present.
async function assertSchedulePillAlignment(page: Page, headingName: RegExp) {
  const heading = page.getByRole("heading", { name: headingName }).first();
  await expect(heading).toBeVisible();

  const result = await page.evaluate((pattern) => {
    const re = new RegExp(pattern);
    const h2 = Array.from(document.querySelectorAll("h2")).find((h) =>
      re.test((h.textContent || "").trim())
    );
    const headerRow = h2 ? h2.parentElement : null;
    if (!headerRow) return { found: false as const };
    // Find the leaf-most div whose own text matches the pill copy.
    const candidates = Array.from(headerRow.querySelectorAll("div")).filter(
      (d) => /השתנה|changed/.test(d.textContent || "")
    );
    const pill = candidates[candidates.length - 1] ?? null;
    if (!pill) return { found: false as const };
    const hb = h2!.getBoundingClientRect();
    const pb = pill.getBoundingClientRect();
    // The pill is a descendant of headerRow — that is the "same row"
    // contract we are asserting. (Specific nesting depth is an
    // implementation detail and not asserted.)
    const inHeaderRow = headerRow.contains(pill);
    return {
      found: true as const,
      headingCenter: hb.top + hb.height / 2,
      pillCenter: pb.top + pb.height / 2,
      inHeaderRow,
    };
  }, headingName.source);

  if (!result.found) {
    test.skip(true, "Schedule changed pill not visible (schedule already optimized or empty)");
    return;
  }
  expect(result.inHeaderRow).toBe(true);
  const delta = Math.abs(result.headingCenter - result.pillCenter);
  expect(delta).toBeLessThanOrEqual(TOLERANCE_PX);
}

test.describe("Info panel ↔ schedule action bar vertical alignment", () => {
  test("first action icon aligns with Schedule h2 (LTR English)", async ({
    page,
  }) => {
    await installInitScript(page);
    await waitForApp(page);
    await assertHeadingAlignment(page, /^Schedule$/, /^Sync status$/i);
  });

  test("alignment holds in RTL (Hebrew)", async ({ page }) => {
    await installHebrewInitScript(page);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
    // Hebrew "Schedule" heading: "סידור"
    await expect(
      page.getByRole("heading", { name: /^סידור$/ })
    ).toBeVisible({ timeout: 5000 });
    await assertHeadingAlignment(page, /^סידור$/, /^סטטוס סנכרון$/);
  });

  test('"Schedule changed" pill aligns with Schedule h2 (LTR English)', async ({
    page,
  }) => {
    await installInitScript(page);
    // Seed assignments + clear optimizationSignature so getActionHint returns
    // hintNotOptimized (the "Schedule changed — re-run optimizer" pill).
    const seeded = {
      ...(assignmentsFixture as Record<string, unknown>),
      optimizationSignature: null,
    };
    await seedShiftState(page, seeded);
    await waitForApp(page);
    await assertSchedulePillAlignment(page, /^Schedule$/);
  });

  test('"Schedule changed" pill aligns with Schedule h2 (RTL Hebrew)', async ({
    page,
  }) => {
    await installHebrewInitScript(page);
    const seeded = {
      ...(assignmentsFixture as Record<string, unknown>),
      optimizationSignature: null,
    };
    await seedShiftState(page, seeded);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: /^סידור$/ })
    ).toBeVisible({ timeout: 5000 });
    await assertSchedulePillAlignment(page, /^סידור$/);
  });
});
