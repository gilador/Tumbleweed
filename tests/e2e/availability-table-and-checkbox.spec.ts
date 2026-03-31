import { test, expect } from "@playwright/test";

test.describe("Availability Table Display", () => {
  test("posts column should be hidden in staff section but visible in assignments section", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    // Verify we have staff members and posts loaded
    const staffMembers = page.locator('[data-testid="staff-member"]');
    await expect(staffMembers.first()).toBeVisible();

    // Select a staff member to show their availability table
    await staffMembers.first().click();

    // Wait for availability table to load in staff section
    await page.waitForTimeout(1000);

    // Check the assignments section (top) - should have "Post" header
    const assignmentsSection = page
      .locator('text="Shift Assignments"')
      .locator("..")
      .locator("..");
    const assignmentsTable = assignmentsSection
      .locator("div")
      .filter({ hasText: "Post" })
      .first();

    // Verify "Post" header exists in assignments section
    await expect(assignmentsTable.locator('text="Post"')).toBeVisible();

    // Check the staff section (bottom) - should NOT have "Post" header
    const staffSection = page
      .locator('text="Staff"')
      .locator("..")
      .locator("..");
    const availabilityTable = staffSection.locator('[class*="grid"]').last();

    // Verify "Post" header does NOT exist in staff availability table
    await expect(availabilityTable.locator('text="Post"')).not.toBeVisible();

    // Verify the staff availability table shows time slots (08:00, 13:00, etc.)
    await expect(availabilityTable.locator('text="08:00"')).toBeVisible();
    await expect(availabilityTable.locator('text="13:00"')).toBeVisible();

    // Verify the assignments table shows post names
    const postElements = assignmentsSection.locator("text=/Post \\d+/");
    await expect(postElements.first()).toBeVisible();
  });

  test("availability table layout changes correctly between modes", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    // Select a staff member
    const staffMembers = page.locator('[data-testid="staff-member"]');
    await expect(staffMembers.first()).toBeVisible();
    await staffMembers.first().click();

    await page.waitForTimeout(1000);

    // Check assignments section grid layout (should include post column)
    const assignmentsSection = page
      .locator('text="Shift Assignments"')
      .locator("..")
      .locator("..");
    const assignmentsGrid = assignmentsSection
      .locator('[class*="grid-cols-[auto_repeat"]')
      .first();
    await expect(assignmentsGrid).toBeVisible();

    // Check staff section grid layout (should NOT include post column)
    const staffSection = page
      .locator('text="Staff"')
      .locator("..")
      .locator("..");
    const availabilityGrid = staffSection
      .locator('[class*="grid-cols-[repeat"]')
      .first();
    await expect(availabilityGrid).toBeVisible();

    // Verify the staff availability table has the correct number of columns (hours only)
    const availabilityHeaders = availabilityGrid
      .locator("div")
      .filter({ hasText: /^\d{2}:\d{2}$/ });
    const headerCount = await availabilityHeaders.count();
    expect(headerCount).toBeGreaterThan(0); // Should have time headers

    // Verify no post names appear in the staff availability section
    const postInAvailability = staffSection.locator("text=/Post \\d+/");
    await expect(postInAvailability).not.toBeVisible();
  });
});

test.describe("Checkbox Functionality in Edit Mode", () => {
  test("staff member checkboxes can be checked and unchecked in edit mode", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    // Ensure we have staff members
    const staffMembers = page.locator('[data-testid="staff-member"]');
    await expect(staffMembers.first()).toBeVisible();

    // Enter edit mode
    const editToggleButton = page
      .getByRole("button", { name: "Enter edit mode" })
      .first();
    await expect(editToggleButton).toBeVisible();
    await editToggleButton.click();

    // Wait for edit mode to activate
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // Find the first staff member's checkbox (Radix UI checkbox renders as button with role="checkbox")
    const firstStaffMember = staffMembers.first();
    const checkbox = firstStaffMember.getByRole("checkbox");
    await expect(checkbox).toBeVisible();

    // Verify checkbox is initially unchecked
    await expect(checkbox).not.toBeChecked();

    // Click the checkbox to check it
    await checkbox.click();

    // Verify checkbox is now checked
    await expect(checkbox).toBeChecked();

    // Click the checkbox again to uncheck it
    await checkbox.click();

    // Verify checkbox is now unchecked
    await expect(checkbox).not.toBeChecked();

    // Exit edit mode
    await editToggleButton.click();
  });

  test("post checkboxes can be checked and unchecked in edit mode", async ({
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

    // Find the assignments section and look for post checkboxes
    const assignmentsSection = page
      .locator('text="Shift Assignments"')
      .locator("..")
      .locator("..");

    // Look for ActionableText components with checkboxes in the assignments section (Radix UI checkboxes)
    const postCheckboxes = assignmentsSection.getByRole("checkbox");

    // Ensure we have at least one post checkbox
    await expect(postCheckboxes.first()).toBeVisible();

    // Test the first post checkbox
    const firstPostCheckbox = postCheckboxes.first();

    // Verify checkbox is initially unchecked
    await expect(firstPostCheckbox).not.toBeChecked();

    // Click the checkbox to check it
    await firstPostCheckbox.click();

    // Verify checkbox is now checked
    await expect(firstPostCheckbox).toBeChecked();

    // Click the checkbox again to uncheck it
    await firstPostCheckbox.click();

    // Verify checkbox is now unchecked
    await expect(firstPostCheckbox).not.toBeChecked();

    // Exit edit mode
    await editToggleButton.click();
  });

  test("multiple checkboxes can be selected simultaneously", async ({
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

    // Test staff member checkboxes
    const staffMembers = page.locator('[data-testid="staff-member"]');
    const staffCheckboxes = staffMembers.getByRole("checkbox");

    // Ensure we have at least 2 staff members
    const staffCount = await staffCheckboxes.count();
    expect(staffCount).toBeGreaterThanOrEqual(2);

    // Check first two staff member checkboxes
    await staffCheckboxes.nth(0).click();
    await staffCheckboxes.nth(1).click();

    // Verify both are checked
    await expect(staffCheckboxes.nth(0)).toBeChecked();
    await expect(staffCheckboxes.nth(1)).toBeChecked();

    // Test post checkboxes if available
    const assignmentsSection = page
      .locator('text="Shift Assignments"')
      .locator("..")
      .locator("..");
    const postCheckboxes = assignmentsSection.getByRole("checkbox");

    const postCount = await postCheckboxes.count();
    if (postCount >= 2) {
      // Check first two post checkboxes
      await postCheckboxes.nth(0).click();
      await postCheckboxes.nth(1).click();

      // Verify both are checked
      await expect(postCheckboxes.nth(0)).toBeChecked();
      await expect(postCheckboxes.nth(1)).toBeChecked();
    }

    // Exit edit mode
    await editToggleButton.click();
  });

  test("checkbox functionality works correctly in various scenarios", async ({
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

    // Find the first staff member
    const firstStaffMember = page
      .locator('[data-testid="staff-member"]')
      .first();
    const checkbox = firstStaffMember.getByRole("checkbox");

    // Test basic checkbox functionality
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();

    // Test checkbox with multiple interactions
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Click somewhere else and verify checkbox state persists
    const nameArea = firstStaffMember
      .locator("span")
      .filter({ hasText: /\w+/ })
      .first();
    await nameArea.click();
    await expect(checkbox).toBeChecked();

    // Test checkbox after other UI interactions
    const addUserButton = page.getByRole("button", { name: "Add user" });
    await addUserButton.click();
    await page.waitForTimeout(500);

    // Verify checkbox still works after adding a user
    const wasCheckedBefore = await checkbox.isChecked();
    await checkbox.click();

    if (wasCheckedBefore) {
      await expect(checkbox).not.toBeChecked();
      await checkbox.click();
      await expect(checkbox).toBeChecked();
    } else {
      await expect(checkbox).toBeChecked();
      await checkbox.click();
      await expect(checkbox).not.toBeChecked();
    }

    // Exit edit mode
    await editToggleButton.click();
  });

  test("checkbox interactions do not interfere with other UI elements", async ({
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

    // Check a staff member checkbox
    const firstStaffMember = page
      .locator('[data-testid="staff-member"]')
      .first();
    const checkbox = firstStaffMember.getByRole("checkbox");
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Verify we can still select the staff member (click on the name area)
    const nameArea = firstStaffMember
      .locator("span")
      .filter({ hasText: /\w+/ })
      .first();
    await nameArea.click();

    // Verify the checkbox state is preserved
    await expect(checkbox).toBeChecked();

    // Verify other UI elements still work (add user button)
    const addUserButton = page.getByRole("button", { name: "Add user" });
    await expect(addUserButton).toBeVisible();
    await addUserButton.click();

    // Wait for the new user to be added
    await page.waitForTimeout(500);

    // Verify the checkbox functionality is still working (can be toggled)
    const isCurrentlyChecked = await checkbox.isChecked();
    await checkbox.click();
    if (isCurrentlyChecked) {
      await expect(checkbox).not.toBeChecked();
    } else {
      await expect(checkbox).toBeChecked();
    }

    // Exit edit mode
    await editToggleButton.click();
  });
});

test.describe("Integration Tests", () => {
  test("availability table and checkbox functionality work together", async ({
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

    // Select and check a staff member
    const staffMembers = page.locator('[data-testid="staff-member"]');
    const firstStaffMember = staffMembers.first();
    const checkbox = firstStaffMember.getByRole("checkbox");

    // Check the checkbox
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Click on the staff member to show their availability
    const nameArea = firstStaffMember
      .locator("span")
      .filter({ hasText: /\w+/ })
      .first();
    await nameArea.click();

    // Wait for availability table to load
    await page.waitForTimeout(1000);

    // Verify the availability table is displayed correctly (no posts column)
    const staffSection = page
      .locator('text="Staff"')
      .locator("..")
      .locator("..");
    await expect(staffSection.locator('text="Post"')).not.toBeVisible();
    await expect(staffSection.locator('text="08:00"')).toBeVisible();

    // Verify the checkbox is still checked
    await expect(checkbox).toBeChecked();

    // Verify assignments section shows the table structure correctly
    const assignmentsSection = page
      .locator('text="Shift Assignments"')
      .locator("..")
      .locator("..");

    // In edit mode, posts should be visible in the assignments section
    // Look for either "Post" header or post names like "Post 1", "Post 2", etc.
    const hasPostHeader = await assignmentsSection
      .locator('text="Post"')
      .isVisible();
    const hasPostNames = await assignmentsSection
      .locator("text=/Post \\d+/")
      .first()
      .isVisible();

    // At least one should be visible to confirm posts are shown in assignments
    expect(hasPostHeader || hasPostNames).toBe(true);

    // Exit edit mode
    await editToggleButton.click();
  });
});
