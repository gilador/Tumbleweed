import { test, expect, Page } from "@playwright/test";

// QA probe — Round 1, task: show-optimization-duration-in-success-toast
//
// Per CTO mandate + the rtl-bidi-visual-verify and layout-integration-probe
// memories: source-shape regex on the formatter is not sufficient. We must
// open the live success toast in both locales and assert that the duration
// token actually renders as a single LTR atomic group inside the message —
// digits don't reorder, parens don't mirror, bbox is non-zero.
//
// Also smoke-checks postWasAdded / userWasAddedToStaff in `he` locale to
// verify the global `dir="ltr"` added to Toast.tsx highlight span at line 64
// did NOT regress existing toasts that pass a Hebrew name containing digits
// as highlightText (e.g. "עובד 2").

const STAFF_ROW = '[data-testid="staff-member"]';

async function installLocaleInitScript(page: Page, lang: "en" | "he") {
  await page.addInitScript((l) => {
    try {
      localStorage.clear();
      localStorage.setItem("tumbleweed-lang", l);
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    } catch {
      /* ignore */
    }
  }, lang);
}

async function waitForAppLang(page: Page, lang: "en" | "he") {
  await page.goto("/");
  const current = await page.evaluate(() =>
    window.localStorage.getItem("tumbleweed-lang")
  );
  if (current !== lang) {
    await page.evaluate((l) => {
      localStorage.setItem("tumbleweed-lang", l);
      localStorage.setItem("tumbleweed-drive-connect-dismissed", "true");
    }, lang);
    await page.reload();
  }
  await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
  // Schedule heading (en) or its Hebrew equivalent. Looser: wait for the
  // staff section header so the Add button is mounted.
  await expect(
    page.locator('[data-testid="staff-controls-row"]')
  ).toBeVisible({ timeout: 10000 });
}

async function addStaff(page: Page, count: number) {
  // The StaffSectionHeader renders the "Add" / "הוסף" button (label = the
  // localised addUserShort). It's the only button in staff-controls-row when
  // no staff are selected (BulkSelectionBar renders null until multi-select).
  // Some seed states have a schedule-section-content overlay intercepting
  // pointer events during initial render. Dispatch the click via JS so it
  // fires the React onClick regardless of any z-order interceptor.
  const addBtn = page
    .locator('[data-testid="staff-controls-row"] button')
    .filter({ hasText: /^(Add|הוסף)$/ })
    .first();
  await expect(addBtn).toBeVisible({ timeout: 10000 });
  for (let i = 0; i < count; i++) {
    await addBtn.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(150);
  }
}

async function clickOptimize(page: Page) {
  const btn = page.locator("#optimize-button");
  await expect(btn).toBeVisible({ timeout: 10000 });
  await expect(btn).toBeEnabled({ timeout: 10000 });
  await btn.click();
}

// Locate the visible Toast root and its highlight span. Toast renders a
// fixed-positioned root at `bottom-4 left-1/2 ... z-50` and the highlight
// atom is a nested `<span dir="ltr" class="... font-semibold">`.
function toastRoot(page: Page) {
  // Use attribute-selector matching since Tailwind's `left-1/2` class
  // contains a "/" which would need awkward escaping in a CSS class selector.
  return page.locator('div.fixed.z-50[class*="bottom-4"]').first();
}
function toastHighlightSpan(page: Page) {
  return toastRoot(page).locator('span[dir="ltr"].font-semibold').first();
}

test.describe("Optimization success toast — duration token (LTR-safe in RTL)", () => {
  for (const lang of ["he", "en"] as const) {
    test(`${lang} locale: success toast highlight span is LTR atomic with parenthesised duration`, async ({
      page,
    }) => {
      await installLocaleInitScript(page, lang);
      await waitForAppLang(page, lang);

      // Default seed has staff already? In 24H mode optimization should be
      // feasible with the default seed posts + a few staff. Add a small
      // batch so the optimizer has enough degrees of freedom regardless of
      // seed.
      // Existing optimization-weekly.spec uses 20 staff for weekly; for 24H
      // a smaller number suffices. Add 4 to ensure feasibility on top of
      // any default-seeded staff.
      await addStaff(page, 4);
      await expect(page.locator(STAFF_ROW).first()).toBeVisible({
        timeout: 10000,
      });

      // Wait for any user-add toasts to fade out so the optimization toast
      // is the only/first toast in the DOM when we assert on it. Toast
      // duration default is 3000ms + 300ms fade.
      await expect(
        page.locator('div.fixed.z-50[class*="bottom-4"]')
      ).toHaveCount(0, { timeout: 6000 });

      await clickOptimize(page);

      // The success toast appears within ~1–2s. Wait for the highlight span.
      const highlight = toastHighlightSpan(page);
      await expect(highlight).toBeVisible({ timeout: 15000 });

      // 1. Computed style: direction is "ltr"
      const direction = await highlight.evaluate(
        (el) => window.getComputedStyle(el).direction
      );
      expect(direction).toBe("ltr");

      // 2. textContent matches /^\(\d.*\)$/ — open-paren, digits start,
      //    close-paren. Per the formatter:
      //      <1000ms  → (Nms)        e.g. (12ms)
      //      <60000ms → (N.Ns)       e.g. (1.2s)
      //      ≥60000ms → (Nm Ms)      e.g. (1m 5s)
      const text = (await highlight.textContent()) ?? "";
      expect(text).toMatch(/^\(\d+(\.\d+)?(ms|s|m \d+s)\)$/);

      // 3. Bbox has non-zero width — the atom is actually painted
      const box = await highlight.boundingBox();
      expect(box, "highlight span must have a bounding box").not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);

      // 4. Token order — open paren before digits before close paren, in
      //    visual reading order. Because the span has dir="ltr", the first
      //    rendered glyph (leftmost) must be "(" and the last must be ")".
      //    We verify by per-character bbox: the "(" should be at lower x
      //    than the digit char which should be at lower x than ")".
      const charBboxes = await highlight.evaluate((el) => {
        const text = el.textContent ?? "";
        const range = document.createRange();
        const node = el.firstChild;
        if (!node) return null;
        const positions: { ch: string; x: number; w: number }[] = [];
        for (let i = 0; i < text.length; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getBoundingClientRect();
          positions.push({ ch: text[i], x: r.x, w: r.width });
        }
        range.detach();
        return positions;
      });
      expect(charBboxes, "char bboxes must be measurable").not.toBeNull();
      const positions = charBboxes!;
      const openParen = positions.find((p) => p.ch === "(");
      const closeParen = positions.find((p) => p.ch === ")");
      const firstDigit = positions.find((p) => /\d/.test(p.ch));
      expect(openParen, "must contain (").toBeTruthy();
      expect(closeParen, "must contain )").toBeTruthy();
      expect(firstDigit, "must contain a digit").toBeTruthy();
      // Strictly: (.x < digit.x < ).x  — proves NO bidi reorder of the
      // parenthesised atom and no mirroring of the parens.
      expect(openParen!.x).toBeLessThan(firstDigit!.x);
      expect(firstDigit!.x).toBeLessThan(closeParen!.x);

      // 5. Surrounding sentence is intact — the toast root contains the
      //    expected localised prefix. Hebrew: "שיבוצי המשמרות אופטמו בהצלחה",
      //    English: "Shift assignments have been optimized successfully".
      const fullText = (await toastRoot(page).textContent()) ?? "";
      if (lang === "he") {
        expect(fullText).toContain("שיבוצי המשמרות אופטמו בהצלחה");
      } else {
        expect(fullText).toContain(
          "Shift assignments have been optimized successfully"
        );
      }
      // And the same toast root contains the parenthesised duration substring
      expect(fullText).toMatch(/\(\d+(\.\d+)?(ms|s|m \d+s)\)/);
    });
  }
});

test.describe("Toast.tsx dir=\"ltr\" regression check — existing callers (he locale)", () => {
  test("userWasAddedToStaff with Hebrew name containing digits stays readable", async ({
    page,
  }) => {
    await installLocaleInitScript(page, "he");
    await waitForAppLang(page, "he");

    // Adding a user gives it the name "עובד N" via defaultMember in he.
    // The toast template is "{{name}} נוסף לרשימת הצוות" and `name` is the
    // highlightText. We just need to verify:
    //   - the toast renders (no layout collapse from dir="ltr")
    //   - the highlight span has non-zero bbox
    //   - the full message contains the Hebrew suffix
    //   - the highlight textContent equals the Hebrew name (with digit)
    await addStaff(page, 1);

    const highlight = toastHighlightSpan(page);
    await expect(highlight).toBeVisible({ timeout: 10000 });

    const text = (await highlight.textContent()) ?? "";
    // Should be "עובד <N>" — the just-added user's name with a digit suffix.
    expect(text).toMatch(/^עובד \d+$/);

    const box = await highlight.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    const direction = await highlight.evaluate(
      (el) => window.getComputedStyle(el).direction
    );
    expect(direction).toBe("ltr");

    // The surrounding toast text contains the Hebrew suffix
    const fullText = (await toastRoot(page).textContent()) ?? "";
    expect(fullText).toContain("נוסף לרשימת הצוות");
  });
});
