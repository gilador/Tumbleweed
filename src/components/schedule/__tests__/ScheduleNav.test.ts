import { readFileSync } from "fs";
import { resolve } from "path";

// Regression guard for the chip-click "scrolls page vertically" bug.
//
// Limitation: Jest is configured with testEnvironment: "node" (see
// packages/core/jest.config.cjs) and the project does not render React in
// unit tests. Real DOM scroll behavior cannot be measured here. This test
// reads the component source as text and asserts the canonical bounded
// horizontal scroll idiom required by the task's acceptance criteria.
// Visual / browser-manual coverage of LTR + RTL behavior is the appropriate
// complement; this test guards against accidental regression to
// Element.scrollIntoView (which walks vertical ancestors).

const SCHEDULE_NAV = readFileSync(
  resolve(__dirname, "../ScheduleNav.tsx"),
  "utf8"
);

function handleClickBody(source: string): string {
  const start = source.indexOf("const handleClick");
  expect(start).toBeGreaterThan(-1);
  // Body extends until the next top-level `return (` JSX block.
  const end = source.indexOf("return (", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("ScheduleNav chip click — bounded horizontal scroll", () => {
  const body = handleClickBody(SCHEDULE_NAV);

  it("does NOT call Element.scrollIntoView (root cause of the vertical-page-scroll bug)", () => {
    expect(body).not.toMatch(/\.scrollIntoView\b/);
  });

  it("uses container.scrollTo with a left offset and smooth behavior", () => {
    expect(body).toMatch(
      /container\.scrollTo\(\{[^}]*left[^}]*behavior:\s*"smooth"/
    );
  });

  it("derives the target left from getBoundingClientRect deltas (LTR + RTL safe)", () => {
    expect(body).toMatch(/getBoundingClientRect\(\)/);
    expect(body).toMatch(/scrollLeft\s*\+\s*delta/);
  });

  it("preserves the analytics chip-click hook", () => {
    expect(body).toMatch(/onChipClick\?\.\(idx\)/);
  });

  it("preserves the early-return guards for missing container / element", () => {
    expect(body).toMatch(/if\s*\(!container\)\s*return/);
    expect(body).toMatch(/if\s*\(!el\)\s*return/);
  });
});

describe("ScheduleNav chip styling — active branch uses bg-muted", () => {
  it("preserves the container className verbatim", () => {
    expect(SCHEDULE_NAV).toContain(
      'className="flex gap-1.5 mb-2 overflow-x-auto py-1 scroll-smooth"'
    );
  });

  it("preserves the base button utilities verbatim", () => {
    expect(SCHEDULE_NAV).toContain(
      "whitespace-nowrap shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-medium tabular-nums transition-colors"
    );
  });

  it("active branch uses bg-muted and border-border", () => {
    expect(SCHEDULE_NAV).toMatch(/\?\s*"bg-muted border-border"/);
  });

  it("active branch does NOT use bg-zinc-700, text-white, or border-zinc-700", () => {
    expect(SCHEDULE_NAV).not.toMatch(/bg-zinc-700/);
    expect(SCHEDULE_NAV).not.toMatch(/text-white/);
    expect(SCHEDULE_NAV).not.toMatch(/border-zinc-700/);
  });

  it("inactive branch is preserved verbatim", () => {
    expect(SCHEDULE_NAV).toContain(
      "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
    );
  });
});
