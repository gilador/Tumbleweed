import { test, expect } from "@playwright/test";

test("adjusting intensity slider changes shift count", async ({ page }) => {
  await page.goto("/tumbleweed/");
  await expect(page.getByText("Tumbleweed")).toBeVisible({ timeout: 10000 });

  // Add staff first (need soldiers for intensity calc to produce shifts)
  await page.getByText("Staff").click();
  await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();
  const addFab = page.locator("button.fixed").filter({ has: page.locator("svg") });
  for (let i = 0; i < 5; i++) {
    await addFab.click();
    await page.waitForTimeout(200);
  }

  // Go back to settings
  await page.getByText("Settings").click();
  await page.waitForTimeout(500);

  // Locate intensity section
  const intensitySection = page.locator(".rounded-lg.border").filter({ hasText: "Intensity" });
  const slider = intensitySection.locator('input[type="range"]');
  await expect(slider).toBeVisible();

  const max = parseInt(await slider.getAttribute("max") || "0");
  console.log("Slider max:", max, "current value:", await slider.inputValue());

  // Read current shift info
  const shiftsEl = intensitySection.getByText(/\d+ shifts/);
  const durationEl = intensitySection.getByText(/\d+\.\dh each/);
  const initialShifts = await shiftsEl.textContent();
  const initialDuration = await durationEl.textContent();
  console.log("Initial:", initialShifts, initialDuration);

  // Click on the far left of the slider (intense end)
  const box = await slider.boundingBox();
  if (box && max > 0) {
    // Click at 10% from left (intense side)
    await page.mouse.click(box.x + box.width * 0.1, box.y + box.height / 2);
    await page.waitForTimeout(500);

    const afterLeftShifts = await shiftsEl.textContent();
    const afterLeftDuration = await durationEl.textContent();
    console.log("After clicking left (intense):", afterLeftShifts, afterLeftDuration);

    // Click at 90% from left (relaxed side)
    await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
    await page.waitForTimeout(500);

    const afterRightShifts = await shiftsEl.textContent();
    const afterRightDuration = await durationEl.textContent();
    console.log("After clicking right (relaxed):", afterRightShifts, afterRightDuration);

    // The two extremes should produce different shift counts
    expect(afterLeftShifts).not.toBe(afterRightShifts);
  }
});
