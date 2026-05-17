import { test, expect, type Page } from "@playwright/test";
import { LOCAL_STORAGE_KEY } from "../../src/lib/localStorageUtils";

// Round-2 regression suite for fix-availability-table-overflow-no-horizontal-scroll.
//
// Three CEO-reported regressions, all rooted in: the prior scroll-chevron task
// removed `overflow-hidden` from Card / CardContent / `#assignments-table` /
// `#staff_section`, which let flex children take their content's min-content
// width and push the whole layout past the viewport. The fix adds `min-w-0` to
// those flex wrappers, plus `w-max min-w-full` to the heatmap's grid wrapper
// so its horizontal scroll actually exposes the last column.
//
// Each assertion is "boundingBox().width > 0 AND box.x + box.width <= viewport.width"
// per the CEO directive — geometric box-only checks are sufficient because the
// failing state has buttons rendered far off-screen (right edge well past
// viewport).

const VIEWPORT = { width: 1024, height: 800 };

function buildLongHoursFixture() {
  // 14 half-hour slots starting at 08:00; 16 staff; 3 posts. 24h mode.
  return {
    rosters: [
      {
        id: "default-roster",
        name: "",
        posts: [
          { id: "post-1", value: "Bar" },
          { id: "post-2", value: "Kitchen" },
          { id: "post-3", value: "Door" },
        ],
        hours: Array.from({ length: 14 }, (_, i) => {
          const totalMin = 8 * 60 + i * 30;
          const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
          const mm = String(totalMin % 60).padStart(2, "0");
          return { id: `h-${i}`, value: `${hh}:${mm}` };
        }),
        assignments: Array.from({ length: 3 }, () =>
          Array.from({ length: 14 }, () => null)
        ),
        manuallyEditedSlots: {},
        customCellDisplayNames: {},
        scheduleMode: "24h",
        startTime: "08:00",
        endTime: "15:00",
        startDate: null,
        cachedWeeklyState: null,
      },
    ],
    activeRosterId: "default-roster",
    userShiftData: Array.from({ length: 16 }, (_, i) => {
      const id = `member-${i + 1}`;
      const constraints = [0, 1, 2].map((p) =>
        Array.from({ length: 14 }, (_, h) => ({
          postID: `post-${p + 1}`,
          hourID: `h-${h}`,
          availability: true,
        }))
      );
      return {
        user: { id, name: `Member ${i + 1}` },
        constraints,
        constraintsByRoster: { "default-roster": constraints },
        totalAssignments: 0,
      };
    }),
    hasInitialized: true,
    selectedShiftCount: 14,
    optimizationSignature: "",
  };
}

async function installLangAndFixture(
  page: Page,
  lang: "en" | "he",
  fixture: object
) {
  await page.addInitScript((language) => {
    try {
      localStorage.clear();
      localStorage.setItem("tumbleweed-lang", language);
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    } catch {
      /* ignore */
    }
  }, lang);
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
  await expect(page.locator("#assignments-table")).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator("#staff_section")).toBeVisible({ timeout: 10000 });
}

for (const lang of ["en", "he"] as const) {
  test.describe(`Round-2 viewport containment — ${lang}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORT);
      await installLangAndFixture(page, lang, buildLongHoursFixture());
      await gotoApp(page);
    });

    test("BulkSelectionBar action buttons all fit inside the viewport with 1 staff selected", async ({
      page,
    }) => {
      // Click the first staff row to enter multi-select with 1 selected.
      await page.locator('[data-testid="staff-member"]').first().click();

      // Locate the inline bar inside the staff-controls-row.
      const bar = page
        .locator('[data-testid="staff-controls-row"]')
        .getByRole("region");
      await expect(bar).toBeVisible({ timeout: 5000 });

      const buttons = bar.locator("button");
      const count = await buttons.count();
      // Bar must render all three action buttons (Select all, Delete N, Cancel)
      // — not just the count pill.
      expect(count).toBe(3);

      for (let i = 0; i < count; i++) {
        const btn = buttons.nth(i);
        const box = await btn.boundingBox();
        expect(box, `button #${i} boundingBox`).not.toBeNull();
        expect(box!.width).toBeGreaterThan(0);
        expect(box!.height).toBeGreaterThan(0);
        // Both edges within viewport (LTR and RTL).
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORT.width + 1);
      }
    });

    test("leading and trailing chips in the time-quick-nav strip fit inside the viewport at both scroll extremes", async ({
      page,
    }) => {
      const strip = page
        .locator(
          ".flex.gap-1\\.5.mb-2.overflow-x-auto.py-1.scroll-smooth"
        )
        .first();
      await expect(strip).toBeVisible({ timeout: 5000 });

      // Scroll to start; assert leading chip is fully inside viewport.
      await strip.evaluate((el) => {
        (el as HTMLElement).scrollTo({ left: 0, behavior: "instant" as ScrollBehavior });
      });
      const firstChip = strip.locator(":scope > button").first();
      const lastChip = strip.locator(":scope > button").last();

      const firstBox = await firstChip.boundingBox();
      expect(firstBox).not.toBeNull();
      expect(firstBox!.width).toBeGreaterThan(0);
      expect(firstBox!.x).toBeGreaterThanOrEqual(0);
      expect(firstBox!.x + firstBox!.width).toBeLessThanOrEqual(
        VIEWPORT.width + 1
      );

      // Scroll to end; assert trailing chip is fully inside viewport. In RTL
      // Chromium reports scrollLeft as <= 0 with the "end" being a negative
      // scrollLeft of -(scrollWidth - clientWidth).
      await strip.evaluate((el) => {
        const e = el as HTMLElement;
        const range = e.scrollWidth - e.clientWidth;
        const isRtl = getComputedStyle(e).direction === "rtl";
        e.scrollTo({
          left: isRtl ? -range : range,
          behavior: "instant" as ScrollBehavior,
        });
      });
      const lastBox = await lastChip.boundingBox();
      expect(lastBox).not.toBeNull();
      expect(lastBox!.width).toBeGreaterThan(0);
      expect(lastBox!.x).toBeGreaterThanOrEqual(0);
      expect(lastBox!.x + lastBox!.width).toBeLessThanOrEqual(
        VIEWPORT.width + 1
      );
    });

    test("heatmap horizontal scroll reaches the last column with no further clipping", async ({
      page,
    }) => {
      // Select a staff member so the heatmap mounts.
      await page.locator('[data-testid="staff-member"]').first().click();
      const heatmap = page.locator('[data-testid="availability-heatmap"]');
      await expect(heatmap).toBeVisible({ timeout: 5000 });
      const scroller = heatmap.locator(".overflow-x-auto").first();
      await expect(scroller).toBeVisible();

      const initial = await scroller.evaluate((el) => {
        const e = el as HTMLElement;
        return {
          scrollWidth: e.scrollWidth,
          clientWidth: e.clientWidth,
        };
      });
      // With 14 half-hour slots and a narrow 82% right pane, content must
      // exceed clientWidth — otherwise the test isn't exercising the scroll.
      expect(initial.scrollWidth).toBeGreaterThan(initial.clientWidth);

      // Scroll to the end and assert scrollLeft reaches scrollWidth -
      // clientWidth. In RTL Chromium reports scrollLeft as a negative value
      // with the "end" at -(range); we compare absolute values.
      const reached = await scroller.evaluate((el) => {
        const e = el as HTMLElement;
        const target = e.scrollWidth - e.clientWidth;
        const isRtl = getComputedStyle(e).direction === "rtl";
        e.scrollTo({
          left: isRtl ? -target : target,
          behavior: "instant" as ScrollBehavior,
        });
        return { target, actual: Math.abs(e.scrollLeft) };
      });
      expect(Math.abs(reached.actual - reached.target)).toBeLessThanOrEqual(1);

      // The last column of the heatmap grid must render fully inside the
      // scroller's clientRect after scrolling to the end.
      const lastColInside = await heatmap.evaluate((hm) => {
        const scroller = hm.querySelector(".overflow-x-auto") as HTMLElement;
        const grid = scroller?.querySelector(".grid") as HTMLElement | null;
        if (!grid) return null;
        const cells = grid.children;
        const last = cells[cells.length - 1] as HTMLElement;
        const lastR = last.getBoundingClientRect();
        const sR = scroller.getBoundingClientRect();
        return {
          lastLeft: lastR.left,
          lastRight: lastR.right,
          sLeft: sR.left,
          sRight: sR.right,
        };
      });
      expect(lastColInside).not.toBeNull();
      // The last cell must be visible inside the scroller's box (with a small
      // tolerance for sub-pixel rendering).
      expect(lastColInside!.lastRight).toBeLessThanOrEqual(
        lastColInside!.sRight + 1
      );
      expect(lastColInside!.lastLeft).toBeGreaterThanOrEqual(
        lastColInside!.sLeft - 1
      );
    });
  });
}
