import { readFileSync } from "fs";
import { resolve } from "path";
import { cancelMultiSelectAction } from "../../stores/selectionStore";

// Round-5 regression guard for the CEO directive part (b): clicking Cancel
// in the staff multi-select bar must clear the viewing-selection
// (selectedStaffIdState) so the availability panel returns to its empty
// default state. Without this, BulkSelectionBar.handleCancel only called
// `exitMulti()` and the previously selected staff member's availability
// stayed rendered after the bar disappeared.
//
// The fix is a pure helper `cancelMultiSelectAction(kind)` that decides
// whether the Recoil `selectedStaffIdState` atom should also be cleared,
// plus its wiring inside `BulkSelectionBar.handleCancel` /
// `handleSelectAll(deselect-all)`. We assert both layers behaviorally:
//
//   1) The pure helper returns clearStaffSelection=true for the staff
//      kind and false for the posts kind (orthogonal flow).
//   2) The BulkSelectionBar source actually consumes setSelectedStaffId
//      and gates it on `cancelMultiSelectAction(kind)` — the pure helper
//      alone is dead code without the wiring at the call site.
//
// Jest in this package runs in `node` env with no JSDOM / RTL (see
// jest.config.cjs and package.json — no @testing-library/react dep, and
// the workspace forbids adding new deps for this fix), so the source-
// shape layer stands in for a render-and-click integration test. The
// matching e2e (Playwright) coverage is added under tests/e2e.

describe("Cancel in BulkSelectionBar clears staff viewing-selection", () => {
  describe("cancelMultiSelectAction (pure helper)", () => {
    it("requests clearing the staff selection when cancelling staff multi-select", () => {
      expect(cancelMultiSelectAction("staff")).toEqual({
        exit: true,
        clearStaffSelection: true,
      });
    });

    it("does NOT clear the staff selection when cancelling posts multi-select", () => {
      // Cancelling the posts bar must not touch the orthogonal staff
      // viewing-selection.
      expect(cancelMultiSelectAction("posts")).toEqual({
        exit: true,
        clearStaffSelection: false,
      });
    });

    it("always exits multi-select regardless of kind", () => {
      expect(cancelMultiSelectAction("staff").exit).toBe(true);
      expect(cancelMultiSelectAction("posts").exit).toBe(true);
    });
  });

  describe("BulkSelectionBar wires the helper to setSelectedStaffId", () => {
    const SOURCE = readFileSync(
      resolve(__dirname, "../BulkSelectionBar.tsx"),
      "utf8"
    );

    it("imports cancelMultiSelectAction from the selectionStore", () => {
      expect(SOURCE).toMatch(/cancelMultiSelectAction/);
    });

    it("destructures setSelectedStaffId from useMultiSelect", () => {
      expect(SOURCE).toMatch(/setSelectedStaffId/);
    });

    it("calls setSelectedStaffId(null) when the helper requests clearStaffSelection", () => {
      // The wiring: gate `setSelectedStaffId(null)` on
      // `action.clearStaffSelection` from cancelMultiSelectAction(kind).
      expect(SOURCE).toMatch(
        /action\.clearStaffSelection[\s\S]{0,60}setSelectedStaffId\(\s*null\s*\)/
      );
    });

    it("still calls exitMulti to leave multi-select after cancel", () => {
      expect(SOURCE).toMatch(/exitMulti\(\s*\)/);
    });

    it("regression: handleCancel no longer calls exitMulti() in isolation without the selection clear", () => {
      // The old buggy form: handleCancel = () => { trackEvent(...); exitMulti(); }
      // with NO setSelectedStaffId(null). The fix routes through
      // performCancel(...) which always invokes the helper-driven branch
      // before exiting. Guard against a future regression that strips the
      // helper call back out.
      expect(SOURCE).not.toMatch(
        /const\s+handleCancel\s*=\s*\(\s*\)\s*=>\s*\{\s*trackEvent\([^)]*\);\s*exitMulti\(\s*\);\s*\}/
      );
    });
  });
});
