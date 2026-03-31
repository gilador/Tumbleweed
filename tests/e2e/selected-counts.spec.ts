import { test, expect } from "@playwright/test";

test.describe("Selected Items Count Display", () => {
  test("shows selected staff count when more than 1 staff member is selected", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Staff \(\d+\)/ })
    ).toBeVisible();

    // Enter edit mode
    const editToggleButton = page
      .getByRole("button", { name: "Enter edit mode" })
      .first();
    await editToggleButton.click();

    // Wait for edit mode to activate
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // Initially, no selected count should be shown
    await expect(
      page.getByRole("heading", { name: /Staff \(\d+\)$/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Staff \(\d+, \d+ selected\)/ })
    ).not.toBeVisible();

    // Select first staff member - should now show selected count (1 selected)
    const staffMembers = page.locator('[data-testid="staff-member"]');
    const firstCheckbox = staffMembers.nth(0).getByRole("checkbox");
    await firstCheckbox.click();

    // Should now show "1 selected"
    await expect(
      page.getByRole("heading", { name: /Staff \(\d+, 1 selected\)/ })
    ).toBeVisible();

    // Select second staff member - now should show selected count
    const secondCheckbox = staffMembers.nth(1).getByRole("checkbox");
    await secondCheckbox.click();

    // Should now show "2 selected"
    await expect(
      page.getByRole("heading", { name: /Staff \(\d+, 2 selected\)/ })
    ).toBeVisible();

    // Select third staff member - should update to "3 selected"
    const thirdCheckbox = staffMembers.nth(2).getByRole("checkbox");
    await thirdCheckbox.click();

    await expect(
      page.getByRole("heading", { name: /Staff \(\d+, 3 selected\)/ })
    ).toBeVisible();

    // Unselect one - should show "2 selected"
    await thirdCheckbox.click();

    await expect(
      page.getByRole("heading", { name: /Staff \(\d+, 2 selected\)/ })
    ).toBeVisible();

    // Unselect another - should show "1 selected" (1 left)
    await secondCheckbox.click();

    await expect(
      page.getByRole("heading", { name: /Staff \(\d+, 1 selected\)/ })
    ).toBeVisible();

    // Unselect the last one - should hide selected count (0 selected)
    await firstCheckbox.click();

    await expect(
      page.getByRole("heading", { name: /Staff \(\d+\)$/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Staff \(\d+, \d+ selected\)/ })
    ).not.toBeVisible();

    // Exit edit mode
    await editToggleButton.click();
  });

  test("shows selected posts count when more than 1 post is selected", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for app to load
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Shift Assignments \(\d+\)/ })
    ).toBeVisible();

    // Enter edit mode
    const editToggleButton = page
      .getByRole("button", { name: "Enter edit mode" })
      .first();
    await editToggleButton.click();

    // Wait for edit mode to activate
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // Initially, no selected count should be shown
    await expect(
      page.getByRole("heading", { name: /Shift Assignments \(\d+\)$/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Shift Assignments \(\d+, \d+ selected\)/,
      })
    ).not.toBeVisible();

    // Find posts in the assignments section
    const assignmentsSection = page
      .locator('text="Shift Assignments"')
      .locator("..")
      .locator("..");

    const postCheckboxes = assignmentsSection.getByRole("checkbox");
    const postCount = await postCheckboxes.count();

    if (postCount >= 2) {
      // Select first post - should now show selected count (1 selected)
      await postCheckboxes.nth(0).click();

      // Should now show "1 selected"
      await expect(
        page.getByRole("heading", {
          name: /Shift Assignments \(\d+, 1 selected\)/,
        })
      ).toBeVisible();

      // Select second post - now should show selected count
      await postCheckboxes.nth(1).click();

      // Should now show "2 selected"
      await expect(
        page.getByRole("heading", {
          name: /Shift Assignments \(\d+, 2 selected\)/,
        })
      ).toBeVisible();

      if (postCount >= 3) {
        // Select third post - should update to "3 selected"
        await postCheckboxes.nth(2).click();

        await expect(
          page.getByRole("heading", {
            name: /Shift Assignments \(\d+, 3 selected\)/,
          })
        ).toBeVisible();

        // Unselect one - should show "2 selected"
        await postCheckboxes.nth(2).click();

        await expect(
          page.getByRole("heading", {
            name: /Shift Assignments \(\d+, 2 selected\)/,
          })
        ).toBeVisible();
      }

      // Unselect to get back to 1 - should show "1 selected"
      await postCheckboxes.nth(1).click();

      await expect(
        page.getByRole("heading", {
          name: /Shift Assignments \(\d+, 1 selected\)/,
        })
      ).toBeVisible();

      // Unselect the last one - should hide selected count
      await postCheckboxes.nth(0).click();

      await expect(
        page.getByRole("heading", { name: /Shift Assignments \(\d+\)$/ })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: /Shift Assignments \(\d+, \d+ selected\)/,
        })
      ).not.toBeVisible();
    }

    // Exit edit mode
    await editToggleButton.click();
  });

  test("selected count behavior when toggling edit mode", async ({ page }) => {
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

    // Select multiple staff members
    const staffMembers = page.locator('[data-testid="staff-member"]');
    const firstCheckbox = staffMembers.nth(0).getByRole("checkbox");
    const secondCheckbox = staffMembers.nth(1).getByRole("checkbox");

    await firstCheckbox.click();
    await secondCheckbox.click();

    // Should show selected count
    await expect(
      page.getByRole("heading", { name: /Staff \(\d+, 2 selected\)/ })
    ).toBeVisible();

    // Exit edit mode
    await editToggleButton.click();

    // Wait for edit mode to fully exit
    await page.waitForTimeout(500);

    // Re-enter edit mode to test that selections can be made again
    await editToggleButton.click();
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();

    // The title should be visible (whether with or without selected count is implementation dependent)
    await expect(
      page.getByRole("heading", { name: /Staff \(\d+/ })
    ).toBeVisible();

    // Exit edit mode
    await editToggleButton.click();
  });

  test("select all functionality updates the selected count correctly", async ({
    page,
  }) => {
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
    const staffTitle = await page
      .getByRole("heading", { name: /Staff \(\d+\)/ })
      .textContent();
    const totalStaffCount = parseInt(
      staffTitle?.match(/Staff \((\d+)\)/)?.[1] || "0"
    );

    // Use select all button for staff
    const selectAllUsersButton = page.getByRole("button", {
      name: "Select all users",
    });
    await selectAllUsersButton.click();

    // Should show all staff selected (if more than 1)
    if (totalStaffCount > 1) {
      await expect(
        page.getByRole("heading", {
          name: new RegExp(
            `Staff \\(${totalStaffCount}, ${totalStaffCount} selected\\)`
          ),
        })
      ).toBeVisible();
    }

    // Click select all again to deselect all
    await selectAllUsersButton.click();

    // Should not show selected count
    await expect(
      page.getByRole("heading", { name: /Staff \(\d+\)$/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Staff \(\d+, \d+ selected\)/ })
    ).not.toBeVisible();

    // Exit edit mode
    await editToggleButton.click();
  });

  test("selected count format is correct", async ({ page }) => {
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

    // Select multiple staff members
    const staffMembers = page.locator('[data-testid="staff-member"]');
    await staffMembers.nth(0).getByRole("checkbox").click();
    await staffMembers.nth(1).getByRole("checkbox").click();

    // Get the title text and verify format
    const titleElement = page.getByRole("heading", {
      name: /Staff \(\d+, \d+ selected\)/,
    });
    await expect(titleElement).toBeVisible();

    const titleText = await titleElement.textContent();

    // Should match format: "Staff (total, selected selected)"
    expect(titleText).toMatch(/^Staff \(\d+, \d+ selected\)$/);

    // Verify the numbers make sense
    const match = titleText?.match(/Staff \((\d+), (\d+) selected\)/);
    if (match) {
      const totalCount = parseInt(match[1]);
      const selectedCount = parseInt(match[2]);

      expect(selectedCount).toBeGreaterThan(0); // Should show when > 0
      expect(selectedCount).toBeLessThanOrEqual(totalCount); // Can't select more than total
      expect(selectedCount).toBe(2); // We selected 2 items
    }

    // Exit edit mode
    await editToggleButton.click();
  });
});
