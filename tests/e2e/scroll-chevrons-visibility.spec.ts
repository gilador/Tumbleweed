import { test, expect, type Page } from "@playwright/test";
import { LOCAL_STORAGE_KEY } from "../../src/lib/localStorageUtils";

// Quick-scroll chevrons must NOT be clipped by an ancestor's `overflow:hidden`.
//
// Negative-control protocol (mandatory, per architect plan R2.1):
//   To prove this spec catches the bug, revert the four `overflow-hidden`
//   removals in `packages/core/src/components/ShiftManager.tsx` (Card L363,
//   CardContent L395, #assignments-table L398, #staff_section L639) and run
//   this spec. The `elementFromPoint` occlusion assertion in
//   `assertChevronNotClipped` MUST fail on at least one chevron. If it passes
//   on the buggy code, the seed/scroll setup is not producing the clipped
//   state — fix the seed before relying on the test.
//
// Implementation notes:
//   - bbox-only checks are insufficient: `getBoundingClientRect` reports the
//     geometric box even when an ancestor `overflow:hidden` paints zero
//     pixels inside it. We use `document.elementFromPoint(cx, cy)` at the
//     chevron's center and accept either the button itself or any descendant
//     (the chevron's `<svg>` / `<path>` is the actual hit target).
//   - The viewport-containment bbox check is retained as a cheap sanity but
//     is NOT the primary assertion.

const CHEVRONS = [
  "schedule-scroll-start",
  "schedule-scroll-end",
  "staff-scroll-up",
  "staff-scroll-down",
] as const;

type ChevronId = (typeof CHEVRONS)[number];

// Build a fixture that guarantees BOTH horizontal schedule overflow (24h mode,
// 12 hours → 12 cards × 320px = 3840px > viewport) AND vertical staff-list
// overflow (40 staff at ~50px each ≈ 2000px > the 40% staff section).
function buildOverflowingFixture() {
  const posts = [
    { id: "post-1", value: "Post 1" },
    { id: "post-2", value: "Post 2" },
  ];
  const hours = Array.from({ length: 12 }, (_, i) => {
    const hh = String(8 + i).padStart(2, "0");
    return { id: `h-${i}`, value: `${hh}:00` };
  });
  const userShiftData = Array.from({ length: 40 }, (_, i) => {
    const id = `worker-overflow-${i}`;
    const constraints = posts.map((p) =>
      hours.map((h) => ({ postID: p.id, hourID: h.id, availability: true }))
    );
    return {
      user: { id, name: `Staff ${i + 1}` },
      constraints,
      constraintsByRoster: { "default-roster": constraints },
      totalAssignments: 0,
    };
  });
  return {
    rosters: [
      {
        id: "default-roster",
        name: "",
        posts,
        hours,
        assignments: posts.map(() => hours.map(() => null)),
        manuallyEditedSlots: {},
        customCellDisplayNames: {},
        scheduleMode: "24h",
        startTime: "08:00",
        endTime: "20:00",
        startDate: null,
        cachedWeeklyState: null,
      },
    ],
    activeRosterId: "default-roster",
    userShiftData,
    hasInitialized: true,
    selectedShiftCount: hours.length,
    optimizationSignature: "",
  };
}

async function installInitScriptForLang(page: Page, lang: "en" | "he") {
  await page.addInitScript((language) => {
    try {
      localStorage.clear();
      localStorage.setItem("tumbleweed-lang", language);
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    } catch {
      /* ignore */
    }
  }, lang);
}

async function seedFixture(page: Page, fixture: object) {
  await page.addInitScript(
    ({ key, state }) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    },
    { key: LOCAL_STORAGE_KEY, state: fixture }
  );
}

async function gotoApp(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#assignments-table")).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator("#staff_section")).toBeVisible({ timeout: 10000 });
}

// Scroll the schedule horizontally and the staff list vertically so all four
// chevrons are render-gated true (canScrollStart/End/Up/Down).
async function midScrollBothAxes(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector(".schedule-scroll") as HTMLElement | null;
    if (el) {
      const range = el.scrollWidth - el.clientWidth;
      const mid = Math.max(1, Math.floor(range / 2));
      // RTL Chromium reports scrollLeft as <= 0; production code uses Math.abs.
      const isRtl = getComputedStyle(el).direction === "rtl";
      el.scrollLeft = isRtl ? -mid : mid;
      el.dispatchEvent(new Event("scroll"));
    }
    const s = document.querySelector(
      '[data-testid="staff-section-content"]'
    ) as HTMLElement | null;
    if (s) {
      s.scrollTop = Math.max(
        1,
        Math.floor((s.scrollHeight - s.clientHeight) / 2)
      );
      s.dispatchEvent(new Event("scroll"));
    }
  });
}

async function assertChevronNotClipped(page: Page, testId: ChevronId) {
  const button = page.getByTestId(testId);
  await expect(button).toBeVisible();

  const box = await button.boundingBox();
  expect(box).toBeTruthy();

  // Viewport-containment (cheap sanity; not sufficient on its own — bbox is
  // still inside the viewport on the buggy code).
  const vp = page.viewportSize();
  expect(vp).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp!.height);

  // PRIMARY: the chevron's center pixel is actually paintable. This catches
  // both ancestor `overflow:hidden` clipping AND z-index occlusion. SVG
  // descendants are accepted via `el.contains(hit)`.
  const handle = await button.elementHandle();
  expect(handle).toBeTruthy();
  const ok = await page.evaluate((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    const cx = Math.round(r.x + r.width / 2);
    const cy = Math.round(r.y + r.height / 2);
    const hit = document.elementFromPoint(cx, cy) as Element | null;
    return !!hit && (hit === el || (el as HTMLElement).contains(hit));
  }, handle);
  expect(ok).toBe(true);
}

for (const lang of ["en", "he"] as const) {
  test.describe(`Quick-scroll chevrons — ${lang}`, () => {
    test.beforeEach(async ({ page }) => {
      await installInitScriptForLang(page, lang);
      await seedFixture(page, buildOverflowingFixture());
      await gotoApp(page);
      await midScrollBothAxes(page);
      // Wait for at least one chevron from each axis to render.
      await expect(
        page
          .getByTestId("schedule-scroll-start")
          .or(page.getByTestId("schedule-scroll-end"))
          .first()
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page
          .getByTestId("staff-scroll-up")
          .or(page.getByTestId("staff-scroll-down"))
          .first()
      ).toBeVisible({ timeout: 5000 });
    });

    for (const id of CHEVRONS) {
      test(`${id} is fully visible and not clipped`, async ({ page }) => {
        await assertChevronNotClipped(page, id);
      });
    }

    // AC6 + AC7: clicking the chevron triggers its handler (the underlying
    // scroller actually moves) AND the chevron hides at the scroll extreme.
    test("schedule-scroll-start click scrolls and toggles visibility", async ({
      page,
    }) => {
      const startBtn = page.getByTestId("schedule-scroll-start");
      await expect(startBtn).toBeVisible();
      const before = await page.evaluate(() => {
        const el = document.querySelector(
          ".schedule-scroll"
        ) as HTMLElement | null;
        return el ? Math.abs(el.scrollLeft) : -1;
      });
      await startBtn.click();
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => {
        const el = document.querySelector(
          ".schedule-scroll"
        ) as HTMLElement | null;
        return el ? Math.abs(el.scrollLeft) : -1;
      });
      expect(after).toBeLessThan(before);
    });

    test("staff-scroll-up click scrolls and toggles visibility", async ({
      page,
    }) => {
      const upBtn = page.getByTestId("staff-scroll-up");
      await expect(upBtn).toBeVisible();
      const before = await page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="staff-section-content"]'
        ) as HTMLElement | null;
        return el ? el.scrollTop : -1;
      });
      await upBtn.click();
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="staff-section-content"]'
        ) as HTMLElement | null;
        return el ? el.scrollTop : -1;
      });
      expect(after).toBeLessThan(before);
    });
  });
}
