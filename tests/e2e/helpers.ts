import { expect, Page } from "@playwright/test";
import { LOCAL_STORAGE_KEY } from "../../src/lib/localStorageUtils";

// Shared E2E helpers aligned with group-a.spec.ts. Forces English locale and
// dismisses the Drive Sync prompt before any page JS runs, then waits for the
// Schedule heading to confirm the redesigned UI is mounted.

export const STAFF_ROW = '[data-testid="staff-member"]';

/**
 * Seed `pakal-shmira-shiftState` (LOCAL_STORAGE_KEY) with a captured
 * PersistedShiftData snapshot so the app boots straight into a known
 * 7D + assignments state — no optimizer run needed.
 *
 * Order matters: `installInitScript` clears localStorage first, so call
 * `seedShiftState` AFTER `installInitScript` in the setup so its init
 * script runs second.
 */
export async function seedShiftState(
  page: Page,
  fixture: object
): Promise<void> {
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

/**
 * Install init script that clears localStorage and sets English + dismisses
 * the Drive Sync modal. Must be invoked from `test.beforeEach` (before any
 * `page.goto`).
 */
export async function installInitScript(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem("tumbleweed-lang", "en");
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    } catch {
      /* ignore */
    }
  });
}

/**
 * Navigate to "/" and wait for the redesigned UI to be ready.
 * Asserts that the Schedule heading is present (rendered by
 * ScheduleSectionHeader).
 */
export async function waitForApp(page: Page) {
  await page.goto("/");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lang = await page.evaluate(() =>
    (window as any).localStorage.getItem("tumbleweed-lang")
  );
  if (lang !== "en") {
    await page.evaluate(() => {
      localStorage.setItem("tumbleweed-lang", "en");
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    });
    await page.reload();
  }
  await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: /^Schedule$/ })
  ).toBeVisible({ timeout: 5000 });
}

/**
 * Mobile-aware variant of waitForApp: waits for the bottom tab navigation
 * and the SettingsTab heading "Operation Hours" instead of the desktop
 * Schedule heading (the mobile shell does not render that heading).
 *
 * Mirrors waitForApp's locale-init recovery logic.
 */
export async function waitForMobileApp(page: Page) {
  await page.goto("/");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lang = await page.evaluate(() =>
    (window as any).localStorage.getItem("tumbleweed-lang")
  );
  if (lang !== "en") {
    await page.evaluate(() => {
      localStorage.setItem("tumbleweed-lang", "en");
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    });
    await page.reload();
  }
  await expect(page.getByRole("navigation")).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: /^Operation Hours$/ })
  ).toBeVisible({ timeout: 5000 });
}

/**
 * Click a staff row's whitespace (so we don't accidentally trigger inline
 * rename, which is bound to the name span).
 */
export async function clickStaffRow(page: Page, index: number) {
  const rows = page.locator(STAFF_ROW);
  await rows.nth(index).click({ position: { x: 4, y: 4 } });
}

/**
 * Locator for post-name spans in the schedule grid (post-A.5 redesign).
 * Both views (Time-grouped ShiftCard and Position-grouped PostCard) render
 * the post-name as `.pos-name[data-pos-id]` — see selector contract.
 * In Time view this can resolve multiple times per post (one per shift card);
 * callers typically use `.first()` / `.nth(i)` to pick a specific card's row.
 */
export function postNameLocators(page: Page) {
  const grid = page.locator("#assignments-table");
  return grid.locator(".pos-name[data-pos-id]");
}

/**
 * Click a post-row's whitespace (not the .pos-name span — that triggers
 * inline rename). Targets the closest `.row[data-post-id]` (Time view inner
 * row) or `.head.post-head[data-post-id]` (Position card head).
 */
export async function clickPostRow(page: Page, index: number) {
  const grid = page.locator("#assignments-table");
  const row = grid
    .locator(".row[data-post-id], .head.post-head[data-post-id]")
    .nth(index);
  await row.click({ position: { x: 4, y: 4 } });
}

/**
 * Convenience: the BulkSelectionBar exposes a region with aria-label
 * "{count} selected" — handy when scoping select-all / cancel buttons.
 */
export function bulkRegion(page: Page) {
  return page.getByRole("region", { name: /^\d+ selected$/ });
}
