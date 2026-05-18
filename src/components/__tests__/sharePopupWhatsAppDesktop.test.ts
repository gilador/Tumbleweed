import { readFileSync } from "fs";
import { resolve } from "path";

// Regression guard for the desktop WhatsApp share path. The desktop button must
// open `https://wa.me/?text=<encoded summary>` in a new tab — NOT download a PDF.
//
// `window.open` must run on the same event-loop tick as the click handler so the
// Safari popup blocker treats it as a user gesture. The tests below enforce:
//   1. The desktop branch contains `window.open(\`https://wa.me/?text=...\`)`.
//   2. No `await` precedes the first `window.open` in the desktop branch.
//   3. The desktop branch does NOT call `handleDownload` (that fallback only
//      lives in the mobile share-cancellation `catch`).
//   4. The eb75ca3 regressions (maxTouchPoints / pointer: coarse / setTimeout
//      1000) are gone.
//
// The desktop branch is identified by splitting `handleWhatsApp`'s body on the
// stable comment marker `// Mobile`. Keep that marker in SharePopup.tsx.
describe("SharePopup — desktop WhatsApp opens wa.me synchronously (no PDF)", () => {
  const SOURCE = readFileSync(
    resolve(__dirname, "../SharePopup.tsx"),
    "utf8"
  );

  it("opens wa.me in the desktop branch", () => {
    expect(SOURCE).toMatch(
      /window\.open\(\s*`https:\/\/wa\.me\/\?text=\$\{[^}]+\}`/
    );
  });

  it("does not call handleDownload from handleWhatsApp on the desktop path", () => {
    const handler = SOURCE.match(
      /const\s+handleWhatsApp\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s{2}\};/
    );
    expect(handler).not.toBeNull();
    const body = handler![1];
    const desktopBranch = body.split("// Mobile")[0];
    expect(desktopBranch).not.toMatch(/await\s+handleDownload/);
  });

  it("opens window.open synchronously (no await before it) on the desktop branch", () => {
    const handler = SOURCE.match(
      /const\s+handleWhatsApp\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s{2}\};/
    );
    expect(handler).not.toBeNull();
    const body = handler![1];
    const desktopBranch = body.split("// Mobile")[0];
    const firstOpenIdx = desktopBranch.indexOf("window.open");
    expect(firstOpenIdx).toBeGreaterThan(-1);
    const sliceBeforeOpen = desktopBranch.slice(0, firstOpenIdx);
    expect(sliceBeforeOpen).not.toMatch(/\bawait\b/);
  });

  it("still tracks the whatsapp-shared event", () => {
    expect(SOURCE).toMatch(/trackEvent\("whatsapp-shared"/);
  });

  it("isMobile reverted to plain UA regex (no maxTouchPoints, no pointer-coarse)", () => {
    expect(SOURCE).not.toMatch(/maxTouchPoints/);
    expect(SOURCE).not.toMatch(/pointer: coarse/);
  });

  it("URL.revokeObjectURL timeout reverted to 0 (not 1000)", () => {
    expect(SOURCE).not.toMatch(
      /revokeObjectURL[\s\S]{0,80}setTimeout[^,]+,\s*1000/
    );
  });
});
