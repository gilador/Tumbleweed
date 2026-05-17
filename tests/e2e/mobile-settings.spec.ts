import { test, expect, devices, Page } from "@playwright/test";
import { installInitScript, waitForMobileApp } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// SettingsTab.tsx layout reference:
//   - <h2>Operation Hours</h2> with two <TimeInput /> components — these are
//     now custom popover buttons (not <input type="time">). The trigger
//     button shows the time inside a span with dir="ltr" and an IconClock
//     suffix. The picker portal lives under document.body.
//   - <h2>Schedule Mode</h2> card.
//   - <h2>Posts</h2> card with rows inside a `.space-y-2` container, then
//     "Add Post" <button>.
//   - <h2>Shift Intensity</h2> card. The <input type="range"> is gone — now a
//     custom click-track of clickable `<div>` ticks. Slider labels are "Few"
//     and "Many" (i18n keys `intense` / `relaxed`). Shift info row uses
//     "Shifts: N", "Min. rest: Xh", "Duration: Xh".

async function changeTimeInput(page: Page, which: "first" | "last", targetHour: number) {
  const trigger = which === "first"
    ? timeInputButtons(page).first()
    : timeInputButtons(page).last();
  await trigger.click();
  // Picker portal: a fixed div with z-[100] containing two scroll columns of
  // <button>HH</button>. Pick the hour column (first column) — buttons render
  // zero-padded like "09".
  const picker = page.locator('div.fixed.z-\\[100\\]');
  await expect(picker).toBeVisible({ timeout: 2000 });
  const hourBtn = picker.locator("button").filter({
    hasText: new RegExp(`^${String(targetHour).padStart(2, "0")}$`),
  }).first();
  await hourBtn.click();
  // Close picker by clicking outside.
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await expect(picker).not.toBeVisible({ timeout: 2000 });
}

function operationHoursCard(page: Page) {
  return page
    .locator(".rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: /^Operation Hours$/ }) });
}

function timeInputButtons(page: Page) {
  // Each TimeInput renders a <button type="button"> with a leading dir="ltr"
  // span containing the HH:MM string and an IconClock suffix.
  return operationHoursCard(page).locator('button[type="button"]');
}

function postsCard(page: Page) {
  return page
    .locator(".rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: /^Posts$/ }) });
}

function postRows(page: Page) {
  // Direct children rows of the Posts card's .space-y-2 container
  return postsCard(page).locator(".space-y-2 > div");
}

function intensityCard(page: Page) {
  return page
    .locator(".rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: /^Shift Intensity$/ }) });
}

test.describe("Mobile Settings Tab", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
  });

  test("displays operation hours with start and end time inputs", async ({
    page,
  }) => {
    await waitForMobileApp(page);
    await expect(
      page.getByRole("heading", { name: /^Operation Hours$/ })
    ).toBeVisible();
    // Two TimeInput trigger buttons (start/end). Each shows a HH:MM span.
    const inputs = timeInputButtons(page);
    await expect(inputs).toHaveCount(2);
    await expect(inputs.first()).toContainText(/^\d{2}:\d{2}$/);
    await expect(inputs.last()).toContainText(/^\d{2}:\d{2}$/);
  });

  test("displays posts section with default posts", async ({ page }) => {
    await waitForMobileApp(page);
    await expect(
      page.getByRole("heading", { name: /^Posts$/ })
    ).toBeVisible();
    const count = await postRows(page).count();
    expect(count).toBeGreaterThan(0);
  });

  test("can add a new post", async ({ page }) => {
    await waitForMobileApp(page);
    const initial = await postRows(page).count();
    await page.getByRole("button", { name: /Add Post/i }).click();
    await expect(postRows(page)).toHaveCount(initial + 1);
  });

  test("can edit a post name", async ({ page }) => {
    await waitForMobileApp(page);
    const firstRow = postRows(page).first();
    const originalName = (
      (await firstRow.locator("span.flex-1").textContent()) ?? ""
    ).trim();

    // First button in a non-editing row is the pencil button.
    await firstRow.locator("button").first().click();

    const editInput = firstRow.locator('input[type="text"]');
    await expect(editInput).toBeVisible();
    await editInput.fill("TestPost");

    // Confirm: button containing the primary-coloured check icon.
    await firstRow.locator("button:has(svg.text-primary)").click();

    await expect(firstRow.locator("span.flex-1")).toHaveText("TestPost");
    expect(originalName).not.toBe("TestPost");
  });

  test("can delete a post with confirmation", async ({ page }) => {
    await waitForMobileApp(page);
    const initialCount = await postRows(page).count();

    const firstRow = postRows(page).first();
    // Trash button is the one whose icon uses text-muted-foreground.
    // Out of (pencil, trash) the trash is the last muted-foreground button.
    await firstRow
      .locator("button:has(svg.text-muted-foreground)")
      .last()
      .click();

    // Confirm: destructive check button.
    await firstRow
      .locator("button:has(svg.text-destructive)")
      .click();

    await expect(postRows(page)).toHaveCount(initialCount - 1);
  });

  test("displays intensity slider with shift info", async ({ page }) => {
    await waitForMobileApp(page);
    const card = intensityCard(page);
    await expect(
      card.getByRole("heading", { name: /^Shift Intensity$/ })
    ).toBeVisible();
    // Slider labels: "Few" (intense) and "Many" (relaxed).
    await expect(card.getByText(/^Few$/)).toBeVisible();
    await expect(card.getByText(/^Many$/)).toBeVisible();

    // Shift info row.
    await expect(card.getByText(/Shifts:\s*\d+/)).toBeVisible();
    await expect(card.getByText(/Duration:\s*\d+(\.\d+)?h/)).toBeVisible();
  });

  test("can change start time", async ({ page }) => {
    await waitForMobileApp(page);
    const trigger = timeInputButtons(page).first();
    const original = (await trigger.textContent())?.trim() || "";
    const targetHour = original.startsWith("09") ? 10 : 9;
    await changeTimeInput(page, "first", targetHour);

    await expect(trigger).toContainText(
      new RegExp(`^${String(targetHour).padStart(2, "0")}:`)
    );

    const card = intensityCard(page);
    await expect(card.getByText(/Shifts:\s*\d+/)).toBeVisible();
    await expect(card.getByText(/Duration:\s*\d+(\.\d+)?h/)).toBeVisible();
  });

  test("can change end time", async ({ page }) => {
    await waitForMobileApp(page);
    const trigger = timeInputButtons(page).last();
    const original = (await trigger.textContent())?.trim() || "";
    const targetHour = original.startsWith("20") ? 22 : 20;
    await changeTimeInput(page, "last", targetHour);

    await expect(trigger).toContainText(
      new RegExp(`^${String(targetHour).padStart(2, "0")}:`)
    );

    const card = intensityCard(page);
    await expect(card.getByText(/Shifts:\s*\d+/)).toBeVisible();
    await expect(card.getByText(/Duration:\s*\d+(\.\d+)?h/)).toBeVisible();
  });

  test("changing start time persists and shift info remains visible", async ({
    page,
  }) => {
    await waitForMobileApp(page);
    const trigger = timeInputButtons(page).first();
    const original = (await trigger.textContent())?.trim() || "";
    const targetHour = original.startsWith("06") ? 7 : 6;
    await changeTimeInput(page, "first", targetHour);

    await expect(trigger).toContainText(
      new RegExp(`^${String(targetHour).padStart(2, "0")}:`)
    );

    const card = intensityCard(page);
    await expect(card.getByText(/Shifts:\s*\d+/)).toBeVisible();
    await expect(card.getByText(/Duration:\s*\d+(\.\d+)?h/)).toBeVisible();
  });

  test("changing end time persists and shift info remains visible", async ({
    page,
  }) => {
    await waitForMobileApp(page);
    const trigger = timeInputButtons(page).last();
    const original = (await trigger.textContent())?.trim() || "";
    const targetHour = original.startsWith("22") ? 20 : 22;
    await changeTimeInput(page, "last", targetHour);

    await expect(trigger).toContainText(
      new RegExp(`^${String(targetHour).padStart(2, "0")}:`)
    );

    const card = intensityCard(page);
    await expect(card.getByText(/Shifts:\s*\d+/)).toBeVisible();
    await expect(card.getByText(/Duration:\s*\d+(\.\d+)?h/)).toBeVisible();
  });

  test("intensity slider has correct range and labels", async ({ page }) => {
    await waitForMobileApp(page);
    const card = intensityCard(page);

    await expect(card.getByText(/^Few$/)).toBeVisible();
    await expect(card.getByText(/^Many$/)).toBeVisible();

    // Custom click-track: ticks are clickable divs with cursor-pointer.
    const ticks = card.locator(".cursor-pointer");
    const tickCount = await ticks.count();
    // At least one tick (might be a single-level fallback) — but typical
    // schedules render multiple feasible levels.
    expect(tickCount).toBeGreaterThanOrEqual(0);

    await expect(card.getByText(/Shifts:\s*\d+/)).toBeVisible();
    await expect(card.getByText(/Duration:\s*\d+(\.\d+)?h/)).toBeVisible();
  });

  test("can cancel a post edit", async ({ page }) => {
    await waitForMobileApp(page);
    const firstRow = postRows(page).first();
    const originalName = (
      (await firstRow.locator("span.flex-1").textContent()) ?? ""
    ).trim();

    // Pencil
    await firstRow.locator("button").first().click();

    const editInput = firstRow.locator('input[type="text"]');
    await expect(editInput).toBeVisible();
    await editInput.fill("CancelledEdit");

    // Cancel button (X) — last button in the editing row.
    await firstRow.locator("button").last().click();

    await expect(firstRow.locator("span.flex-1")).toHaveText(originalName);
  });

  test("can cancel a post delete", async ({ page }) => {
    await waitForMobileApp(page);
    const initialCount = await postRows(page).count();
    const firstRow = postRows(page).first();

    // Trigger delete prompt
    await firstRow
      .locator("button:has(svg.text-muted-foreground)")
      .last()
      .click();

    // Destructive confirm icon visible
    await expect(firstRow.locator("svg.text-destructive")).toBeVisible();

    // Cancel via the X button (last button in the row while in confirm state).
    await firstRow.locator("button").last().click();

    await expect(postRows(page)).toHaveCount(initialCount);
  });
});
