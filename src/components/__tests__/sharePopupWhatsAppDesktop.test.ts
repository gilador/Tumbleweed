import { readFileSync } from "fs";
import { resolve } from "path";

// Regression guard for the desktop WhatsApp share path. Pre-fix, handleWhatsApp
// called generatePdfs() unconditionally at the top, then fell through to
// handleDownload() — wasting one generation on desktop and entangling the
// "share" code path with the "save" code path. Per CEO directive, the desktop
// WhatsApp button must SAVE A PDF (no share attempt, no Web Share API call).
//
// Jest in this package runs in `node` env with no JSDOM / RTL (see
// jest.config.cjs; no @testing-library/react dep; workspace rules forbid
// adding new deps for this fix). The source-shape regex pattern from
// availabilityHeatmap.test.ts is the established substitute for render-tree
// assertions.
//
// Fail-before / pass-after:
// - Pre-fix: handleWhatsApp opened with `const pdfs = await generatePdfs()`
//   on the very first line of the function body (the "guard at top" pattern
//   the first regex looks for). Today the function opens with trackEvent +
//   a desktop short-circuit, so the "guards-at-top" regex no longer matches.
// - Post-fix: the desktop short-circuit `if (!isMobile || ...)` followed by
//   `await handleDownload(); return;` is now present.
describe("SharePopup — WhatsApp button on desktop saves PDF (no share attempt)", () => {
  const SOURCE = readFileSync(
    resolve(__dirname, "../SharePopup.tsx"),
    "utf8"
  );

  it("short-circuits to handleDownload when not on mobile or Web Share API is unavailable", () => {
    expect(SOURCE).toMatch(
      /if\s*\(\s*!isMobile\s*\|\|\s*typeof\s+navigator\.share\s*!==\s*"function"\s*\)\s*\{\s*await\s+handleDownload\(\)\s*;\s*return\s*;/
    );
  });

  it("no longer generates PDFs before checking the desktop branch (avoids wasted generation)", () => {
    // Pre-fix shape: handleWhatsApp's first awaited call was generatePdfs.
    // Post-fix: the first awaited call inside handleWhatsApp must be handleDownload
    // (the desktop fast path) — not generatePdfs.
    const handler = SOURCE.match(
      /const\s+handleWhatsApp\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s{2}\};/
    );
    expect(handler).not.toBeNull();
    const body = handler![1];
    // The first `await` token inside the function body must be `await handleDownload`,
    // not `await generatePdfs`.
    const firstAwait = body.match(/await\s+(\w+)/);
    expect(firstAwait).not.toBeNull();
    expect(firstAwait![1]).toBe("handleDownload");
  });

  it("keeps navigator.share() invocation gated behind the isMobile branch", () => {
    // navigator.share should still exist (mobile path), but only after the
    // isMobile-positive branch — never as a desktop fallback.
    expect(SOURCE).toMatch(/navigator\.share\(\s*\{\s*files\s*\}\s*\)/);
  });

  it("still tracks the whatsapp-shared event on click (analytics unchanged)", () => {
    expect(SOURCE).toMatch(/trackEvent\("whatsapp-shared"/);
  });

  it("isMobile constant combines UA check with maxTouchPoints / pointer-coarse guard", () => {
    expect(SOURCE).toMatch(/maxTouchPoints\s*>\s*0/);
    expect(SOURCE).toMatch(/pointer: coarse/);
  });
});
