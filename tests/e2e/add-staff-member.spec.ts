import { test, expect } from "@playwright/test";
import {
  STAFF_ROW,
  installInitScript,
  waitForApp,
  clickStaffRow,
  bulkRegion,
} from "./helpers";

// Re-authored against the redesigned desktop UI (Group A):
//   - "Enter edit mode" toggle is gone — clicking a row selects directly.
//   - "Add user" / "Add position" sit on StaffSectionHeader / ScheduleSectionHeader.
//   - Bulk delete confirms via shadcn Dialog (deleteStaffConfirm). Single-staff
//     delete uses hover-trash → shadcn Dialog (deleteUserConfirmSingle).

test.beforeEach(async ({ page }) => {
  await installInitScript(page);
});

test.describe("Staff Management", () => {
  test("can add a new staff member", async ({ page }) => {
    await waitForApp(page);

    const initialStaffCount = await page.locator(STAFF_ROW).count();

    const addUserButton = page.getByRole("button", { name: /^Add$/i }).first();
    await expect(addUserButton).toBeVisible();
    await addUserButton.click();

    await expect(page.locator(STAFF_ROW)).toHaveCount(initialStaffCount + 1);

    // New members are added at the top with default name "Member N".
    const firstStaffMember = page.locator(STAFF_ROW).first();
    await expect(firstStaffMember).toContainText(/Member \d+/);
  });

  test("can edit staff member name", async ({ page }) => {
    await waitForApp(page);

    // Inline rename: click the staff name span → input appears in the row.
    const firstStaffMember = page.locator(STAFF_ROW).first();
    await expect(firstStaffMember).toBeVisible();
    const nameSpan = firstStaffMember.locator("span", { hasText: /\S/ }).first();
    await nameSpan.click();

    const nameInput = firstStaffMember.locator("input").first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Test Staff Member");
    await nameInput.press("Enter");

    await expect(firstStaffMember).toContainText("Test Staff Member");
  });

  test("staff list shows default workers on first load", async ({ page }) => {
    await waitForApp(page);

    const staffMembers = page.locator(STAFF_ROW);
    expect(await staffMembers.count()).toBeGreaterThan(0);

    // Default seeds are "עובד 1" / "עובד 2" from useShiftManagerInitialization
    // (hard-coded regardless of UI lang, like the default post names).
    await expect(page.locator("text=עובד 1").first()).toBeVisible();
    await expect(page.locator("text=עובד 2").first()).toBeVisible();
  });

  test("can add 2 users and edit both names to John Doe", async ({ page }) => {
    await waitForApp(page);

    const initialStaffCount = await page.locator(STAFF_ROW).count();

    const addUserButton = page.getByRole("button", { name: /^Add$/i }).first();
    await expect(addUserButton).toBeVisible();
    await addUserButton.click();
    await addUserButton.click();

    await expect(page.locator(STAFF_ROW)).toHaveCount(initialStaffCount + 2);

    const staffMembers = page.locator(STAFF_ROW);
    const firstNewUser = staffMembers.nth(0);
    const secondNewUser = staffMembers.nth(1);

    await expect(firstNewUser).toContainText(/Member \d+/);
    await expect(secondNewUser).toContainText(/Member \d+/);

    // Inline rename first new user.
    await firstNewUser.locator("span", { hasText: /\S/ }).first().click();
    const firstInput = firstNewUser.locator("input").first();
    await expect(firstInput).toBeVisible();
    await firstInput.fill("John Doe");
    await firstInput.press("Enter");
    await expect(firstNewUser).toContainText("John Doe");

    // Inline rename second new user.
    await secondNewUser.locator("span", { hasText: /\S/ }).first().click();
    const secondInput = secondNewUser.locator("input").first();
    await expect(secondInput).toBeVisible();
    await secondInput.fill("John Doe");
    await secondInput.press("Enter");
    await expect(secondNewUser).toContainText("John Doe");

    // At least 2 rows should match "John Doe" (the 2 we just renamed).
    const johnDoeStaffMembers = page.locator(
      `${STAFF_ROW}:has-text("John Doe")`
    );
    expect(await johnDoeStaffMembers.count()).toBeGreaterThanOrEqual(2);
  });

  test("can delete staff members using select all then delete", async ({
    page,
  }) => {
    await waitForApp(page);

    const initialStaffCount = await page.locator(STAFF_ROW).count();
    expect(initialStaffCount).toBeGreaterThan(0);

    // Enter multi-select by clicking two staff rows (single→single→multi
    // upgrade rule in selectionStore.handleStaffRowClick), then "Select all".
    test.skip(initialStaffCount < 2, "need at least 2 staff rows to enter multi");
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);
    const region = bulkRegion(page);
    await expect(region).toBeVisible({ timeout: 2000 });
    if ((await region.getByRole("button", { name: /^Select all$/i }).count()) > 0) {
      await region.getByRole("button", { name: /^Select all$/i }).click();
    }
    await expect(
      region.getByRole("button", { name: /^Deselect all users$/i })
    ).toBeVisible();

    // Trash button — first count badge button inside the region (only one).
    const trashButton = region.locator("button").filter({ hasText: String(initialStaffCount) });
    await trashButton.first().click();

    // shadcn confirm dialog
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        new RegExp(
          `delete\\s+${initialStaffCount}\\s+staff member`,
          "i"
        )
      )
    ).toBeVisible();

    await dialog.getByRole("button", { name: /^Yes, please!$/i }).click();

    await expect(page.locator(STAFF_ROW)).toHaveCount(0);
  });

  test("can add users then delete them with confirmation dialog", async ({
    page,
  }) => {
    await waitForApp(page);

    const initialStaffCount = await page.locator(STAFF_ROW).count();

    const addUserButton = page.getByRole("button", { name: /^Add$/i }).first();
    await addUserButton.click();
    await addUserButton.click();

    const total = initialStaffCount + 2;
    await expect(page.locator(STAFF_ROW)).toHaveCount(total);

    // Enter multi-select by clicking two rows, then "Select all".
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);
    const region = bulkRegion(page);
    await expect(region).toBeVisible();
    if ((await region.getByRole("button", { name: /^Select all$/i }).count()) > 0) {
      await region.getByRole("button", { name: /^Select all$/i }).click();
    }
    await expect(
      region.getByRole("button", { name: /^Deselect all users$/i })
    ).toBeVisible();

    // Click trash (button with the count badge — there's only one trash
    // button in the region).
    const trashButton = region.locator("button").filter({ hasText: String(total) });
    await trashButton.first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        new RegExp(`delete\\s+${total}\\s+staff member`, "i")
      )
    ).toBeVisible();
    await dialog.getByRole("button", { name: /^Yes, please!$/i }).click();

    await expect(page.locator(STAFF_ROW)).toHaveCount(0);
  });

  test("can cancel delete operation in confirmation dialog", async ({
    page,
  }) => {
    await waitForApp(page);

    const initialStaffCount = await page.locator(STAFF_ROW).count();
    expect(initialStaffCount).toBeGreaterThan(1);

    // Enter multi-select via 2 row clicks, then Select all.
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);
    const region = bulkRegion(page);
    await expect(region).toBeVisible();
    if ((await region.getByRole("button", { name: /^Select all$/i }).count()) > 0) {
      await region.getByRole("button", { name: /^Select all$/i }).click();
    }
    await expect(
      region.getByRole("button", { name: /^Deselect all users$/i })
    ).toBeVisible();

    const trashButton = region.locator("button").filter({ hasText: String(initialStaffCount) });
    await trashButton.first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        new RegExp(`delete\\s+${initialStaffCount}\\s+staff member`, "i")
      )
    ).toBeVisible();

    // Click "No" to cancel.
    await dialog.getByRole("button", { name: /^No$/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator(STAFF_ROW)).toHaveCount(initialStaffCount);
  });

  test("can select all staff and delete them", async ({ page }) => {
    await waitForApp(page);

    const initialStaffCount = await page.locator(STAFF_ROW).count();
    expect(initialStaffCount).toBeGreaterThan(0);
    test.skip(initialStaffCount < 2, "need at least 2 staff rows to enter multi");

    // Enter multi-select via 2 row clicks, then Select all.
    await clickStaffRow(page, 0);
    await clickStaffRow(page, 1);
    const region = bulkRegion(page);
    await expect(region).toBeVisible();
    if ((await region.getByRole("button", { name: /^Select all$/i }).count()) > 0) {
      await region.getByRole("button", { name: /^Select all$/i }).click();
    }
    await expect(
      region.getByRole("button", { name: /^Deselect all users$/i })
    ).toBeVisible();
    // Bulk bar count text should show all selected.
    await expect(
      page.getByText(new RegExp(`^${initialStaffCount} selected$`)).first()
    ).toBeVisible();

    const trashButton = region.locator("button").filter({ hasText: String(initialStaffCount) });
    await trashButton.first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^Yes, please!$/i }).click();

    await expect(page.locator(STAFF_ROW)).toHaveCount(0);
  });

  // TODO(group-d): "delete button behavior when no users are selected" —
  // pre-redesign relied on a delete button always present in edit mode that
  // no-oped on empty selection. The redesigned BulkSelectionBar only renders
  // when a selection exists, so the empty-selection-no-op branch is no
  // longer reachable by user interaction. Behavior is implicitly covered by
  // every other test (no dialog opens until the trash inside an active
  // multi-select bar is clicked).
});

test.describe("Post Management", () => {
  test("can add a new post", async ({ page }) => {
    await waitForApp(page);

    const grid = page.locator("#assignments-table");
    const before = await grid
      .locator("text=/^(Position|Post|עמדה|New Post) ?\\d+$/")
      .count();

    const addBtn = page.getByRole("button", { name: /^Add position$/i }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // PostHeadRow auto-focuses an inline input on add.
    const editingInput = grid.locator("input").first();
    await expect(editingInput).toBeVisible({ timeout: 3000 });
    await editingInput.fill("QA New Position");
    await editingInput.press("Enter");

    await expect(grid).toContainText("QA New Position");
    const after = await grid
      .locator(
        "text=/^(Position|Post|עמדה|New Post) ?\\d+$|^QA New Position$/"
      )
      .count();
    expect(after).toBeGreaterThan(before);
  });
});
