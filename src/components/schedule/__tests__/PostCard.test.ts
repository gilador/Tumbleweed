import { readFileSync } from "fs";
import { resolve } from "path";

// Regression guard for the CEO directive: the schedule PostCard must NOT
// render a selection indicator (no ring-*, no border swap) when in multi-
// select "checked" state. The only checked-state token kept is the bare
// `checked` class hook for any CSS that still references it.
//
// Jest is configured with testEnvironment: "node" (jest.config.cjs); we read
// the component source as text and assert on the className strings.

const SOURCE = readFileSync(
  resolve(__dirname, "../PostCard.tsx"),
  "utf8"
);

describe("PostCard checked state has no selection indicator", () => {
  it("checked branch is exactly 'checked' — no ring-* or border-* tokens", () => {
    const checkedMatch = SOURCE.match(
      /checked\s*\?\s*"([^"]+)"\s*:\s*""/
    );
    expect(checkedMatch).not.toBeNull();
    const checkedCls = checkedMatch![1];
    expect(checkedCls).toBe("checked");
    expect(checkedCls).not.toMatch(/\bring-/);
    expect(checkedCls).not.toMatch(/\bborder-/);
  });

  it("base utilities on the card root are preserved verbatim", () => {
    expect(SOURCE).toMatch(
      /m-shift-block border rounded-lg transition-shadow flex flex-col h-full bg-background/
    );
  });

  it("unchecked branch remains an empty string", () => {
    const ternaryMatch = SOURCE.match(
      /checked\s*\?\s*"[^"]+"\s*:\s*"([^"]*)"/
    );
    expect(ternaryMatch).not.toBeNull();
    expect(ternaryMatch![1]).toBe("");
  });
});

describe("PostCard assignment highlight reacts to staff multi-select", () => {
  it("isHighlighted widens to also fire when the assigned user is in the checked-staff multi-select set (set-only highlight)", () => {
    // Behavior matrix case 1: checkedStaffIds.has(uid) lights up the row even
    // when selectedUserId is null. This is the regression we are fixing.
    const isHighlightedMatch = SOURCE.match(
      /const isHighlighted =\s*([^;]+);/
    );
    expect(isHighlightedMatch).not.toBeNull();
    const expr = isHighlightedMatch![1].replace(/\s+/g, " ");
    expect(expr).toMatch(/checkedStaffIds\.has\(officialAssignedUserId\)/);
  });
  it("isHighlighted preserves the single-select clause (selectedUserId === officialAssignedUserId)", () => {
    // Behavior matrix case 3: single-select path (context menu etc.) keeps
    // working. AC #6 — no regression.
    const isHighlightedMatch = SOURCE.match(
      /const isHighlighted =\s*([^;]+);/
    );
    expect(isHighlightedMatch).not.toBeNull();
    const expr = isHighlightedMatch![1].replace(/\s+/g, " ");
    expect(expr).toMatch(/officialAssignedUserId === selectedUserId/);
  });
  it("isHighlighted keeps the officialAssignedUserId !== null guard so empty cells with null selection / empty set do NOT highlight", () => {
    // Behavior matrix case 2: empty Set + null selectedUserId yields no
    // highlight; null officialAssignedUserId short-circuits to false.
    const isHighlightedMatch = SOURCE.match(
      /const isHighlighted =\s*([^;]+);/
    );
    expect(isHighlightedMatch).not.toBeNull();
    const expr = isHighlightedMatch![1].replace(/\s+/g, " ");
    expect(expr).toMatch(/officialAssignedUserId !== null/);
  });
  it("PostCard declares a required checkedStaffIds: Set<string> prop", () => {
    expect(SOURCE).toMatch(/checkedStaffIds:\s*Set<string>;/);
  });
  it("PostCard row layout remains 'grid grid-cols-2 items-center' so the recent center-align fix is preserved", () => {
    expect(SOURCE).toMatch(/grid grid-cols-2 items-center/);
  });
});
