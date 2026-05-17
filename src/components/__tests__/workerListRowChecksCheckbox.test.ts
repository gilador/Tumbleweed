import { readFileSync } from "fs";
import { resolve } from "path";

// Round-2 CEO revision: clicking a staff row body must behave EXACTLY like
// clicking the checkbox — i.e. enter multi-select and (un)check the row.
// The row stays clickable, but must NOT paint a hover background; and the
// name <span> must not paint a hover background either.

describe("WorkerList row body click toggles the checkbox", () => {
  const SOURCE = readFileSync(
    resolve(__dirname, "../../components/WorkerList.tsx"),
    "utf8"
  );

  // Anchor the row-open snippet on the avatar slot that follows the row's
  // closing `>` — same backtracking trick as the round-1 test.
  const rowOpenMatch = SOURCE.match(
    /<div[\s\S]{0,200}data-testid="staff-member"[\s\S]*?>\s*<div className="relative w-8 h-8/
  );

  it("row <div> has onClick that invokes applyToggle with intent 'checkbox'", () => {
    expect(rowOpenMatch).not.toBeNull();
    expect(rowOpenMatch![0]).toMatch(/onClick=\{/);
    expect(rowOpenMatch![0]).toMatch(/applyToggle\(user\.id,\s*"checkbox"/);
  });

  it("row onClick guards against editing rows (no toggle while renaming)", () => {
    expect(rowOpenMatch).not.toBeNull();
    expect(rowOpenMatch![0]).toMatch(/if\s*\(editingUserId\s*!==\s*null\)\s*return/);
  });

  it("row className includes cursor-pointer (row is clickable)", () => {
    expect(rowOpenMatch).not.toBeNull();
    expect(rowOpenMatch![0]).toMatch(/cursor-pointer/);
  });

  it("row className does NOT include hover:bg-muted (no row-level hover bg)", () => {
    expect(rowOpenMatch).not.toBeNull();
    expect(rowOpenMatch![0]).not.toMatch(/hover:bg-muted/);
  });

  it("row className does NOT include transition-colors (no row-level color animation)", () => {
    // Narrow to the row className literal so the avatar pencil chip's
    // transition-colors (which lives inside the row but on a child button)
    // doesn't false-positive this assertion.
    const rowClassMatch = SOURCE.match(
      /data-testid="staff-member"\s+className="([^"]+)"/
    );
    expect(rowClassMatch).not.toBeNull();
    expect(rowClassMatch![1]).not.toMatch(/\btransition-colors\b/);
  });

  it("row keeps tabIndex={-1} for context-menu a11y", () => {
    expect(rowOpenMatch).not.toBeNull();
    expect(rowOpenMatch![0]).toMatch(/tabIndex=\{-1\}/);
  });

  it("row keeps onContextMenu handler that calls openContextMenu", () => {
    expect(SOURCE).toMatch(
      /onContextMenu=\{[\s\S]{0,400}openContextMenu\(/
    );
  });

  it("row keeps Shift+F10 keyboard context-menu handler", () => {
    expect(SOURCE).toMatch(/e\.shiftKey\s*&&\s*e\.key\s*===\s*"F10"/);
  });

  it("name span carries no hover:bg-border-strong (CEO directive)", () => {
    const spanMatch = SOURCE.match(
      /<span\s+className="block truncate[\s\S]{0,400}\{user\.name\}\s*<\/span>/
    );
    expect(spanMatch).not.toBeNull();
    expect(spanMatch![0]).not.toMatch(/hover:bg-border-strong/);
  });

  it("name span carries no transition-colors", () => {
    const spanMatch = SOURCE.match(
      /<span\s+className="block truncate[\s\S]{0,400}\{user\.name\}\s*<\/span>/
    );
    expect(spanMatch).not.toBeNull();
    expect(spanMatch![0]).not.toMatch(/transition-colors/);
  });

  it("name span retains LTR + unicode-bidi plaintext (Hebrew + Latin)", () => {
    const spanMatch = SOURCE.match(
      /<span\s+className="block truncate[\s\S]{0,400}\{user\.name\}\s*<\/span>/
    );
    expect(spanMatch).not.toBeNull();
    expect(spanMatch![0]).toMatch(/direction:\s*"ltr"/);
    expect(spanMatch![0]).toMatch(/unicodeBidi:\s*"plaintext"/);
  });

  it("pencil button onClick is preserved (still calls startEdit + stopPropagation)", () => {
    expect(SOURCE).toMatch(
      /onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*startEdit\(user\);/
    );
  });

  it("pencil button emits user-rename-start analytics on click", () => {
    expect(SOURCE).toMatch(/trackEvent\("user-rename-start"/);
  });

  it("checkbox onClick is preserved (still calls handleCheckClick)", () => {
    expect(SOURCE).toMatch(/onClick=\{\(e\) => handleCheckClick\(e,\s*user\.id\)\}/);
  });

  it("handleCheckClick stops propagation so it does not double-fire the row onClick", () => {
    expect(SOURCE).toMatch(
      /const\s+handleCheckClick\s*=\s*\([^)]*\)\s*=>\s*\{\s*e\.stopPropagation\(\);/
    );
  });

  it("edit input click also stops propagation (no spurious row toggle while typing)", () => {
    expect(SOURCE).toMatch(/onClick=\{\(e\) => e\.stopPropagation\(\)\}/);
  });
});
