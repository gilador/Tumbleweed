import { readFileSync } from "fs";
import { resolve } from "path";

// Regression guard for the CEO directive: schedule card rows must center-align
// the WhoCell to the row's horizontal midpoint. Implementation switches from
// `flex + <span className="flex-1" />` spacer to `grid grid-cols-2`, with the
// outer `gap-2.5` removed (so the end-column start sits at exactly 50% — the
// gap would otherwise push it by gap/2). The start-half wrapper keeps its
// own `gap-2.5` for checkmark↔name spacing.
//
// Jest runs with testEnvironment: "node" (see jest.config.cjs); we read the
// component source as text and assert on the className strings.

const TIMEVIEW_SOURCE = readFileSync(
  resolve(__dirname, "../TimeViewPostRow.tsx"),
  "utf8"
);

const POSTCARD_SOURCE = readFileSync(
  resolve(__dirname, "../PostCard.tsx"),
  "utf8"
);

const ASSIGNMENTS_TAB_SOURCE = readFileSync(
  resolve(__dirname, "../../mobile/AssignmentsTab.tsx"),
  "utf8"
);

const WHOCELL_SOURCE = readFileSync(
  resolve(__dirname, "../WhoCell.tsx"),
  "utf8"
);

describe("TimeViewPostRow centers WhoCell with grid-cols-2", () => {
  it("row container uses `grid grid-cols-2 items-center` (not flex)", () => {
    expect(TIMEVIEW_SOURCE).toMatch(
      /row grid grid-cols-2 items-center px-3\.5 py-2\.5 border-t border-border first:border-t-0 transition-colors/
    );
  });

  it("outer row container does NOT carry `gap-2.5` (would offset center by gap/2)", () => {
    // Negative assertion per CTO sign-off: re-adding gap-2.5 to the outer
    // row would silently break the ±2px bbox AC.
    const outerRowMatch = TIMEVIEW_SOURCE.match(
      /row grid grid-cols-2[^"`]*transition-colors/
    );
    expect(outerRowMatch).not.toBeNull();
    expect(outerRowMatch![0]).not.toMatch(/\bgap-/);
  });

  it("start-half wrapper exists with `flex items-center gap-2.5 min-w-0`", () => {
    expect(TIMEVIEW_SOURCE).toMatch(
      /<div className="flex items-center gap-2\.5 min-w-0">/
    );
  });

  it("no empty <span className=\"flex-1\" /> spacer survives", () => {
    expect(TIMEVIEW_SOURCE).not.toMatch(/<span\s+className="flex-1"\s*\/>/);
  });

  it("non-editing pos-name span retains `truncate`", () => {
    expect(TIMEVIEW_SOURCE).toMatch(
      /pos-name inline-block px-2 py-1 text-xs rounded-md cursor-pointer transition-colors truncate/
    );
  });

  it("editing-state input keeps `flex-1 min-w-0` (still expands inside start-half)", () => {
    expect(TIMEVIEW_SOURCE).toMatch(
      /pos-name editing[^"]*min-w-0 flex-1/
    );
  });

  it("`post-checked bg-primary-soft` still applied to the row when checked (AC9)", () => {
    // The row container template literal still toggles to post-checked bg-primary-soft
    // when checked is true — the grid-cols-2 refactor must not have stripped this.
    expect(TIMEVIEW_SOURCE).toMatch(
      /checked \? "post-checked bg-primary-soft" : "bg-background"/
    );
  });

  it("multi-select `check-mark` element still present (AC7)", () => {
    // Multi-select checkmark must still render inside the start-half wrapper.
    expect(TIMEVIEW_SOURCE).toMatch(/check-mark inline-grid place-items-center/);
  });

  it("WhoCell receives `isLocked` prop (AC9 — isLocked override still wired)", () => {
    expect(TIMEVIEW_SOURCE).toMatch(/isLocked=\{isLocked\}/);
  });
});

describe("PostCard time row centers WhoCell with grid-cols-2", () => {
  it("row container uses `grid grid-cols-2 items-center` (not flex)", () => {
    expect(POSTCARD_SOURCE).toMatch(
      /row grid grid-cols-2 items-center px-3\.5 py-2\.5 border-t border-border first:border-t-0 bg-background/
    );
  });

  it("outer row container does NOT carry `gap-2.5`", () => {
    const outerRowMatch = POSTCARD_SOURCE.match(
      /row grid grid-cols-2[^"`]*bg-background/
    );
    expect(outerRowMatch).not.toBeNull();
    expect(outerRowMatch![0]).not.toMatch(/\bgap-/);
  });

  it("start-half wrapper exists with `flex items-center gap-2.5 min-w-0`", () => {
    expect(POSTCARD_SOURCE).toMatch(
      /<div className="flex items-center gap-2\.5 min-w-0">/
    );
  });

  it("no empty <span className=\"flex-1\" /> spacer survives", () => {
    expect(POSTCARD_SOURCE).not.toMatch(/<span\s+className="flex-1"\s*\/>/);
  });

  it("time-range span retains `tabular-nums min-w-[90px]`", () => {
    expect(POSTCARD_SOURCE).toMatch(
      /pos text-xs text-muted-foreground tabular-nums min-w-\[90px\]/
    );
  });
});

describe("WhoCell no longer caps width with max-w-[30%] (Round 2 regression guard)", () => {
  // Round 2 fix: when WhoCell sat inside a flex row, `max-w-[30%]` capped
  // it at 30% of the row width. After the row became `grid grid-cols-2`,
  // that cap resolves to 30% × 50% = 15% of the row — enough for the
  // avatar but nothing for the truncated name span, hiding the name.
  // Per `feedback_engineer_dont_strip_classes`, this removal is intentional
  // and documented; the parent grid cell (50% of row) already satisfies
  // the original truncation intent.
  it("non-empty WhoCell container does NOT carry `max-w-[30%]`", () => {
    expect(WHOCELL_SOURCE).not.toMatch(/max-w-\[30%\]/);
  });

  it("non-empty WhoCell container retains `min-w-0` (so inner truncate still clips)", () => {
    expect(WHOCELL_SOURCE).toMatch(/who inline-flex items-center gap-2[^"`]*min-w-0/);
  });

  it("inner displayName span retains `truncate`", () => {
    expect(WHOCELL_SOURCE).toMatch(/<span className="truncate">\{displayName\}<\/span>/);
  });
});

describe("Mobile AssignmentsTab is untouched (no flex-1 spacer to fix)", () => {
  it("mobile rows still use `justify-between` pattern (no spacer)", () => {
    // Engineer report AC3: mobile uses justify-between, not the flex-1 spacer.
    expect(ASSIGNMENTS_TAB_SOURCE).toMatch(/flex items-center justify-between/);
  });

  it("no `<span className=\"flex-1\" />` spacer was introduced in mobile rows", () => {
    expect(ASSIGNMENTS_TAB_SOURCE).not.toMatch(/<span\s+className="flex-1"\s*\/>/);
  });
});
