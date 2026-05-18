import { test, expect, devices, Page } from "@playwright/test";
import { installInitScript, waitForMobileApp } from "./helpers";

test.use({ ...devices["Pixel 7"] });

// Group C — Mobile staff name editing. Re-authored after the
// fix-mobile-staff-item-align-with-desktop-multiselect change: the inline
// pencil button is gone. Rename is now entered via a long-press (≥500 ms)
// on the leading name span (`[data-longpress-zone="name"]`). The inline
// input still surfaces as `[data-testid="edit-staff-name-input"]` with the
// current name pre-filled; Enter saves, Escape cancels, the trailing check
// button also saves.

const navigateToStaff = async (page: Page) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Staff" })
    .click();
  await expect(page.getByRole("heading", { name: /^Staff$/ })).toBeVisible();
};

async function longPressOnName(page: Page, rowLocator: string) {
  const nameSpan = page
    .locator(`${rowLocator} [data-longpress-zone="name"]`)
    .first();
  await expect(nameSpan).toBeVisible();
  const box = await nameSpan.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

const ROW = ".rounded-lg.border";

test.describe("Mobile Staff Name Editing (long-press)", () => {
  test.beforeEach(async ({ page }) => {
    await installInitScript(page);
    await waitForMobileApp(page);
    await navigateToStaff(page);
  });

  test("no inline pencil edit buttons render on staff rows", async ({
    page,
  }) => {
    // The old pencil testid is gone; rename is reachable only via long-press.
    await expect(page.locator('[data-testid^="edit-staff-"]')).toHaveCount(0);
  });

  test("long-press on the name span opens inline edit with current name", async ({
    page,
  }) => {
    const firstRow = page.locator(ROW).first();
    const originalName = (
      await firstRow.locator('[data-longpress-zone="name"]').first().textContent()
    )?.trim();
    expect(originalName).toBeTruthy();

    await longPressOnName(page, ROW);
    const input = page.locator('[data-testid="edit-staff-name-input"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue(originalName!);
  });

  test("can edit staff name and save with check button", async ({ page }) => {
    const firstRow = page.locator(ROW).first();
    await longPressOnName(page, ROW);
    const input = page.locator('[data-testid="edit-staff-name-input"]');
    await expect(input).toBeVisible();
    await input.fill("RenamedAlpha");
    // Save button is the check icon — first button next to the input.
    await firstRow.locator("button").first().click();
    await expect(input).toHaveCount(0);
    await expect(firstRow.getByText("RenamedAlpha")).toBeVisible();
  });

  test("pressing Escape cancels edit without saving", async ({ page }) => {
    const firstRow = page.locator(ROW).first();
    const originalName = (
      await firstRow.locator('[data-longpress-zone="name"]').first().textContent()
    )?.trim();
    expect(originalName).toBeTruthy();

    await longPressOnName(page, ROW);
    const input = page.locator('[data-testid="edit-staff-name-input"]');
    await input.fill("ShouldNotPersist");
    await input.press("Escape");
    await expect(input).toHaveCount(0);
    await expect(firstRow.getByText(originalName!)).toBeVisible();
    await expect(firstRow.getByText("ShouldNotPersist")).toHaveCount(0);
  });

  test("pressing Enter saves the edit", async ({ page }) => {
    const firstRow = page.locator(ROW).first();
    await longPressOnName(page, ROW);
    const input = page.locator('[data-testid="edit-staff-name-input"]');
    await input.fill("EnterSaved");
    await input.press("Enter");
    await expect(input).toHaveCount(0);
    await expect(firstRow.getByText("EnterSaved")).toBeVisible();
  });
});

// Hebrew RTL — verify long-press → rename still works with Hebrew names.
test.describe("Mobile Staff Name Editing — Hebrew RTL", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        localStorage.setItem("tumbleweed-lang", "he");
        localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
      } catch {
        /* ignore */
      }
    });
    await page.goto("/");
    await expect(page.getByRole("navigation")).toBeVisible({ timeout: 10000 });
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "צוות" })
      .click();
  });

  test("long-press on name → rename to Hebrew name persists with dir=rtl", async ({
    page,
  }) => {
    const firstRow = page.locator(ROW).first();
    await longPressOnName(page, ROW);
    const input = page.locator('[data-testid="edit-staff-name-input"]');
    await expect(input).toBeVisible();
    await input.fill("נתן חתוקה");
    await input.press("Enter");
    await expect(input).toHaveCount(0);
    await expect(firstRow.getByText("נתן חתוקה")).toBeVisible();
    const dir = await page.evaluate(() =>
      document.documentElement.getAttribute("dir")
    );
    expect(dir).toBe("rtl");
  });
});
