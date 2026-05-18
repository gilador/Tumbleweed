import { readFileSync } from "fs";
import { resolve } from "path";

// Source-shape regression guard for the CEO directive:
// `ScheduleSectionHeader`'s daily/weekly view toggle's active state must
// match the adjacent `RosterSwitcher` (`bg-muted`) rather than the louder
// `bg-primary text-primary-foreground` brand fill. This package's Jest
// config runs in `node` env (see `jest.config.cjs`) and forbids new deps,
// so we cannot mount the component in JSDOM to assert classNames at
// runtime; the source-shape layer is the closest available proxy.

const SOURCE = readFileSync(
  resolve(__dirname, "../ScheduleSectionHeader.tsx"),
  "utf8"
);

describe("ScheduleSectionHeader daily/weekly view toggle styling", () => {
  it("active button uses bg-muted (matching RosterSwitcher)", () => {
    expect(SOURCE).toMatch(/!weeklyView\s*\?\s*"bg-muted"/);
    expect(SOURCE).toMatch(/\bweeklyView\s*\?\s*"bg-muted"/);
  });

  it("active button does NOT use bg-primary or text-primary-foreground", () => {
    expect(SOURCE).not.toMatch(/!weeklyView\s*\?\s*"[^"]*bg-primary\b/);
    expect(SOURCE).not.toMatch(/\bweeklyView\s*\?\s*"[^"]*bg-primary\b/);
    expect(SOURCE).not.toMatch(/text-primary-foreground/);
  });

  it("toggle container retains its border-wrapped flex row", () => {
    expect(SOURCE).toMatch(
      /className="flex rounded-md border border-border overflow-hidden"/
    );
  });

  it("inactive branch still uses hover:bg-accent", () => {
    expect(SOURCE).toMatch(/!weeklyView\s*\?\s*"bg-muted"\s*:\s*"hover:bg-accent"/);
    expect(SOURCE).toMatch(/\bweeklyView\s*\?\s*"bg-muted"\s*:\s*"hover:bg-accent"/);
  });

  it("i18n keys dailyView and weeklyView are still referenced", () => {
    expect(SOURCE).toMatch(/t\("dailyView"\)/);
    expect(SOURCE).toMatch(/t\("weeklyView"\)/);
  });

  it("per-button base classes (px/py/text/font/transition) are preserved", () => {
    // Both buttons share the same base; assert the exact base string occurs.
    const occurrences = SOURCE.match(/px-2\.5 py-1 text-xs font-medium transition-colors/g);
    expect(occurrences).not.toBeNull();
    expect(occurrences!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("ScheduleSectionHeader avg shift duration descriptor", () => {
  it("renders the bold safeDuration number followed by the avgShiftDurationLabel descriptor", () => {
    expect(SOURCE).toMatch(/safeDuration\.toFixed\(1\)/);
    expect(SOURCE).toMatch(/t\("avgShiftDurationLabel"\)/);
    expect(SOURCE).toMatch(
      /safeDuration\.toFixed\(1\)[\s\S]*?t\("avgShiftDurationLabel"\)/
    );
  });
});
