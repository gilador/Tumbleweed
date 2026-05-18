// Regression guard for the mobile staff multi-select alignment task.
// Without jsdom / @testing-library, this test asserts the source-shape of
// StaffTab.tsx to lock in the desktop-parity contract:
//
//   1) Inline pencil + trash buttons have been removed from each row.
//   2) The leading name span carries `data-longpress-zone="name"` so the
//      hot-zone resolver can route long-press-on-name into inline rename.
//   3) The row container wires the useLongPress handlers (not the inner
//      <button>) and on long-press routes to enterMulti(['<id>'], 'staff')
//      with the typed `staff-multi-select-entered` analytics event.
//   4) The short-tap path on the inner <button> short-circuits when
//      justLongPressed() is true (swallow synthetic click after long-press)
//      and toggles selection while in multi-select.
//   5) The row container carries the iOS-safe `no-touch-callout select-none`
//      utilities so long-press never opens the native callout.
//   6) The MobileShell wires BulkSelectionBar (kind="staff", inline={false})
//      gated on a local showMultiSlot state that survives the bar's exit
//      animation via onExitComplete.

import { readFileSync } from "fs";
import { resolve } from "path";

const staffTab = readFileSync(
  resolve(__dirname, "../StaffTab.tsx"),
  "utf-8"
);

const mobileShell = readFileSync(
  resolve(__dirname, "../MobileShell.tsx"),
  "utf-8"
);

describe("StaffTab — desktop parity contract", () => {
  it("does not render inline pencil or trash icons", () => {
    expect(staffTab).not.toMatch(/IconPencil/);
    expect(staffTab).not.toMatch(/IconTrash/);
    // The per-row `edit-staff-${id}` testid was attached to the pencil
    // button — it must be gone.
    expect(staffTab).not.toMatch(/data-testid=\{`edit-staff-/);
  });

  it("does not maintain a local delete-confirm state any more", () => {
    expect(staffTab).not.toMatch(/deleteConfirmUserId/);
    expect(staffTab).not.toMatch(/setDeleteConfirmUserId/);
  });

  it("wires useMultiSelect for staff selection state", () => {
    expect(staffTab).toMatch(/useMultiSelect\(\)/);
    expect(staffTab).toMatch(/inMulti\("staff"\)/);
    expect(staffTab).toMatch(/isMultiChecked\(userData\.user\.id, "staff"\)/);
    expect(staffTab).toMatch(/toggleInMulti\(userData\.user\.id\)/);
  });

  it("marks the leading name span as the edit hot-zone", () => {
    expect(staffTab).toMatch(
      /data-longpress-zone="name"[\s\S]*?\{userData\.user\.name\}/
    );
  });

  it("routes long-press on name into inline rename for that row", () => {
    expect(staffTab).toMatch(/zone === "name"/);
    expect(staffTab).toMatch(/setEditingUserId\(userId\)/);
  });

  it("routes long-press elsewhere into staff multi-select with row pre-selected", () => {
    expect(staffTab).toMatch(/enterMulti\(\[userId\], "staff"\)/);
    expect(staffTab).toMatch(
      /trackEvent\("staff-multi-select-entered", \{ source: "mobile-long-press" \}\)/
    );
  });

  it("guards edit and multi-select against each other (mutual exclusion)", () => {
    // While in staff multi, long-press on name is a no-op.
    expect(staffTab).toMatch(/if \(inStaffMulti\) return/);
    // While in inline rename, long-press elsewhere is a no-op.
    expect(staffTab).toMatch(/if \(editingUserId !== null\) return/);
  });

  it("swallows the synthetic click that follows a long-press", () => {
    expect(staffTab).toMatch(/longPress\.justLongPressed\(\)/);
    expect(staffTab).toMatch(/e\.preventDefault\(\);\s*return;/);
  });

  it("attaches long-press pointer handlers to the row container, not the inner button", () => {
    // Handlers live on the outer `<div data-staff-row-id=...>` (row
    // container), so scroll + bubble work uniformly.
    expect(staffTab).toMatch(
      /data-staff-row-id=\{userData\.user\.id\}[\s\S]*?onPointerDown=\{[^}]*longPress\.onPointerDown/
    );
  });

  it("applies iOS-safe no-touch-callout + select-none on the row container", () => {
    expect(staffTab).toMatch(/no-touch-callout select-none/);
  });

  it("toggles selection on short tap while in staff multi-select", () => {
    expect(staffTab).toMatch(/if \(inStaffMulti\) \{\s*toggleInMulti/);
  });
});

describe("MobileShell — staff BulkSelectionBar wiring", () => {
  it("imports BulkSelectionBar and the read-only multi-select hook", () => {
    expect(mobileShell).toMatch(/import \{ BulkSelectionBar \}/);
    expect(mobileShell).toMatch(/import \{ useMultiSelectValue \}/);
  });

  it("mounts BulkSelectionBar above the tab bar in non-inline form", () => {
    expect(mobileShell).toMatch(/<BulkSelectionBar[\s\S]*?kind="staff"[\s\S]*?inline=\{false\}/);
  });

  it("wires bulk delete to removeUsers (array signature)", () => {
    expect(mobileShell).toMatch(/onBulkDelete=\{\(ids\) => removeUsers\(ids\)\}/);
  });

  it("hides the tab bar while the staff multi bar is showing", () => {
    expect(mobileShell).toMatch(/!isDrillDown && !showMultiSlot/);
  });

  it("keeps the multi slot mounted across the bar's exit animation via onExitComplete", () => {
    expect(mobileShell).toMatch(/showMultiSlot/);
    expect(mobileShell).toMatch(/onExitComplete=\{\(\) => setShowMultiSlot\(false\)\}/);
  });
});
