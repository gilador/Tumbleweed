import { test, expect } from "@playwright/test";
import {
  STAFF_ROW,
  installInitScript,
  waitForApp,
  clickStaffRow,
  postNameLocators,
  clickPostRow,
  bulkRegion,
} from "./helpers";

// All four destructive confirmations now share the shadcn Dialog pattern:
//   - Bulk-delete (staff or posts) confirms via shadcn Dialog rendered by
//     BulkSelectionBar — the confirm copy is `deleteStaffConfirm` /
//     `deletePostsConfirm` ("Are you sure you want to delete N staff
//     member(s)?" / "...N post(s)?"), with No / "Yes, please!" CTAs.
//   - Single-staff delete (hover-trash on the staff row) opens a shadcn
//     Dialog with title `deleteUserConfirmSingle` ("Delete this teammate?").
//   - Single-post delete (hover-trash on a PostHeadRow) opens a shadcn
//     Dialog with title `deletePostConfirmSingle` ("Delete this position?").

test.beforeEach(async ({ page }) => {
  await installInitScript(page);
});

test.describe("Delete Confirmation Dialogs", () => {
  test("bulk staff delete shows shadcn dialog with correct singular copy", async ({
    page,
  }) => {
    await waitForApp(page);
    test.skip(
      (await page.locator(STAFF_ROW).count()) < 2,
      "need at least 2 staff rows to enter multi"
    );

    // Enter multi-select via 2 rows, then deselect one to leave a single
    // selected entry in the bulk bar.
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);
    const region = bulkRegion(page);
    await expect(region).toBeVisible();
    // Toggle row 1 off → 1 selected remaining.
    await clickStaffRow(page, 1);
    await expect(page.getByText(/^1 selected$/).first()).toBeVisible();

    // Trash button in the bar is labeled with the count "1".
    await region.locator("button").filter({ hasText: "1" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/Are you sure you want to delete 1 staff member/i)
    ).toBeVisible();
    await expect(dialog.getByText(/Once deleted, it can't be undone/i)).toBeVisible();

    await expect(dialog.getByRole("button", { name: /^No$/i })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /^Yes, please!$/i })
    ).toBeVisible();

    const initialCount = await page.locator(STAFF_ROW).count();
    await dialog.getByRole("button", { name: /^No$/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator(STAFF_ROW)).toHaveCount(initialCount);
  });

  test("bulk staff delete shows correct plural copy for >1", async ({
    page,
  }) => {
    await waitForApp(page);
    test.skip(
      (await page.locator(STAFF_ROW).count()) < 2,
      "need at least 2 staff rows"
    );

    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);

    const region = bulkRegion(page);
    await region.locator("button").filter({ hasText: "2" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/Are you sure you want to delete 2 staff member/i)
    ).toBeVisible();

    await dialog.getByRole("button", { name: /^Yes, please!$/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("bulk post delete shows shadcn dialog with correct singular copy", async ({
    page,
  }) => {
    await waitForApp(page);

    test.skip(
      (await postNameLocators(page).count()) < 1,
      "need at least 1 post"
    );

    await clickPostRow(page, 0);
    const region = bulkRegion(page);
    await expect(region).toBeVisible();

    await region.locator("button").filter({ hasText: "1" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/Are you sure you want to delete 1 post/i)
    ).toBeVisible();
    await expect(dialog.getByText(/Once deleted, it can't be undone/i)).toBeVisible();

    await expect(dialog.getByRole("button", { name: /^No$/i })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /^Yes, please!$/i })
    ).toBeVisible();

    await dialog.getByRole("button", { name: /^No$/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("bulk post delete shows plural copy for >1", async ({ page }) => {
    await waitForApp(page);

    test.skip(
      (await postNameLocators(page).count()) < 2,
      "need at least 2 posts"
    );

    await clickPostRow(page, 0);
    await clickPostRow(page, 1);

    const region = bulkRegion(page);
    await region.locator("button").filter({ hasText: "2" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/Are you sure you want to delete 2 post/i)
    ).toBeVisible();

    await dialog.getByRole("button", { name: /^Yes, please!$/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("single-staff hover-trash opens 'Delete this teammate?' dialog", async ({
    page,
  }) => {
    await waitForApp(page);

    const rows = page.locator(STAFF_ROW);
    test.skip((await rows.count()) < 1, "need at least 1 staff row");

    const first = rows.first();
    await first.hover();

    const trashBtn = first.getByRole("button", {
      name: /Delete this teammate\?/i,
    });
    await expect(trashBtn).toBeVisible({ timeout: 2000 });
    await trashBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: /Delete this teammate\?/i })
    ).toBeVisible();

    // Cancel keeps the row.
    const initial = await rows.count();
    await dialog.getByRole("button", { name: /^Cancel$|^No$/i }).first().click();
    await expect(dialog).not.toBeVisible();
    await expect(rows).toHaveCount(initial);
  });

  test("single-post hover-trash opens 'Delete this position?' dialog and confirms removal", async ({
    page,
  }) => {
    await waitForApp(page);
    const grid = page.locator("#assignments-table");
    // Switch to Position view so each post becomes a card with a hover-trash
    // in its `.head.post-head[data-post-id]`.
    await grid.locator('button[data-group="post"]').click();
    const headRows = grid.locator(".head.post-head[data-post-id]");
    const initial = await headRows.count();
    test.skip(initial < 1, "need at least 1 post");

    const firstRow = headRows.nth(0);
    await firstRow.hover();

    const trash = firstRow.getByRole("button", {
      name: /Delete this position\?/i,
    });
    await expect(trash).toBeVisible({ timeout: 2000 });
    await trash.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: /Delete this position\?/i })
    ).toBeVisible();
    await expect(dialog.getByText(/Once deleted, it can't be undone/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^No$/i })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /^Yes, please!$/i })
    ).toBeVisible();

    await dialog.getByRole("button", { name: /^Yes, please!$/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect
      .poll(async () => headRows.count(), { timeout: 4000 })
      .toBeLessThan(initial);
  });

  test("single-post hover-trash dialog cancel keeps the post", async ({
    page,
  }) => {
    await waitForApp(page);
    const grid = page.locator("#assignments-table");
    await grid.locator('button[data-group="post"]').click();
    const headRows = grid.locator(".head.post-head[data-post-id]");
    const initial = await headRows.count();
    test.skip(initial < 1, "need at least 1 post");

    const firstRow = headRows.nth(0);
    await firstRow.hover();
    const trash = firstRow.getByRole("button", {
      name: /Delete this position\?/i,
    });
    await trash.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^No$/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(headRows).toHaveCount(initial);
  });
});
