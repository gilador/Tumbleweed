import { test, expect, Page } from "@playwright/test";
import { createRequire } from "module";
import * as fs from "fs";
import * as path from "path";

const require = createRequire(import.meta.url);
const t = require("../../src/locales/he.json");
const pdfParse = require("pdf-parse");

// --- Helpers ---

async function dismissDrivePrompt(page: Page) {
  const notNowButton = page.getByRole("button", { name: /לא עכשיו|Not now/i });
  await notNowButton.click({ timeout: 10000 }).catch(() => {});
}

async function addStaff(page: Page, count: number) {
  const editToggle = page
    .locator('[aria-label*="עריכה"], [aria-label*="edit mode"]')
    .first();
  await editToggle.click();
  const addUserButton = page
    .locator('[aria-label*="הוסף איש"], [aria-label*="Add user"]')
    .first();
  await expect(addUserButton).toBeVisible({ timeout: 5000 });
  for (let i = 0; i < count; i++) {
    await addUserButton.click();
  }
  await editToggle.click();
}

async function runOptimizer(page: Page) {
  const optimizeButton = page.locator("#optimize-button");
  await expect(optimizeButton).toBeVisible();
  await optimizeButton.click();
  await expect(
    page.locator(`text=${t.hintOptimized}`)
  ).toBeVisible({ timeout: 30000 });
}

/** Verify the assignment grid has staff names (not just dashes) */
async function expectAssignmentsNotEmpty(page: Page) {
  // Count worker name instances on the page. Worker names: "עובד N" or "Member N"
  const workerNames = page.locator("text=/עובד \\d+|Member \\d+/");
  const totalMatches = await workerNames.count();
  // Sidebar has staff entries too. If workers are assigned in the grid,
  // total matches should exceed the sidebar count.
  const sidebarStaff = page.locator('[data-testid="staff-member"]');
  const sidebarCount = await sidebarStaff.count();
  expect(
    totalMatches,
    `Expected worker names in assignment grid. Total "${totalMatches}" should exceed sidebar count "${sidebarCount}"`
  ).toBeGreaterThan(sidebarCount);
}

async function setupDesktopWithAssignments(page: Page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/tumbleweed/");
  await dismissDrivePrompt(page);
  await expect(page.getByRole("heading", { name: t.staff })).toBeVisible({
    timeout: 10000,
  });

  await addStaff(page, 1);
  await runOptimizer(page);

  // Verify assignments actually exist — not just optimizer status
  await expectAssignmentsNotEmpty(page);
}

async function openSharePopup(page: Page) {
  const shareBtn = page.locator(`button[title="${t.shareSchedule}"]`);
  await expect(shareBtn).toBeVisible();
  await shareBtn.click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
}

async function switchToStaffMode(page: Page) {
  const dialog = page.locator('[role="dialog"]');
  await dialog.getByText(t.staffMember, { exact: true }).click();
}

/** Download a PDF and return its parsed text content */
async function downloadAndParsePdf(page: Page, dialog: ReturnType<Page["locator"]>): Promise<string> {
  const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
  await dialog.getByText(t.downloadPdf).click();
  const download = await downloadPromise;

  const tmpPath = path.join("/tmp", `test-pdf-${Date.now()}.pdf`);
  await download.saveAs(tmpPath);
  const buffer = fs.readFileSync(tmpPath);
  const parsed = await pdfParse(buffer);
  fs.unlinkSync(tmpPath);
  return parsed.text;
}

/** Check if text contains target in either direction (pdf-parse may reverse Hebrew) */
function containsEither(text: string, target: string): boolean {
  const reverse = (s: string) => [...s].reverse().join("");
  return text.includes(target) || text.includes(reverse(target));
}

// --- Desktop UI Tests ---

test.describe("Share Popup - Desktop", () => {
  test.beforeEach(async ({ page }) => {
    await setupDesktopWithAssignments(page);
  });

  test("opens share dialog and shows all elements", async ({ page }) => {
    await openSharePopup(page);
    const dialog = page.locator('[role="dialog"]');

    await expect(dialog.getByText(t.fullRoster, { exact: true })).toBeVisible();
    await expect(dialog.getByText(t.staffMember, { exact: true })).toBeVisible();

    await expect(dialog.getByText(t.downloadPdf)).toBeVisible();
    await expect(dialog.getByText(t.print, { exact: true })).toBeVisible();
    await expect(dialog.getByText(t.whatsapp)).toBeVisible();
  });

  test("toggles between full roster and staff member view", async ({ page }) => {
    await openSharePopup(page);
    const dialog = page.locator('[role="dialog"]');

    const staffList = dialog.locator(".max-h-\\[160px\\]");
    await expect(staffList).not.toBeVisible();

    await switchToStaffMode(page);

    await expect(staffList).toBeVisible();
    const staffButtons = staffList.locator("button");
    const count = await staffButtons.count();
    expect(count).toBeGreaterThan(0);

    await dialog.getByText(t.fullRoster, { exact: true }).click();
    await expect(staffList).not.toBeVisible();
  });

  test("can select different staff members", async ({ page }) => {
    await openSharePopup(page);
    await switchToStaffMode(page);

    const dialog = page.locator('[role="dialog"]');
    const staffList = dialog.locator(".max-h-\\[160px\\]");
    const staffButtons = staffList.locator("button");
    const count = await staffButtons.count();

    // Must have at least 2 staff to test selection
    expect(count, "Need at least 2 assigned staff to test selection").toBeGreaterThanOrEqual(2);

    await staffButtons.nth(1).click();
    await expect(staffButtons.nth(1)).toHaveClass(/font-medium/);
    await expect(staffButtons.nth(0)).not.toHaveClass(/font-medium/);
  });

  test("download full roster PDF triggers a download", async ({ page }) => {
    await openSharePopup(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    const dialog = page.locator('[role="dialog"]');
    await dialog.getByText(t.downloadPdf).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test("download staff PDF triggers a download", async ({ page }) => {
    await openSharePopup(page);
    await switchToStaffMode(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    const dialog = page.locator('[role="dialog"]');
    await dialog.getByText(t.downloadPdf).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test("closes dialog via close button", async ({ page }) => {
    await openSharePopup(page);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Close" }).click();

    await expect(dialog).not.toBeVisible();
  });
});

// --- PDF Content Validation Tests ---

test.describe("Share Popup - PDF Content (24H)", () => {
  test.beforeEach(async ({ page }) => {
    await setupDesktopWithAssignments(page);
  });

  test("full roster PDF contains Hebrew post names and staff names", async ({ page }) => {
    // Grab post names from UI
    const postNames: string[] = [];
    const postElements = page.locator("#assignments-table td:first-child, #assignments-table th:first-child");
    const postCount = await postElements.count();
    for (let i = 0; i < postCount; i++) {
      const text = await postElements.nth(i).innerText();
      if (text.trim() && text.includes("עמדה")) {
        postNames.push(text.trim());
      }
    }

    // Get staff names from sidebar
    const staffNames: string[] = [];
    const staffElements = page.locator('[data-testid="staff-member"]');
    const staffCount = await staffElements.count();
    for (let i = 0; i < staffCount; i++) {
      const text = await staffElements.nth(i).innerText();
      if (text.trim()) {
        staffNames.push(text.trim().split("\n")[0]);
      }
    }

    await openSharePopup(page);
    const dialog = page.locator('[role="dialog"]');
    const pdfText = await downloadAndParsePdf(page, dialog);

    // PDF should contain Hebrew post names
    for (const postName of postNames) {
      const hebrewPart = postName.replace(/[^א-ת]/g, "");
      expect(
        containsEither(pdfText, hebrewPart),
        `PDF should contain post name "${hebrewPart}". Got: ${pdfText.slice(0, 300)}`
      ).toBe(true);
    }

    // PDF should contain at least some staff names in assignment cells (not just sidebar)
    const foundStaff = staffNames.filter((name) => {
      const hebrewPart = name.replace(/[^א-ת]/g, "");
      return hebrewPart ? containsEither(pdfText, hebrewPart) : pdfText.includes(name);
    });
    expect(
      foundStaff.length,
      `PDF should contain staff names in assignments. Found ${foundStaff.length} of ${staffNames.length}: ${staffNames.join(", ")}. PDF text: ${pdfText.slice(0, 300)}`
    ).toBeGreaterThan(0);

    expect(pdfText).toContain("Tumbleweed");
  });

  test("staff PDF contains the selected staff member name and their assignments", async ({ page }) => {
    const staffElement = page.locator('[data-testid="staff-member"]').first();
    const staffFullText = await staffElement.innerText();
    const staffName = staffFullText.trim().split("\n")[0];

    await openSharePopup(page);
    await switchToStaffMode(page);

    const dialog = page.locator('[role="dialog"]');
    const pdfText = await downloadAndParsePdf(page, dialog);

    // Staff name should appear in PDF
    const hebrewPart = staffName.replace(/[^א-ת]/g, "");
    const containsName = hebrewPart
      ? containsEither(pdfText, hebrewPart)
      : pdfText.includes(staffName);
    expect(containsName, `PDF should contain staff name "${staffName}". Got: ${pdfText.slice(0, 200)}`).toBe(true);

    // Should contain time ranges (actual assignment data)
    expect(pdfText).toMatch(/\d{2}:\d{2}/);

    expect(pdfText).toContain("Tumbleweed");
  });

  test("full roster PDF contains time range headers", async ({ page }) => {
    await openSharePopup(page);
    const dialog = page.locator('[role="dialog"]');
    const pdfText = await downloadAndParsePdf(page, dialog);

    expect(pdfText).toMatch(/\d{2}:\d{2}-\d{2}:\d{2}/);
  });

  test("full roster PDF renders Hebrew correctly (not gibberish)", async ({ page }) => {
    await openSharePopup(page);
    const dialog = page.locator('[role="dialog"]');
    const pdfText = await downloadAndParsePdf(page, dialog);

    expect(
      containsEither(pdfText, "תפקיד"),
      `PDF should contain Hebrew header 'תפקיד'. Got: ${pdfText.slice(0, 200)}`
    ).toBe(true);

    expect(
      containsEither(pdfText, "עמדה"),
      `PDF should contain Hebrew post name 'עמדה'. Got: ${pdfText.slice(0, 200)}`
    ).toBe(true);
  });
});

// --- Weekly PDF Test (separate setup, no shared beforeEach) ---

test.describe("Share Popup - PDF Content (Weekly 7D)", () => {
  test("weekly roster PDF with 2 posts, 7 staff contains valid assignments", async ({ page }) => {
    // Fresh setup for weekly mode
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/tumbleweed/");
    await dismissDrivePrompt(page);
    await expect(page.getByRole("heading", { name: t.staff })).toBeVisible({ timeout: 10000 });

    // Default is 2 staff, add 5 more for 7 total
    await addStaff(page, 5);

    // Switch to 7D weekly mode
    const configToggle = page.locator('[aria-label*="הגדרות משמרת"], [aria-label*="shift"]').first();
    await configToggle.click();
    await page.getByRole("button", { name: "7D" }).click();
    await configToggle.click();

    // Wait for weekly tabs to appear
    await expect(page.getByRole("tab")).toHaveCount(7, { timeout: 5000 });

    // Run optimization
    await runOptimizer(page);

    // Verify assignments actually exist in the grid (not all dashes)
    await expectAssignmentsNotEmpty(page);

    // Now test the PDF
    await openSharePopup(page);
    const dialog = page.locator('[role="dialog"]');
    const pdfText = await downloadAndParsePdf(page, dialog);

    // Should contain time ranges
    expect(pdfText).toMatch(/\d{2}:\d{2}-\d{2}:\d{2}/);

    // Should contain "Tumbleweed" footer
    expect(pdfText).toContain("Tumbleweed");

    // Should contain Hebrew post names
    expect(
      containsEither(pdfText, "עמדה"),
      `Weekly PDF should contain Hebrew post names. Got: ${pdfText.slice(0, 300)}`
    ).toBe(true);

    // Should contain actual staff names in assignments (not just headers)
    // Default Hebrew staff name pattern: "עובד N"
    const hasStaffInPdf = containsEither(pdfText, "עובד") || pdfText.match(/Member \d+/);
    expect(
      hasStaffInPdf,
      `Weekly PDF should contain staff names in assignment cells. Got: ${pdfText.slice(0, 400)}`
    ).toBeTruthy();

    // Should have substantial content (7 days × 2 posts)
    expect(pdfText.length).toBeGreaterThan(200);
  });
});
