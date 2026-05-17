import { readFileSync } from "fs";
import { resolve } from "path";

// Regression guard for shift-card fixed-height + internal body-scroll layout.
//
// Limitation: Jest is configured with testEnvironment: "node" (see
// packages/core/jest.config.cjs) and the project does not render React in
// unit tests. Real layout cannot be measured here. This test reads the
// component source as text and asserts the canonical Tailwind class strings
// required by the task's acceptance criteria. Visual / E2E coverage of
// actual scroll behavior is the appropriate complement; this test guards
// against accidental drift back to a layout where post rows render as
// direct flex children of the card root (which lets the card grow / clip).

const SHIFT_CARD = readFileSync(
  resolve(__dirname, "../ShiftCard.tsx"),
  "utf8"
);

const POST_CARD = readFileSync(
  resolve(__dirname, "../PostCard.tsx"),
  "utf8"
);

const AVAILABILITY_TABLE_VIEW = readFileSync(
  resolve(__dirname, "../../AvailabilityTableView.tsx"),
  "utf8"
);

describe("ShiftCard — fixed height with internal body scroll", () => {
  it("card root keeps the canonical flex column with bounded height", () => {
    expect(SHIFT_CARD).toMatch(
      /m-shift-block[^"`]*flex flex-col[^"`]*h-full/
    );
  });

  it("card root does NOT have overflow-hidden so its bottom border renders", () => {
    // Round 4 fix: `overflow-hidden` on the same element as `border rounded-lg`
    // can clip the bottom border line when the card extends to its parent's
    // clip edge. The clipping responsibility is moved to an inner wrapper.
    const rootMatch = SHIFT_CARD.match(
      /<div className=\{`m-shift-block ([^`]*)`\}/
    );
    expect(rootMatch).not.toBeNull();
    expect(rootMatch![1]).not.toMatch(/\boverflow-hidden\b/);
  });

  it("body wrapper owns rounded-b-lg so the inner scroll content matches the card's bottom-rounded corner without an empty footer strip", () => {
    expect(SHIFT_CARD).toMatch(
      /<div className="flex-1 min-h-0 overflow-y-auto rounded-b-lg">/
    );
  });

  it("card does NOT render a footer spacer div — bottom-rounded corner is owned by the scroll body, not a separate foot element", () => {
    expect(SHIFT_CARD).not.toMatch(
      /<div className="foot /
    );
  });

  it("head element is pinned via shrink-0 so it stays visible while the body scrolls", () => {
    expect(SHIFT_CARD).toMatch(
      /<div className="head shrink-0 [^"]*"/
    );
  });

  it("post rows are wrapped in a body region that fills remaining space and scrolls vertically", () => {
    expect(SHIFT_CARD).toMatch(
      /<div className="flex-1 min-h-0 overflow-y-auto[^"]*">/
    );
  });

  it("posts.map renders inside the scrolling body wrapper, not as a direct child of the card root", () => {
    const bodyOpen = SHIFT_CARD.search(
      /<div className="flex-1 min-h-0 overflow-y-auto[^"]*">/
    );
    expect(bodyOpen).toBeGreaterThan(-1);
    const postsMapIdx = SHIFT_CARD.indexOf("posts.map", bodyOpen);
    expect(postsMapIdx).toBeGreaterThan(bodyOpen);
  });

  it("column wrapper around each card establishes a bounded flex column so the card's h-full + internal body scroll resolves reliably", () => {
    // The card uses `h-full` and an inner `flex-1 min-h-0 overflow-y-auto`
    // body. Both rely on the parent column having a definite, bounded
    // height. Without `flex flex-col` + `min-h-0` on the column wrapper,
    // `height: 100%` on the card can fall back to auto on some browser /
    // layout combos, causing the card to grow past the visible scroll
    // viewport (bottom border missing, post rows clipped).
    const shiftColMatch = AVAILABILITY_TABLE_VIEW.match(
      /data-card-id=\{`shift-\$\{s\.si\}`\}\s+className="([^"]+)"/
    );
    expect(shiftColMatch).not.toBeNull();
    const shiftCls = shiftColMatch![1];
    expect(shiftCls).toMatch(/\bh-full\b/);
    expect(shiftCls).toMatch(/\bmin-h-0\b/);
    expect(shiftCls).toMatch(/\bflex\b/);
    expect(shiftCls).toMatch(/\bflex-col\b/);

    const postColMatch = AVAILABILITY_TABLE_VIEW.match(
      /data-card-id=\{`post-\$\{post\.id\}`\}\s+className="([^"]+)"/
    );
    expect(postColMatch).not.toBeNull();
    const postCls = postColMatch![1];
    expect(postCls).toMatch(/\bh-full\b/);
    expect(postCls).toMatch(/\bmin-h-0\b/);
    expect(postCls).toMatch(/\bflex\b/);
    expect(postCls).toMatch(/\bflex-col\b/);
  });

  it("PostCard root does NOT have overflow-hidden so its bottom border renders (round 4 parity with ShiftCard)", () => {
    const rootMatch = POST_CARD.match(
      /<div\s+className=\{`m-shift-block ([^`]*)`/
    );
    expect(rootMatch).not.toBeNull();
    expect(rootMatch![1]).not.toMatch(/\boverflow-hidden\b/);
  });

  it("PostCard body wrapper owns rounded-b-lg so its bottom corners match the card outline (parity with ShiftCard)", () => {
    expect(POST_CARD).toMatch(
      /<div className="flex-1 min-h-0 overflow-y-auto rounded-b-lg">/
    );
  });

  it("PostCard does NOT render a footer spacer div — bottom-rounded corner is owned by the scroll body (parity with ShiftCard)", () => {
    expect(POST_CARD).not.toMatch(
      /<div className="foot /
    );
  });

  it(".schedule-scroll horizontal container has pb-1 so the last visible item's bottom edge is not flush against the clip", () => {
    // Round 4 fix: the horizontal schedule-scroll container previously
    // clipped the bottom border of cards whose `h-full` resolved exactly to
    // the container's content box. `pb-1` adds a one-pixel-tall breathing
    // strip below cards so the bottom border line is always visible.
    const match = AVAILABILITY_TABLE_VIEW.match(
      /className="schedule-scroll ([^"]+)"/
    );
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/\bpb-1\b/);
  });

  it("isHighlighted widens to also fire when the assigned user is in the checked-staff multi-select set (set-only highlight)", () => {
    // Behavior matrix case 1: checkedStaffIds.has(uid) lights up the row even
    // when selectedUserId is null. This is the regression we are fixing —
    // the row-click multi-select path no longer touches selectedUserId, so
    // the highlight predicate must consult the multi-set as well.
    const isHighlightedMatch = SHIFT_CARD.match(
      /const isHighlighted =\s*([^;]+);/
    );
    expect(isHighlightedMatch).not.toBeNull();
    const expr = isHighlightedMatch![1].replace(/\s+/g, " ");
    expect(expr).toMatch(/checkedStaffIds\.has\(officialAssignedUserId\)/);
  });
  it("isHighlighted preserves the single-select clause (selectedUserId === officialAssignedUserId)", () => {
    // Behavior matrix case 3: a non-null selectedUserId matching the cell's
    // officialAssignedUserId still highlights — single-select path
    // (context menu etc.) keeps working. AC #6 — no regression.
    const isHighlightedMatch = SHIFT_CARD.match(
      /const isHighlighted =\s*([^;]+);/
    );
    expect(isHighlightedMatch).not.toBeNull();
    const expr = isHighlightedMatch![1].replace(/\s+/g, " ");
    expect(expr).toMatch(/officialAssignedUserId === selectedUserId/);
  });
  it("isHighlighted keeps the officialAssignedUserId !== null guard so empty cells with null selection / empty set do NOT highlight", () => {
    // Behavior matrix case 2: with checkedStaffIds = empty Set and
    // selectedUserId = null, no row highlights. The guard ensures null
    // officialAssignedUserId short-circuits to false (no .has(null) fluke).
    const isHighlightedMatch = SHIFT_CARD.match(
      /const isHighlighted =\s*([^;]+);/
    );
    expect(isHighlightedMatch).not.toBeNull();
    const expr = isHighlightedMatch![1].replace(/\s+/g, " ");
    expect(expr).toMatch(/officialAssignedUserId !== null/);
  });
  it("ShiftCard declares a required checkedStaffIds: Set<string> prop", () => {
    expect(SHIFT_CARD).toMatch(/checkedStaffIds:\s*Set<string>;/);
  });
  it("AvailabilityTableView threads checkedStaffIds into the ShiftCard call site", () => {
    expect(AVAILABILITY_TABLE_VIEW).toMatch(
      /<ShiftCard[^>]*checkedStaffIds=\{checkedStaffIds\}/s
    );
  });
  it("AvailabilityTableView kind-guards the multi-select set to staff (posts kind never bleeds into highlighting)", () => {
    expect(AVAILABILITY_TABLE_VIEW).toMatch(
      /multiSelectKind === "staff" && multiSelected \? multiSelected : EMPTY_SET/
    );
  });
  it("isHighlighted expression is identical between ShiftCard and PostCard so the two views cannot drift (AC #7)", () => {
    const shiftExpr = SHIFT_CARD.match(/const isHighlighted =\s*([^;]+);/);
    const postExpr = POST_CARD.match(/const isHighlighted =\s*([^;]+);/);
    expect(shiftExpr).not.toBeNull();
    expect(postExpr).not.toBeNull();
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    expect(normalize(shiftExpr![1])).toBe(normalize(postExpr![1]));
  });
  it("AvailabilityTableView threads checkedStaffIds into the PostCard call site too (parity with ShiftCard)", () => {
    expect(AVAILABILITY_TABLE_VIEW).toMatch(
      /<PostCard[^>]*checkedStaffIds=\{checkedStaffIds\}/s
    );
  });

  it("AvailabilityTableView outer + content wrappers carry min-h-0 so the bounded-height flex chain reaches the card column", () => {
    // Round 3 fix: the per-card column had `min-h-0 flex flex-col` (round 2)
    // but two ancestor wrappers were still missing `min-h-0`, so a child
    // with `flex-1 min-h-0` could not actually shrink — the chain broke and
    // post rows clipped / the card grew past the viewport. The two outer
    // wrappers (the root flex column and its immediate flex-1 child) must
    // both keep `min-h-0` for `h-full` on the inner card to resolve.
    const rootMatch = AVAILABILITY_TABLE_VIEW.match(
      /<div className=\{`w-full h-full flex flex-col ([^`]*)`/
    );
    expect(rootMatch).not.toBeNull();
    const rootCls = rootMatch![1];
    expect(rootCls).toMatch(/\bmin-h-0\b/);

    const innerMatch = AVAILABILITY_TABLE_VIEW.match(
      /<div className="flex-1 min-h-0 flex flex-col">\s*\n\s*<div\s+data-testid="schedule-section-content"/
    );
    expect(innerMatch).not.toBeNull();
  });
});
