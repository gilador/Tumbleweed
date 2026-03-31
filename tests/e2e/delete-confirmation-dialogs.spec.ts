import { test, expect } from "@playwright/test";

test.describe("Delete Confirmation Dialogs", () => {
  test("staff member deletion shows confirmation dialog with correct content", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    // Enter edit mode
    const editToggleButton = page
      .getByRole("button", { name: "Enter edit mode" })
      .first();
    await expect(editToggleButton).toBeVisible();
    await editToggleButton.click();

    // Wait for edit mode to activate
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // Check a single staff member
    const firstStaffMember = page
      .locator('[data-testid="staff-member"]')
      .first();
    const checkbox = firstStaffMember.getByRole("checkbox");
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Click delete button
    const deleteButton = page.getByRole("button", {
      name: "Delete selected users",
    });
    await deleteButton.click();

    // Verify dialog appears with correct content
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Check title for single staff member
    await expect(
      page.getByText("Are you sure you want to delete 1 staff member?")
    ).toBeVisible();

    // Check description
    await expect(
      page.getByText("Once deleted, it can't be undone.")
    ).toBeVisible();

    // Check CTAs
    const noButton = page.getByRole("button", { name: "No" });
    const yesButton = page.getByRole("button", { name: "Yes, please!" });
    await expect(noButton).toBeVisible();
    await expect(yesButton).toBeVisible();

    // Test "No" button cancels deletion
    await noButton.click();
    await expect(dialog).not.toBeVisible();

    // Verify staff member is still there
    await expect(checkbox).toBeChecked();

    // Exit edit mode
    await editToggleButton.click();
  });

  test("multiple staff members deletion shows correct plural form", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    // Enter edit mode
    const editToggleButton = page
      .getByRole("button", { name: "Enter edit mode" })
      .first();
    await editToggleButton.click();

    // Wait for edit mode to activate
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // Check multiple staff members
    const staffMembers = page.locator('[data-testid="staff-member"]');
    const firstCheckbox = staffMembers.nth(0).getByRole("checkbox");
    const secondCheckbox = staffMembers.nth(1).getByRole("checkbox");

    await firstCheckbox.click();
    await secondCheckbox.click();

    // Click delete button
    const deleteButton = page.getByRole("button", {
      name: "Delete selected users",
    });
    await deleteButton.click();

    // Verify dialog appears with plural form
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Check title for multiple staff members
    await expect(
      page.getByText("Are you sure you want to delete 2 staff members?")
    ).toBeVisible();

    // Test "Yes, please!" button confirms deletion
    const yesButton = page.getByRole("button", { name: "Yes, please!" });
    await yesButton.click();

    // Wait for deletion to complete
    await expect(dialog).not.toBeVisible();

    // Exit edit mode
    await editToggleButton.click();
  });

  test("post deletion shows confirmation dialog with correct content", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    // Enter edit mode
    const editToggleButton = page
      .getByRole("button", { name: "Enter edit mode" })
      .first();
    await editToggleButton.click();

    // Wait for edit mode to activate
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // Find and check a post in the assignments section
    const assignmentsSection = page
      .locator('text="Shift Assignments"')
      .locator("..")
      .locator("..");

    const postCheckboxes = assignmentsSection.getByRole("checkbox");
    await expect(postCheckboxes.first()).toBeVisible();
    await postCheckboxes.first().click();

    // Click delete posts button
    const deletePostButton = page.getByRole("button", {
      name: "Delete selected posts",
    });
    await deletePostButton.click();

    // Verify dialog appears with correct content
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Check title for single post
    await expect(
      page.getByText("Are you sure you want to delete 1 post?")
    ).toBeVisible();

    // Check description
    await expect(
      page.getByText("Once deleted, it can't be undone.")
    ).toBeVisible();

    // Check CTAs
    const noButton = page.getByRole("button", { name: "No" });
    const yesButton = page.getByRole("button", { name: "Yes, please!" });
    await expect(noButton).toBeVisible();
    await expect(yesButton).toBeVisible();

    // Test "No" button cancels deletion
    await noButton.click();
    await expect(dialog).not.toBeVisible();

    // Exit edit mode
    await editToggleButton.click();
  });

  test("multiple posts deletion shows correct plural form", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    // Enter edit mode
    const editToggleButton = page
      .getByRole("button", { name: "Enter edit mode" })
      .first();
    await editToggleButton.click();

    // Wait for edit mode to activate
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // Find and check multiple posts in the assignments section
    const assignmentsSection = page
      .locator('text="Shift Assignments"')
      .locator("..")
      .locator("..");

    const postCheckboxes = assignmentsSection.getByRole("checkbox");
    const postCount = await postCheckboxes.count();

    if (postCount >= 2) {
      await postCheckboxes.nth(0).click();
      await postCheckboxes.nth(1).click();

      // Click delete posts button
      const deletePostButton = page.getByRole("button", {
        name: "Delete selected posts",
      });
      await deletePostButton.click();

      // Verify dialog appears with plural form
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Check title for multiple posts
      await expect(
        page.getByText("Are you sure you want to delete 2 posts?")
      ).toBeVisible();

      // Test "Yes, please!" button confirms deletion
      const yesButton = page.getByRole("button", { name: "Yes, please!" });
      await yesButton.click();

      // Wait for deletion to complete
      await expect(dialog).not.toBeVisible();
    }

    // Exit edit mode
    await editToggleButton.click();
  });

  test("delete button does nothing when no items are selected", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    // Enter edit mode
    const editToggleButton = page
      .getByRole("button", { name: "Enter edit mode" })
      .first();
    await editToggleButton.click();

    // Wait for edit mode to activate
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // Ensure no staff members are selected
    const staffCheckboxes = page
      .locator('[data-testid="staff-member"]')
      .getByRole("checkbox");
    const checkboxCount = await staffCheckboxes.count();
    for (let i = 0; i < checkboxCount; i++) {
      await expect(staffCheckboxes.nth(i)).not.toBeChecked();
    }

    // Click delete button with no selection
    const deleteButton = page.getByRole("button", {
      name: "Delete selected users",
    });
    await deleteButton.click();

    // Verify no dialog appears
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Exit edit mode
    await editToggleButton.click();
  });
});
