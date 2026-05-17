import { readFileSync } from "fs";
import { resolve } from "path";

// Regression guard for the "filter chip active state was near-black" bug.
//
// Limitation: Jest is configured with testEnvironment: "node" (see
// packages/core/jest.config.cjs) and the project does not render React in
// unit tests. Visual color cannot be measured here. This test reads the
// component sources as text and asserts the active class strings now use
// dark grey (zinc-700) rather than the design system's near-black primary.

const GROUP_TOGGLE = readFileSync(
  resolve(__dirname, "../GroupToggle.tsx"),
  "utf8"
);
const SCHEDULE_NAV = readFileSync(
  resolve(__dirname, "../ScheduleNav.tsx"),
  "utf8"
);
const ASSIGNMENTS_TAB = readFileSync(
  resolve(__dirname, "../../mobile/AssignmentsTab.tsx"),
  "utf8"
);

describe("Filter chip active state — dark grey, not primary near-black", () => {
  it("GroupToggle active class uses bg-muted (matching daily/weekly toggle)", () => {
    expect(GROUP_TOGGLE).toMatch(/activeCls\s*=\s*"bg-muted"/);
  });

  it("GroupToggle no longer uses bg-zinc-700 or text-white", () => {
    expect(GROUP_TOGGLE).not.toMatch(/bg-zinc-700/);
    const match = GROUP_TOGGLE.match(/const activeCls = "([^"]*)";/);
    expect(match).not.toBeNull();
    expect(match![1]).not.toMatch(/text-white/);
  });

  it("GroupToggle no longer uses bg-primary text-primary-foreground", () => {
    expect(GROUP_TOGGLE).not.toMatch(/bg-primary text-primary-foreground/);
  });

  it("GroupToggle baseBtn retains its exact class string", () => {
    expect(GROUP_TOGGLE).toMatch(
      /const baseBtn =\s*"inline-flex items-center gap-1\.5 px-3 py-1\.5 text-xs font-medium transition-colors";/
    );
  });

  it("GroupToggle inactiveCls retains text-muted-foreground hover:bg-muted", () => {
    expect(GROUP_TOGGLE).toMatch(
      /const inactiveCls = "text-muted-foreground hover:bg-muted";/
    );
  });

  it("GroupToggle container retains its border-wrapped flex row", () => {
    expect(GROUP_TOGGLE).toMatch(
      /className="inline-flex items-center rounded-md border bg-background overflow-hidden"/
    );
  });

  it("ScheduleNav active chip uses bg-zinc-700 text-white border-zinc-700", () => {
    expect(SCHEDULE_NAV).toMatch(
      /"bg-zinc-700 text-white border-zinc-700"/
    );
  });

  it("ScheduleNav no longer uses bg-primary text-primary-foreground border-primary", () => {
    expect(SCHEDULE_NAV).not.toMatch(
      /bg-primary text-primary-foreground border-primary/
    );
  });

  it("AssignmentsTab mobile Time/Position toggle uses bg-zinc-700 text-white for active state", () => {
    expect(ASSIGNMENTS_TAB).toMatch(
      /groupBy === "time" \? "bg-zinc-700 text-white"/
    );
    expect(ASSIGNMENTS_TAB).toMatch(
      /groupBy === "post" \? "bg-zinc-700 text-white"/
    );
  });
});
