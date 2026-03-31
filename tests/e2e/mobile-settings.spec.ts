import { test, expect } from "@playwright/test";

test.describe("Mobile Settings Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tumbleweed/");
    await expect(page.getByText("Tumbleweed")).toBeVisible({ timeout: 10000 });
  });

  test("displays operation hours with start and end time inputs", async ({
    page,
  }) => {
    await expect(page.getByText("Operation Hours")).toBeVisible();
    const timeInputs = page.locator('input[type="time"]');
    await expect(timeInputs).toHaveCount(2);
  });

  test("displays posts section with default posts", async ({ page }) => {
    await expect(page.getByText("Posts")).toBeVisible();
    // Default posts should exist
    const postItems = page.locator(".space-y-2 > div");
    const count = await postItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test("can add a new post", async ({ page }) => {
    const initialPostCount = await page
      .locator(".space-y-2 > div")
      .count();
    await page.getByText("Add Post").click();
    await expect(page.locator(".space-y-2 > div")).toHaveCount(
      initialPostCount + 1
    );
  });

  test("can edit a post name", async ({ page }) => {
    // Click the edit (pencil) button on the first post
    const firstPostRow = page.locator(".space-y-2 > div").first();
    const postName = await firstPostRow.locator("span.flex-1").textContent();

    // Click the pencil icon button
    await firstPostRow
      .locator('button:has(svg)')
      .first()
      .click();

    // Should show input with current name
    const editInput = firstPostRow.locator('input[type="text"]');
    await expect(editInput).toBeVisible();

    // Clear and type new name
    await editInput.fill("TestPost");

    // Confirm edit (click check button)
    await firstPostRow
      .locator('button:has(svg.text-primary)')
      .click();

    // Verify name changed
    await expect(firstPostRow.locator("span.flex-1")).toHaveText("TestPost");
    expect(postName).not.toBe("TestPost");
  });

  test("can delete a post with confirmation", async ({ page }) => {
    const initialCount = await page
      .locator(".space-y-2 > div")
      .count();

    // Click trash icon on first post
    const firstPostRow = page.locator(".space-y-2 > div").first();
    await firstPostRow
      .locator('button:has(svg.text-muted-foreground)')
      .last()
      .click();

    // Confirm delete (click the check/confirm button)
    await firstPostRow
      .locator('button:has(svg.text-destructive)')
      .click();

    // One fewer post
    await expect(page.locator(".space-y-2 > div")).toHaveCount(
      initialCount - 1
    );
  });

  test("displays intensity slider with shift info", async ({ page }) => {
    await expect(page.getByText("Intensity")).toBeVisible();
    await expect(page.getByText("Intense")).toBeVisible();
    await expect(page.getByText("Relaxed")).toBeVisible();

    // Should show shifts count and duration
    await expect(page.getByText(/\d+ shifts/)).toBeVisible();
    await expect(page.getByText(/\d+\.\dh each/)).toBeVisible();
  });

  test("can change start time", async ({ page }) => {
    const startInput = page.locator('input[type="time"]').first();
    const originalValue = await startInput.inputValue();

    // Change start time to 09:00
    const newTime = originalValue === "09:00" ? "10:00" : "09:00";
    await startInput.fill(newTime);

    // Verify the input updated
    await expect(startInput).toHaveValue(newTime);

    // Shift info should update (shifts count or duration may change)
    await expect(page.getByText(/\d+ shifts/)).toBeVisible();
    await expect(page.getByText(/\d+\.\dh each/)).toBeVisible();
  });

  test("can change end time", async ({ page }) => {
    const endInput = page.locator('input[type="time"]').last();
    const originalValue = await endInput.inputValue();

    // Change end time to 20:00
    const newTime = originalValue === "20:00" ? "22:00" : "20:00";
    await endInput.fill(newTime);

    // Verify the input updated
    await expect(endInput).toHaveValue(newTime);

    // Shift info should reflect new hours
    await expect(page.getByText(/\d+ shifts/)).toBeVisible();
    await expect(page.getByText(/\d+\.\dh each/)).toBeVisible();
  });

  test("changing start time persists and shift info remains visible", async ({
    page,
  }) => {
    const startInput = page.locator('input[type="time"]').first();
    const originalValue = await startInput.inputValue();
    const newTime = originalValue === "06:00" ? "07:00" : "06:00";

    await startInput.fill(newTime);
    await expect(startInput).toHaveValue(newTime);

    // Shift info section should still render after change
    const intensitySection = page
      .locator(".rounded-lg.border")
      .filter({ hasText: "Intensity" });
    await expect(intensitySection.getByText(/\d+ shifts/)).toBeVisible();
    await expect(intensitySection.getByText(/\d+\.\dh each/)).toBeVisible();
  });

  test("changing end time persists and shift info remains visible", async ({
    page,
  }) => {
    const endInput = page.locator('input[type="time"]').last();
    const originalValue = await endInput.inputValue();
    const newTime = originalValue === "22:00" ? "20:00" : "22:00";

    await endInput.fill(newTime);
    await expect(endInput).toHaveValue(newTime);

    const intensitySection = page
      .locator(".rounded-lg.border")
      .filter({ hasText: "Intensity" });
    await expect(intensitySection.getByText(/\d+ shifts/)).toBeVisible();
    await expect(intensitySection.getByText(/\d+\.\dh each/)).toBeVisible();
  });

  test("intensity slider has correct range and labels", async ({ page }) => {
    const intensitySection = page
      .locator(".rounded-lg.border")
      .filter({ hasText: "Intensity" });

    // Labels present
    await expect(intensitySection.getByText("Intense")).toBeVisible();
    await expect(intensitySection.getByText("Relaxed")).toBeVisible();

    // Slider exists with valid range
    const slider = intensitySection.locator('input[type="range"]');
    await expect(slider).toBeVisible();
    const min = await slider.getAttribute("min");
    const max = await slider.getAttribute("max");
    expect(parseInt(min || "0")).toBe(0);
    expect(parseInt(max || "0")).toBeGreaterThanOrEqual(1);

    // Shift info displays
    await expect(intensitySection.getByText(/\d+ shifts/)).toBeVisible();
    await expect(intensitySection.getByText(/\d+\.\dh each/)).toBeVisible();
  });

  test("can cancel a post edit", async ({ page }) => {
    const firstPostRow = page.locator(".space-y-2 > div").first();
    const originalName = await firstPostRow.locator("span.flex-1").textContent();

    // Click pencil to start editing
    await firstPostRow.locator('button:has(svg)').first().click();

    // Edit input should appear
    const editInput = firstPostRow.locator('input[type="text"]');
    await expect(editInput).toBeVisible();

    // Type something different
    await editInput.fill("CancelledEdit");

    // Click the X button to cancel
    await firstPostRow.locator('button:has(svg)').last().click();

    // Name should be unchanged
    await expect(firstPostRow.locator("span.flex-1")).toHaveText(originalName!);
  });

  test("can cancel a post delete", async ({ page }) => {
    const initialCount = await page.locator(".space-y-2 > div").count();
    const firstPostRow = page.locator(".space-y-2 > div").first();

    // Click trash icon
    await firstPostRow.locator('button:has(svg.text-muted-foreground)').last().click();

    // Should show confirm/cancel buttons
    await expect(firstPostRow.locator('svg.text-destructive')).toBeVisible();

    // Click X to cancel delete
    await firstPostRow.locator('button:has(svg)').last().click();

    // Post count should remain the same
    await expect(page.locator(".space-y-2 > div")).toHaveCount(initialCount);
  });
});
