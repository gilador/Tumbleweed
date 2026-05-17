import { test, expect, devices } from "@playwright/test";
import { installInitScript, waitForMobileApp } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// Intensity slider is now a click-track of `<div>` ticks (not <input
// type="range">). Each feasible tick has class `cursor-pointer`. Labels are
// "Few" (intense) / "Many" (relaxed). Shift info uses "Shifts: N" / "Min.
// rest: Xh" / "Duration: Xh".

test("adjusting intensity click-track changes shift count", async ({ page }) => {
  await installInitScript(page);
  await waitForMobileApp(page);

  // Add staff first so multiple feasible levels exist.
  await page.getByRole("navigation").getByRole("button", { name: "Staff" }).click();
  await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();
  const addFab = page.locator("button.fixed").filter({ has: page.locator("svg") });
  for (let i = 0; i < 5; i++) {
    await addFab.click();
    await page.waitForTimeout(150);
  }

  // Back to settings tab.
  await page.getByRole("navigation").getByRole("button", { name: "Posts" }).click();
  await expect(
    page.getByRole("heading", { name: /^Operation Hours$/ })
  ).toBeVisible();

  const intensityCard = page
    .locator(".rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: /^Shift Intensity$/ }) });

  // Slider labels.
  await expect(intensityCard.getByText(/^Few$/)).toBeVisible();
  await expect(intensityCard.getByText(/^Many$/)).toBeVisible();

  // Feasible click-track ticks.
  const ticks = intensityCard.locator(".cursor-pointer");
  const tickCount = await ticks.count();
  test.skip(
    tickCount < 2,
    "Need at least 2 feasible intensity levels to switch between"
  );

  const initialShifts = await intensityCard.getByText(/Shifts:\s*\d+/).textContent();

  // Click far-left tick (lowest intensity → most shifts).
  await ticks.first().click();
  await page.waitForTimeout(300);
  const leftShifts = await intensityCard.getByText(/Shifts:\s*\d+/).textContent();

  // Click far-right tick.
  await ticks.last().click();
  await page.waitForTimeout(300);
  const rightShifts = await intensityCard.getByText(/Shifts:\s*\d+/).textContent();

  expect(leftShifts).not.toBe(rightShifts);
  expect(initialShifts).toBeTruthy();
});
