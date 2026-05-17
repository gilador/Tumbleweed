import { readFileSync } from "fs";
import { resolve } from "path";

// Regression guard for the CEO directive: the post card head's checked /
// edit-mode background must be `bg-muted` (soft grey), not `bg-primary-soft`
// (blue tint). bg-primary-soft remains intentional in WorkerList,
// AvailabilityHeatmap, and TimeViewPostRow — this test only pins
// PositionCardHead. Jest is configured with testEnvironment: "node"
// (jest.config.cjs), so we read the component source as text and assert on
// the className strings rather than mounting the component.

const SOURCE = readFileSync(
  resolve(__dirname, "../PositionCardHead.tsx"),
  "utf8"
);

describe("PositionCardHead checked/edit background uses bg-muted", () => {
  it("checked branch contains bg-muted", () => {
    expect(SOURCE).toMatch(/checked\s*\?\s*"bg-muted"/);
  });

  it("checked branch does NOT contain bg-primary-soft (pinning the swap)", () => {
    expect(SOURCE).not.toMatch(/checked\s*\?\s*"bg-primary-soft"/);
  });

  it("inactive branch preserved: bg-background hover:bg-border-strong", () => {
    expect(SOURCE).toMatch(
      /:\s*"bg-background hover:bg-border-strong"/
    );
  });

  it("base utilities on the head div are preserved verbatim", () => {
    expect(SOURCE).toMatch(
      /head post-head group flex items-center gap-2\.5 px-3\.5 py-3 select-none border-b border-border transition-colors/
    );
  });

  it("inline-edit input uses bg-transparent so it blends with the parent header in all states", () => {
    expect(SOURCE).toMatch(
      /pos-name editing flex-1 min-w-0 px-2 py-0\.5 text-sm font-semibold bg-transparent outline-none/
    );
  });

  it("inline-edit input does NOT contain bg-background, border-b, or border-primary", () => {
    const editInputMatch = SOURCE.match(/className="pos-name editing[^"]+"/);
    expect(editInputMatch).not.toBeNull();
    const cls = editInputMatch![0];
    expect(cls).not.toMatch(/bg-background/);
    expect(cls).not.toMatch(/border-b/);
    expect(cls).not.toMatch(/border-primary/);
  });

  it("inline-edit input preserves base utilities verbatim", () => {
    expect(SOURCE).toMatch(
      /pos-name editing flex-1 min-w-0 px-2 py-0\.5 text-sm font-semibold[^"]*outline-none/
    );
  });
});
