import { readFileSync } from "fs";
import { resolve } from "path";
import { getActiveStaffIds } from "../availabilityHeatmapHelpers";

describe("AvailabilityHeatmap.getActiveStaffIds", () => {
  it("returns multi-set staff ids when in staff multi", () => {
    expect(
      getActiveStaffIds(new Set(["a", "b"]), "staff", null)
    ).toEqual(["a", "b"]);
  });

  it("returns single id array when single-staff selected", () => {
    expect(getActiveStaffIds(null, null, "user-1")).toEqual(["user-1"]);
  });

  it("returns empty when nothing selected", () => {
    expect(getActiveStaffIds(null, null, null)).toEqual([]);
  });

  it("ignores posts-kind multi (returns empty if no single staff)", () => {
    expect(
      getActiveStaffIds(new Set(["p1"]), "posts", null)
    ).toEqual([]);
  });

  it("prefers multi over single when both somehow set", () => {
    expect(
      getActiveStaffIds(new Set(["a", "b"]), "staff", "user-1")
    ).toEqual(["a", "b"]);
  });
});

// Regression guard for the CEO directive: when 2+ staff are selected in the
// manager availability view, the chip row (avatar + name pills) that used to
// render below the fixed-height header caused the heatmap area to "jump"
// vertically when the selection crossed 1 -> 2 or when chips wrapped to a new
// line. The "Availability - N of M" header and the `N / M` count pill already
// convey selection state, so the chips were removed.
//
// Jest in this package runs in `node` env with no JSDOM / RTL (see
// jest.config.cjs; no @testing-library/react dep; workspace rules forbid
// adding new deps for this fix). The source-shape regex pattern from
// cancelClearsSelection.test.ts is the established substitute for render-tree
// assertions.
//
// Fail-before / pass-after note: each `not.toMatch` regex below
// (`!isSingle && activeCount >= 2`, `StaffAvatar`, and the chip-row Tailwind
// classname `flex flex-wrap gap-1.5 flex-none`) used to match the pre-fix
// source (chip block at lines 403-419 + import at line 16, per task.md and
// architect-plan.md). After the deletion they no longer match, satisfying
// the project bug-fix rule. The positive guard for the `N / M` count pill
// (`activeCount} / {totalStaff`) confirms AC line 2 ("header and pill remain
// unchanged").
describe("AvailabilityHeatmap chip row removed", () => {
  const SOURCE = readFileSync(
    resolve(__dirname, "../AvailabilityHeatmap.tsx"),
    "utf8"
  );

  it("no longer references StaffAvatar (import or JSX)", () => {
    expect(SOURCE).not.toMatch(/StaffAvatar/);
  });

  it("no longer renders the chip-row predicate `!isSingle && activeCount >= 2`", () => {
    expect(SOURCE).not.toMatch(/!isSingle\s*&&\s*activeCount\s*>=\s*2/);
  });

  it("no longer contains the chip-row Tailwind classname (catches reintroduction under a renamed predicate)", () => {
    expect(SOURCE).not.toMatch(/flex\s+flex-wrap\s+gap-1\.5\s+flex-none/);
  });

  it("still renders the `activeCount / totalStaff` count pill (positive guard)", () => {
    expect(SOURCE).toMatch(/activeCount\}\s*\/\s*\{totalStaff/);
  });
});

// Regression guard for the CEO directive: when the shift-hours list is long
// (e.g., 14+ half-hour slots), the heatmap grid + its toolbar row used to
// clip past the viewport with no horizontal scroll. The fix introduces a
// `minmax(var(--hour-min),1fr)` track plus a `min-w-0 overflow-x-auto`
// scroll wrapper so the grid grows to its intrinsic min-content width and
// the wrapper provides a visible horizontal scrollbar inside the card.
//
// Source-shape regexes match the existing chip-row block above.
//
// Fail-before / pass-after: pre-fix source contains
// `repeat(var(--hours),1fr)` (matches the "no longer" guard -> fails) and
// does not contain `minmax(var(--hour-min),1fr)` (positive guard misses ->
// fails). Both flip after the fix.
describe("AvailabilityHeatmap grid scroll & min-column-width", () => {
  const SOURCE = readFileSync(
    resolve(__dirname, "../AvailabilityHeatmap.tsx"),
    "utf8"
  );

  it("declares an explicit minmax(...) min width for hour columns (not bare 1fr)", () => {
    expect(SOURCE).toMatch(
      /grid-cols-\[max-content_repeat\(var\(--hours\),minmax\(var\(--hour-min\),1fr\)\)\]/
    );
  });

  it("sets the --hour-min CSS custom property on the grid wrapper", () => {
    expect(SOURCE).toMatch(/"--hour-min"\s*:\s*"\d+(?:\.\d+)?rem"/);
  });

  it("scroll container declares horizontal overflow", () => {
    expect(SOURCE).toMatch(/overflow-x-auto/);
  });

  it("scroll container is allowed to shrink in its flex parent (min-w-0)", () => {
    expect(SOURCE).toMatch(/min-w-0[^"]*overflow-x-auto/);
  });

  it("no longer uses bare `1fr` for hour columns (would re-introduce the bug)", () => {
    expect(SOURCE).not.toMatch(/repeat\(var\(--hours\),1fr\)/);
  });

  it("toolbar row stays inside the shared grid via gridColumn: '2 / -1' so it scrolls with the table (AC2)", () => {
    expect(SOURCE).toMatch(/gridColumn:\s*"2\s*\/\s*-1"/);
  });

  it("outer card retains the visible border + rounded corners (AC4)", () => {
    expect(SOURCE).toMatch(/border\s+border-border\s+rounded-lg/);
  });

  // Round 2 regression: the previous fix added `min-w-0 overflow-x-auto` on
  // the scroll wrapper but the inner grid wrapper was still constrained to
  // the scroller's clientWidth, so columns rendered clipped instead of
  // making the grid wider than the scroller (which is what triggers the
  // horizontal scrollbar to actually expose all slots).
  // The fix is `w-max min-w-full` on `<div className="p-2 relative ...">`
  // so the wrapper sizes to its intrinsic max-content width (and at least
  // fills its parent when the content is short).
  it("grid wrapper sizes to intrinsic content (w-max min-w-full) so overflow-x-auto can scroll all slots", () => {
    expect(SOURCE).toMatch(/className="p-2 relative w-max min-w-full"/);
  });
});
