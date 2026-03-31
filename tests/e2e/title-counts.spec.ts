import { test, expect } from "@playwright/test";

test.describe("Title Counts Display", () => {
  test("displays correct counts in Shift Assignments and Staff titles", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();

    // Check initial counts - should show default data
    await expect(
      page.getByRole("heading", { name: /Shift Assignments \(\d+\)/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Staff \(\d+\)/ })
    ).toBeVisible();

    // Get initial counts
    const initialAssignmentsTitle = await page
      .getByRole("heading", { name: /Shift Assignments \(\d+\)/ })
      .textContent();
    const initialStaffTitle = await page
      .getByRole("heading", { name: /Staff \(\d+\)/ })
      .textContent();

    // Extract numbers from titles
    const initialPostsCount = parseInt(
      initialAssignmentsTitle?.match(/\((\d+)\)/)?.[1] || "0"
    );
    const initialStaffCount = parseInt(
      initialStaffTitle?.match(/\((\d+)\)/)?.[1] || "0"
    );

    // Verify we have some initial data
    expect(initialPostsCount).toBeGreaterThan(0);
    expect(initialStaffCount).toBeGreaterThan(0);

    // Enter edit mode to test adding items
    const editToggleButton = page
      .getByRole("button", { name: "Enter edit mode" })
      .first();
    await editToggleButton.click();

    // Wait for edit mode to activate
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // Add a new staff member
    const addUserButton = page.getByRole("button", { name: "Add user" });
    await addUserButton.click();

    // Wait for the new user to be added and check updated count
    await page.waitForTimeout(500);
    const updatedStaffTitle = await page
      .getByRole("heading", { name: /Staff \(\d+\)/ })
      .textContent();
    const updatedStaffCount = parseInt(
      updatedStaffTitle?.match(/\((\d+)\)/)?.[1] || "0"
    );

    // Verify staff count increased by 1
    expect(updatedStaffCount).toBe(initialStaffCount + 1);

    // Add a new post
    const addPostButton = page.getByRole("button", { name: "Add post" });
    await addPostButton.click();

    // Wait for the new post to be added and check updated count
    await page.waitForTimeout(500);
    const updatedAssignmentsTitle = await page
      .getByRole("heading", { name: /Shift Assignments \(\d+\)/ })
      .textContent();
    const updatedPostsCount = parseInt(
      updatedAssignmentsTitle?.match(/\((\d+)\)/)?.[1] || "0"
    );

    // Verify posts count increased by 1
    expect(updatedPostsCount).toBe(initialPostsCount + 1);

    // Exit edit mode
    await editToggleButton.click();
  });

  test("counts update correctly when deleting items", async ({ page }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();

    // Enter edit mode
    const editToggleButton = page
      .getByRole("button", { name: "Enter edit mode" })
      .first();
    await editToggleButton.click();

    // Wait for edit mode to activate
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // Get initial staff count
    const initialStaffTitle = await page
      .getByRole("heading", { name: /Staff \(\d+\)/ })
      .textContent();
    const initialStaffCount = parseInt(
      initialStaffTitle?.match(/\((\d+)\)/)?.[1] || "0"
    );

    // Select a staff member for deletion
    const firstStaffMember = page
      .locator('[data-testid="staff-member"]')
      .first();
    const checkbox = firstStaffMember.getByRole("checkbox");
    await checkbox.click();

    // Delete the selected staff member
    const deleteButton = page.getByRole("button", {
      name: "Delete selected users",
    });
    await deleteButton.click();

    // Confirm deletion in dialog
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const yesButton = page.getByRole("button", { name: "Yes, please!" });
    await yesButton.click();

    // Wait for deletion to complete
    await expect(dialog).not.toBeVisible();
    await page.waitForTimeout(500);

    // Check updated staff count
    const updatedStaffTitle = await page
      .getByRole("heading", { name: /Staff \(\d+\)/ })
      .textContent();
    const updatedStaffCount = parseInt(
      updatedStaffTitle?.match(/\((\d+)\)/)?.[1] || "0"
    );

    // Verify staff count decreased by 1
    expect(updatedStaffCount).toBe(initialStaffCount - 1);

    // Exit edit mode
    await editToggleButton.click();
  });

  test("counts are displayed in correct format", async ({ page }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();

    // Check that titles follow the format "Title (count)"
    const assignmentsTitle = await page
      .getByRole("heading", { name: /Shift Assignments \(\d+\)/ })
      .textContent();
    const staffTitle = await page
      .getByRole("heading", { name: /Staff \(\d+\)/ })
      .textContent();

    // Verify format matches "Title (number)"
    expect(assignmentsTitle).toMatch(/^Shift Assignments \(\d+\)$/);
    expect(staffTitle).toMatch(/^Staff \(\d+\)$/);

    // Verify the counts are numeric and non-negative
    const postsCount = parseInt(
      assignmentsTitle?.match(/\((\d+)\)/)?.[1] || "0"
    );
    const staffCount = parseInt(staffTitle?.match(/\((\d+)\)/)?.[1] || "0");

    expect(postsCount).toBeGreaterThanOrEqual(0);
    expect(staffCount).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(postsCount)).toBe(true);
    expect(Number.isInteger(staffCount)).toBe(true);
  });

  test("counts remain accurate after multiple operations", async ({ page }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();

    // Enter edit mode
    const editToggleButton = page
      .getByRole("button", { name: "Enter edit mode" })
      .first();
    await editToggleButton.click();

    // Wait for edit mode to activate
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // Get initial counts
    let currentStaffTitle = await page
      .getByRole("heading", { name: /Staff \(\d+\)/ })
      .textContent();
    let currentStaffCount = parseInt(
      currentStaffTitle?.match(/\((\d+)\)/)?.[1] || "0"
    );

    let currentAssignmentsTitle = await page
      .getByRole("heading", { name: /Shift Assignments \(\d+\)/ })
      .textContent();
    let currentPostsCount = parseInt(
      currentAssignmentsTitle?.match(/\((\d+)\)/)?.[1] || "0"
    );

    // Perform multiple add operations
    const addUserButton = page.getByRole("button", { name: "Add user" });
    const addPostButton = page.getByRole("button", { name: "Add post" });

    // Add 2 users
    await addUserButton.click();
    await page.waitForTimeout(300);
    await addUserButton.click();
    await page.waitForTimeout(300);

    // Add 1 post
    await addPostButton.click();
    await page.waitForTimeout(300);

    // Verify counts updated correctly
    currentStaffTitle = await page
      .getByRole("heading", { name: /Staff \(\d+\)/ })
      .textContent();
    const newStaffCount = parseInt(
      currentStaffTitle?.match(/\((\d+)\)/)?.[1] || "0"
    );

    currentAssignmentsTitle = await page
      .getByRole("heading", { name: /Shift Assignments \(\d+\)/ })
      .textContent();
    const newPostsCount = parseInt(
      currentAssignmentsTitle?.match(/\((\d+)\)/)?.[1] || "0"
    );

    expect(newStaffCount).toBe(currentStaffCount + 2);
    expect(newPostsCount).toBe(currentPostsCount + 1);

    // Exit edit mode
    await editToggleButton.click();
  });
});
