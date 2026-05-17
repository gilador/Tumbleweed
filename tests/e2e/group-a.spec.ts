import { test, expect, Page } from "@playwright/test";

// Group A — desktop selection + schedule grid acceptance.
//
// Exercises the rebuilt visual layer: BulkSelectionBar (kind-aware sticky pill),
// ScheduleSectionHeader / StaffSectionHeader, PostHeadRow (inline rename +
// hover-trash on the schedule grid), AvailabilityHeatmap (single rendering
// path: empty / 1-of-N / N-of-N), and the Cmd+A handler scoped to the focused
// surface (schedule grid OR staff list).

const STAFF_ROW = '[data-testid="staff-member"]';

// Force English locale and dismiss the Drive Sync prompt before any page
// JS runs, otherwise the Radix dialog blocks `getByRole("main")`.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem("tumbleweed-lang", "en");
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    } catch {
      /* ignore */
    }
  });
});

async function waitForApp(page: Page) {
  await page.goto("/");
  // Sanity: confirm forced English locale took effect.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lang = await page.evaluate(() => (window as any).localStorage.getItem("tumbleweed-lang"));
  if (lang !== "en") {
    // Force-set and reload so i18n picks up English on next mount.
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

test.describe("Group A — desktop selection + schedule grid", () => {
  test.describe("Multi-select staff", () => {
    test("clicking two staff rows reveals the bulk bar with N selected", async ({
      page,
    }) => {
      await waitForApp(page);
      const rows = page.locator(STAFF_ROW);
      const count = await rows.count();
      test.skip(count < 2, "need at least 2 staff rows");

      // Click the row whitespace (not the name span — that triggers inline rename).
      // Each row has min-h-[52px]; click near the start edge.
      await rows.nth(0).click({ position: { x: 4, y: 4 } });
      await rows.nth(1).click({ position: { x: 4, y: 4 } });

      await expect(page.getByText(/^2 selected$/).first()).toBeVisible({
        timeout: 2000,
      });
    });

    test("Cancel button exits multi-select", async ({ page }) => {
      await waitForApp(page);
      const rows = page.locator(STAFF_ROW);
      test.skip((await rows.count()) < 2, "need at least 2 staff rows");

      await rows.nth(0).click({ position: { x: 4, y: 4 } });
      await rows.nth(1).click({ position: { x: 4, y: 4 } });
      await expect(page.getByText(/^2 selected$/).first()).toBeVisible();

      // BulkSelectionBar exposes aria-label "Cancel selection" on the X button.
      const cancel = page.getByRole("button", { name: /Cancel selection/i });
      await cancel.first().click();
      await expect(page.getByText(/^\d+ selected$/)).toHaveCount(0, {
        timeout: 2000,
      });
    });

    test("Deselect all dismisses the staff bulk bar", async ({ page }) => {
      await waitForApp(page);
      const rows = page.locator(STAFF_ROW);
      test.skip((await rows.count()) < 2, "need at least 2 staff rows");

      await rows.nth(0).click({ position: { x: 4, y: 4 } });
      await rows.nth(1).click({ position: { x: 4, y: 4 } });
      await expect(page.getByText(/^2 selected$/).first()).toBeVisible();

      // The bulk bar toggle reads "Select all" until everyone is checked,
      // then flips to "Deselect all users". With small fixtures (2 of 2),
      // we are already at all-selected, so just click the toggle once.
      const bulkRegion = page.getByRole("region", { name: /^\d+ selected$/ });
      await expect(bulkRegion).toBeVisible({ timeout: 2000 });
      const toggle = bulkRegion.getByRole("button", {
        name: /^(Select all|Deselect all users)$/i,
      });
      await toggle.click();
      // If we just selected all (was Select all), click again to deselect.
      const deselect = bulkRegion.getByRole("button", {
        name: /Deselect all users/i,
      });
      if ((await deselect.count()) > 0) {
        await deselect.click();
      }
      await expect(page.getByText(/^\d+ selected$/)).toHaveCount(0, {
        timeout: 2000,
      });
    });
  });

  test.describe("Multi-select posts on the schedule grid", () => {
    test("clicking two post-head rows reveals the posts bulk bar", async ({
      page,
    }) => {
      await waitForApp(page);
      const grid = page.locator("#assignments-table");
      await expect(grid).toBeVisible();

      // Post-A.5: schedule renders as a vertical stack of `.m-shift-block`
      // cards. Default Time view shows one card per shift, with each post
      // rendered as a `.row[data-post-id]` inside the card. Click whitespace
      // (not the `.pos-name` span — that triggers inline rename).
      const positionRows = grid.locator(".row[data-post-id]");
      const positionsCount = await positionRows.count();
      test.skip(positionsCount < 2, "need at least 2 post rows to multi-select");

      const firstRow = positionRows.nth(0);
      const secondRow = positionRows.nth(1);
      await firstRow.click({ position: { x: 4, y: 4 } });
      await secondRow.click({ position: { x: 4, y: 4 } });

      await expect(page.getByText(/^2 selected$/).first()).toBeVisible({
        timeout: 2000,
      });
    });
  });

  test.describe("Inline rename", () => {
    test("clicking a staff name opens an inline input that commits on Enter", async ({
      page,
    }) => {
      await waitForApp(page);
      const rows = page.locator(STAFF_ROW);
      test.skip((await rows.count()) < 1, "need at least 1 staff row");

      const first = rows.first();
      const nameSpan = first.locator("span", { hasText: /\S/ }).first();
      await nameSpan.click();

      const input = first.locator("input").first();
      await expect(input).toBeVisible({ timeout: 2000 });
      await input.fill("QA Renamed Staff");
      await input.press("Enter");

      await expect(first).toContainText("QA Renamed Staff", { timeout: 2000 });
    });

    test("Add position adds a new post and opens it in inline rename", async ({
      page,
    }) => {
      await waitForApp(page);

      const grid = page.locator("#assignments-table");
      const before = await grid
        .locator("text=/^(Position|Post|עמדה|New Post) ?\\d+$/")
        .count();

      const addBtn = page.getByRole("button", { name: /^Add position$/i }).first();
      await addBtn.click();

      // PostHeadRow with autoFocusEdit renders an <input> inside the schedule grid.
      const editingInput = grid.locator("input").first();
      await expect(editingInput).toBeVisible({ timeout: 3000 });

      // After commit (or blur), a new post entry should be present.
      await editingInput.fill("QA Rename Position");
      await editingInput.press("Enter");
      await expect(grid).toContainText("QA Rename Position", { timeout: 3000 });
      const after = await grid
        .locator("text=/^(Position|Post|עמדה|New Post) ?\\d+$|^QA Rename Position$/")
        .count();
      expect(after).toBeGreaterThan(before);
    });
  });

  test.describe("Cmd+A keyboard handler", () => {
    test("Cmd+A inside the schedule grid selects all posts", async ({ page }) => {
      await waitForApp(page);
      // Cmd+A handler in ShiftManager checks e.target.contains() against
      // scheduleGridRef. Click an interactive child (the Add position button)
      // first so the focused element lives inside the grid container, then
      // dispatch keydown via that element.
      const addBtn = page.getByRole("button", { name: /^Add position$/i }).first();
      await addBtn.focus();
      await addBtn.press("Meta+a");
      await addBtn.press("Control+a");
      await expect(page.getByText(/^\d+ selected$/).first()).toBeVisible({
        timeout: 2000,
      });
    });

    test("Cmd+A inside the staff list selects all staff", async ({ page }) => {
      await waitForApp(page);
      // Same approach: focus an element inside #staff_section so the keydown
      // target is contained by staffListRef.
      const addUser = page.getByRole("button", { name: /^Add$/i }).first();
      await addUser.focus();
      await addUser.press("Meta+a");
      await addUser.press("Control+a");
      await expect(page.getByText(/^\d+ selected$/).first()).toBeVisible({
        timeout: 2000,
      });
    });

    test("Cmd+A on schedule grid whitespace selects all visible posts", async ({
      page,
    }) => {
      await waitForApp(page);
      // Click on whitespace inside the schedule grid container itself (not on
      // a focusable child). The container's onMouseDown handler should focus
      // the container so the Cmd+A handler's contains() check fires.
      const grid = page.locator("#assignments-table");
      await grid.click({ position: { x: 4, y: 4 } });

      // CTO suggestion: confirm focus actually landed on the container, not a
      // child. This guards against false positives where a small-offset click
      // happens to hit a focusable header element.
      const activeId = await page.evaluate(
        () => document.activeElement?.id ?? null
      );
      expect(activeId).toBe("assignments-table");

      await page.keyboard.press("Meta+a");
      await page.keyboard.press("Control+a");
      await expect(page.getByText(/^\d+ selected$/).first()).toBeVisible({
        timeout: 2000,
      });
    });

    test("Cmd+A on staff list whitespace selects all staff", async ({
      page,
    }) => {
      await waitForApp(page);
      const staff = page.locator("#staff_section");
      await staff.click({ position: { x: 4, y: 4 } });

      const activeId = await page.evaluate(
        () => document.activeElement?.id ?? null
      );
      expect(activeId).toBe("staff_section");

      await page.keyboard.press("Meta+a");
      await page.keyboard.press("Control+a");
      await expect(page.getByText(/^\d+ selected$/).first()).toBeVisible({
        timeout: 2000,
      });
    });
  });

  test.describe("Availability heatmap rendering paths", () => {
    test("no staff selected → empty state shows pickTeammate copy", async ({
      page,
    }) => {
      await waitForApp(page);
      // Default state: no staff selected. The empty state copy is "Pick a teammate".
      await expect(page.getByText(/Pick a teammate/i).first()).toBeVisible({
        timeout: 4000,
      });
    });

    test("selecting a single staff renders that staff's heatmap header", async ({
      page,
    }) => {
      await waitForApp(page);
      const rows = page.locator(STAFF_ROW);
      test.skip((await rows.count()) < 1, "need at least 1 staff row");

      const first = rows.first();
      // Read the visible name pill (first non-empty span).
      const nameText = (
        (await first.locator("span", { hasText: /\S/ }).first().textContent()) ?? ""
      ).trim();
      await first.click({ position: { x: 4, y: 4 } });

      // userAvailability i18n: "{{name}}'s Availability"
      const nameEsc = nameText.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      await expect(
        page
          .getByRole("heading", { name: new RegExp(`${nameEsc}.{0,3}Availability`, "i") })
          .first()
      ).toBeVisible({ timeout: 4000 });
    });

    test("selecting two staff renders the count header", async ({ page }) => {
      await waitForApp(page);
      const rows = page.locator(STAFF_ROW);
      test.skip((await rows.count()) < 2, "need at least 2 staff rows");

      await rows.nth(0).click({ position: { x: 4, y: 4 } });
      await rows.nth(1).click({ position: { x: 4, y: 4 } });

      // availabilityCountHeader: "Availability — 2 of N"
      await expect(
        page
          .getByRole("heading", { name: /Availability\s+[—-]\s+2 of \d+/ })
          .first()
      ).toBeVisible({ timeout: 4000 });
    });
  });
});
