import { readFileSync } from "fs";
import { resolve } from "path";

// Regression guard for the chevron quick-scroll arrow positioning fix.
//
// Limitation: Jest is configured with testEnvironment: "node" (see
// packages/core/jest.config.cjs) and the project does not render React in
// unit tests. Real layout cannot be measured here. This test reads the
// component source files as text and asserts that the chevron class strings
// contain the canonical Tailwind centering idioms required by the task's
// acceptance criteria. Visual / E2E coverage of actual on-screen positioning
// is the appropriate complement; this test guards against accidental drift
// of the class strings back to the buggy edge-anchored layout.

const CORE_SRC = resolve(__dirname, "../../");
const WORKER_LIST = readFileSync(
  resolve(CORE_SRC, "components/WorkerList.tsx"),
  "utf8"
);
const AVAILABILITY_TABLE_VIEW = readFileSync(
  resolve(CORE_SRC, "components/AvailabilityTableView.tsx"),
  "utf8"
);

function chevronClassString(source: string, testId: string): string {
  // Find the <button data-testid="..."> element and extract its className.
  // Attributes appear on their own lines after the testid (aria-label, onClick,
  // className). We slice forward a generous window and pull the first
  // className="..." we find — this is the className of this button because
  // the next button starts with its own data-testid line further down.
  const testIdIdx = source.indexOf(`data-testid="${testId}"`);
  expect(testIdIdx).toBeGreaterThan(-1);
  const window = source.slice(testIdIdx, testIdIdx + 1500);
  const classMatch = window.match(/className="([^"]+)"/);
  expect(classMatch).not.toBeNull();
  return classMatch![1];
}

describe("WorkerList staff-scroll chevrons — horizontal centering above/below cards", () => {
  it("up chevron is horizontally centered (left-1/2 -translate-x-1/2) and not start-anchored", () => {
    const cls = chevronClassString(WORKER_LIST, "staff-scroll-up");
    expect(cls).toContain("left-1/2");
    expect(cls).toContain("-translate-x-1/2");
    expect(cls).toContain("-top-8");
    expect(cls).not.toMatch(/(?<!-)\btop-2\b/);
    expect(cls).not.toMatch(/\bstart-0\b/);
    // hit area / z-index / padding unchanged per AC
    expect(cls).toContain("z-10");
    expect(cls).toContain("p-1");
    // chip background styling
    expect(cls).toContain("bg-secondary");
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("shadow-sm");
    expect(cls).toContain("hover:bg-secondary/80");
    expect(cls).toContain("text-secondary-foreground");
    expect(cls).not.toMatch(/\btext-muted-foreground\b/);
    // 1px gray hairline so the chip reads as a button against bg-secondary panels
    expect(cls).toContain("border");
    expect(cls).toContain("border-input");
  });

  it("down chevron is horizontally centered (left-1/2 -translate-x-1/2) and not start-anchored", () => {
    const cls = chevronClassString(WORKER_LIST, "staff-scroll-down");
    expect(cls).toContain("left-1/2");
    expect(cls).toContain("-translate-x-1/2");
    expect(cls).toContain("-bottom-8");
    expect(cls).not.toMatch(/(?<!-)\bbottom-2\b/);
    expect(cls).not.toMatch(/\bstart-0\b/);
    expect(cls).toContain("z-10");
    expect(cls).toContain("p-1");
    // chip background styling
    expect(cls).toContain("bg-secondary");
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("shadow-sm");
    expect(cls).toContain("hover:bg-secondary/80");
    expect(cls).toContain("text-secondary-foreground");
    expect(cls).not.toMatch(/\btext-muted-foreground\b/);
    // 1px gray hairline so the chip reads as a button against bg-secondary panels
    expect(cls).toContain("border");
    expect(cls).toContain("border-input");
  });

  it("scroll viewport no longer carries the obsolete ps-9 inline-start gutter", () => {
    // The ps-9 gutter only existed because chevrons sat on the inline-start
    // edge. With chevrons centered above/below the cards, the gutter must
    // shrink so inline padding is symmetric.
    const viewportIdx = WORKER_LIST.indexOf(
      `data-testid="staff-section-content"`
    );
    expect(viewportIdx).toBeGreaterThan(-1);
    const window = WORKER_LIST.slice(viewportIdx, viewportIdx + 500);
    const classMatch = window.match(/className="([^"]+)"/);
    expect(classMatch).not.toBeNull();
    const cls = classMatch![1];
    expect(cls).not.toMatch(/\bps-9\b/);
    expect(cls).toMatch(/\bpx-2\b/);
  });

  it("parent wrapper no longer clips chevron overflow with overflow-hidden", () => {
    const parentLine = WORKER_LIST.match(
      /<div className="([^"]*border-primary-rounded-lg[^"]*)"/
    );
    expect(parentLine).not.toBeNull();
    expect(parentLine![1]).not.toMatch(/\boverflow-hidden\b/);
  });
});

describe("AvailabilityTableView schedule-scroll chevrons — vertical centering on start/end edges", () => {
  it("start chevron is vertically centered on the inline-start edge", () => {
    const cls = chevronClassString(
      AVAILABILITY_TABLE_VIEW,
      "schedule-scroll-start"
    );
    // `top` is now applied via inline style (measured against the visible
    // scroll viewport) — only the self-centering -translate-y-1/2 remains as
    // a class.
    expect(cls).toContain("-translate-y-1/2");
    // logical inline anchor preserved (negative offset) so RTL flips correctly
    expect(cls).toMatch(/-start-8/);
    expect(cls).not.toMatch(/(?<!-)\bstart-0\b/);
    expect(cls).not.toMatch(/\btop-2\b/);
    expect(cls).toContain("z-10");
    expect(cls).toContain("p-1");
    // chip background styling
    expect(cls).toContain("bg-secondary");
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("shadow-sm");
    expect(cls).toContain("hover:bg-secondary/80");
    expect(cls).toContain("text-secondary-foreground");
    expect(cls).not.toMatch(/\btext-muted-foreground\b/);
    // 1px gray hairline so the chip reads as a button against bg-secondary panels
    expect(cls).toContain("border");
    expect(cls).toContain("border-input");
  });

  it("end chevron is vertically centered on the inline-end edge", () => {
    const cls = chevronClassString(
      AVAILABILITY_TABLE_VIEW,
      "schedule-scroll-end"
    );
    // `top` is now applied via inline style (measured against the visible
    // scroll viewport) — only the self-centering -translate-y-1/2 remains as
    // a class.
    expect(cls).toContain("-translate-y-1/2");
    expect(cls).toMatch(/-end-8/);
    expect(cls).not.toMatch(/(?<!-)\bend-0\b/);
    expect(cls).not.toMatch(/\btop-2\b/);
    expect(cls).toContain("z-10");
    expect(cls).toContain("p-1");
    // chip background styling
    expect(cls).toContain("bg-secondary");
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("shadow-sm");
    expect(cls).toContain("hover:bg-secondary/80");
    expect(cls).toContain("text-secondary-foreground");
    expect(cls).not.toMatch(/\btext-muted-foreground\b/);
    // 1px gray hairline so the chip reads as a button against bg-secondary panels
    expect(cls).toContain("border");
    expect(cls).toContain("border-input");
  });

  it("schedule chevrons receive top via inline style (measured against the visible scroll viewport), not a Tailwind class", () => {
    // The fix moved vertical-centering from `top-1/2` (relative to the
    // flex parent which can drift taller than the visible card strip) to
    // a measured value derived from scrollContainerRef inside
    // updateChevronState. We can't measure runtime style here, but we can
    // assert the source carries the imperative pattern.
    expect(AVAILABILITY_TABLE_VIEW).toMatch(/style=\{\{\s*top:\s*centerY\s*\}\}/);
    expect(AVAILABILITY_TABLE_VIEW).toMatch(/setCenterY\s*\(/);
  });

  it("schedule-section-content keeps px-9 horizontal padding so the chevrons fit inside section bounds without clipping by Card / CardContent / schedule-section overflow-hidden ancestors", () => {
    const idx = AVAILABILITY_TABLE_VIEW.indexOf(
      `data-testid="schedule-section-content"`
    );
    expect(idx).toBeGreaterThan(-1);
    const window = AVAILABILITY_TABLE_VIEW.slice(idx, idx + 500);
    const classMatch = window.match(/className="([^"]+)"/);
    expect(classMatch).not.toBeNull();
    const cls = classMatch![1];
    expect(cls).toMatch(/\bpx-9\b/);
    expect(cls).not.toMatch(/\bps-11\b/);
    expect(cls).not.toMatch(/\bpe-2\b/);
  });

  it("removes overflow-hidden from the three clippers between the chevron and the visible rounded border", () => {
    // (a) AvailabilityTableView root (line 296 area) — find by `w-full h-full flex flex-col`
    const rootMatch = AVAILABILITY_TABLE_VIEW.match(
      /<div className=\{`w-full h-full flex flex-col([^`]*)`/
    );
    expect(rootMatch).not.toBeNull();
    expect(rootMatch![1]).not.toMatch(/\boverflow-hidden\b/);

    // (b) AvailabilityTableView inner flex-1 wrapper (line 297 area)
    const innerMatch = AVAILABILITY_TABLE_VIEW.match(
      /<div className="flex-1[^"]*flex flex-col[^"]*"/
    );
    expect(innerMatch).not.toBeNull();
    expect(innerMatch![0]).not.toMatch(/\boverflow-hidden\b/);

    // (c) ShiftManager outer rounded-border wrapper (line 425 area)
    const SHIFT_MANAGER = readFileSync(
      resolve(CORE_SRC, "components/ShiftManager.tsx"),
      "utf8"
    );
    const outerMatch = SHIFT_MANAGER.match(
      /<div className="[^"]*border-primary-rounded-lg[^"]*"/
    );
    expect(outerMatch).not.toBeNull();
    expect(outerMatch![0]).not.toMatch(/\boverflow-hidden\b/);
  });
});

describe("WorkerList sits inside a py-9 breathing-room wrapper in ShiftManager", () => {
  it("the leftPanel slot in ShiftManager wraps <WorkerList /> in a py-9 container so the fully-outside chevron isn't clipped by SplitScreen / staff_section / CardContent / Card", () => {
    const SHIFT_MANAGER = readFileSync(
      resolve(CORE_SRC, "components/ShiftManager.tsx"),
      "utf8"
    );
    // The wrapper opens immediately before <WorkerList; assert it carries py-9
    // and reserves min-height-0 so the inner flex viewport keeps scrolling.
    const idx = SHIFT_MANAGER.indexOf("<WorkerList");
    expect(idx).toBeGreaterThan(-1);
    // Look back ~400 chars for the immediately-preceding opening <div className="…">
    const preceding = SHIFT_MANAGER.slice(Math.max(0, idx - 400), idx);
    const lastDivOpen = preceding.match(
      /<div className="([^"]*)"[^>]*>\s*$/
    );
    expect(lastDivOpen).not.toBeNull();
    const cls = lastDivOpen![1];
    expect(cls).toMatch(/\bpy-9\b/);
    expect(cls).toMatch(/\bh-full\b/);
    expect(cls).toMatch(/\bmin-h-0\b/);
  });
});

// Round 2 follow-up: with `overflow-hidden` removed from Card / CardContent /
// `#assignments-table` / `#staff_section` / SplitScreen (so the chevrons can
// float over rounded borders), nothing stopped flex children from taking
// their content's `min-content` width. With many hour slots the schedule
// strip's intrinsic min-content pushed `CardContent` (and `#assignments-table`
// / `#staff_section`) wider than the parent Card, which in turn pushed the
// staff-controls-row's `flex-1 min-w-0` BulkSelectionBar wrapper off-screen
// (only the count pill stayed inside the viewport on the screenshot).
// The fix adds `min-w-0` to the three flex wrappers so they can shrink to
// the available space and the layout stays bounded.
describe("ShiftManager flex wrappers carry min-w-0 to prevent layout blowout", () => {
  const SHIFT_MANAGER = readFileSync(
    resolve(CORE_SRC, "components/ShiftManager.tsx"),
    "utf8"
  );

  it("CardContent has min-w-0 alongside flex-col flex-1 min-h-0", () => {
    const m = SHIFT_MANAGER.match(
      /<CardContent className="([^"]*)"/
    );
    expect(m).not.toBeNull();
    const cls = m![1];
    expect(cls).toMatch(/\bmin-w-0\b/);
    expect(cls).toMatch(/\bflex-1\b/);
    expect(cls).toMatch(/\bmin-h-0\b/);
  });

  it("#assignments-table wrapper has min-w-0", () => {
    // The block starts with a className then `id="assignments-table"` a few
    // lines later.
    const idx = SHIFT_MANAGER.indexOf('id="assignments-table"');
    expect(idx).toBeGreaterThan(-1);
    const preceding = SHIFT_MANAGER.slice(Math.max(0, idx - 400), idx);
    const m = preceding.match(/className="([^"]*)"\s*[^]*$/);
    expect(m).not.toBeNull();
    const cls = m![1];
    expect(cls).toMatch(/\bmin-w-0\b/);
  });

  it("#staff_section wrapper has min-w-0", () => {
    const idx = SHIFT_MANAGER.indexOf('id="staff_section"');
    expect(idx).toBeGreaterThan(-1);
    const following = SHIFT_MANAGER.slice(idx, idx + 600);
    const m = following.match(/className="([^"]*)"/);
    expect(m).not.toBeNull();
    const cls = m![1];
    expect(cls).toMatch(/\bmin-w-0\b/);
  });
});

describe("schedule rows use bg-background", () => {
  it("PostCard rows use bg-background", () => {
    const POST_CARD = readFileSync(
      resolve(CORE_SRC, "components/schedule/PostCard.tsx"),
      "utf8"
    );
    expect(POST_CARD).toContain("bg-background");
    expect(POST_CARD).not.toContain("bg-muted");
    expect(POST_CARD).toMatch(/className="row /);
  });

  it("TimeViewPostRow row className layers post-checked > default bg-background", () => {
    const ROW = readFileSync(
      resolve(CORE_SRC, "components/schedule/TimeViewPostRow.tsx"),
      "utf8"
    );
    expect(ROW).toContain("post-checked bg-primary-soft");
    expect(ROW).toContain("bg-background");
    expect(ROW).not.toMatch(/"bg-muted"/);
  });
});
