// useLongPress: pure-helper coverage. The package's Jest env runs in `node`
// with no jsdom / @testing-library / react-test-renderer, so we cannot mount
// the hook. The hook's behavior is decomposed into two pure helpers
// (shouldCancelOnMove, isWithinJustLongPressed) plus the React glue that
// wires them to a setTimeout. We unit-test the pure helpers exhaustively,
// and assert the source-shape of the hook itself so the timer / pointer
// wiring is regression-locked. The mobile-staff-multiselect Playwright
// spec covers the integration path end-to-end.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  shouldCancelOnMove,
  isWithinJustLongPressed,
  JUST_LONG_PRESSED_MS,
} from "../useLongPress";

describe("useLongPress — pure helpers", () => {
  describe("shouldCancelOnMove", () => {
    it("returns false when the pointer has not moved", () => {
      expect(
        shouldCancelOnMove({ x: 100, y: 100 }, { x: 100, y: 100 }, 10)
      ).toBe(false);
    });

    it("returns false when move is within tolerance (5px diagonal)", () => {
      // sqrt(3^2 + 4^2) = 5
      expect(
        shouldCancelOnMove({ x: 100, y: 100 }, { x: 103, y: 104 }, 10)
      ).toBe(false);
    });

    it("returns true when move exceeds tolerance on a single axis", () => {
      expect(
        shouldCancelOnMove({ x: 100, y: 100 }, { x: 115, y: 100 }, 10)
      ).toBe(true);
    });

    it("returns true when diagonal move exceeds tolerance (3-4-5)", () => {
      // sqrt(6^2 + 8^2) = 10 — equal to tolerance, NOT greater.
      expect(
        shouldCancelOnMove({ x: 0, y: 0 }, { x: 6, y: 8 }, 10)
      ).toBe(false);
      // sqrt(9^2 + 12^2) = 15 — greater than 10.
      expect(
        shouldCancelOnMove({ x: 0, y: 0 }, { x: 9, y: 12 }, 10)
      ).toBe(true);
    });

    it("treats negative deltas the same as positive (Math.hypot)", () => {
      expect(
        shouldCancelOnMove({ x: 100, y: 100 }, { x: 85, y: 100 }, 10)
      ).toBe(true);
    });
  });

  describe("isWithinJustLongPressed", () => {
    it("returns true immediately after firing", () => {
      const t = 1000;
      expect(isWithinJustLongPressed(t, t)).toBe(true);
    });

    it("returns true within the suppression window (299ms)", () => {
      const fired = 1000;
      expect(isWithinJustLongPressed(fired, fired + 299)).toBe(true);
    });

    it("returns false at the boundary (300ms)", () => {
      const fired = 1000;
      expect(
        isWithinJustLongPressed(fired, fired + JUST_LONG_PRESSED_MS)
      ).toBe(false);
    });

    it("returns false long after firing", () => {
      expect(isWithinJustLongPressed(1000, 5000)).toBe(false);
    });

    it("returns false for the initial unset state (firedAt=0)", () => {
      expect(isWithinJustLongPressed(0, Date.now())).toBe(false);
    });
  });
});

describe("useLongPress — source shape (timer + pointer wiring)", () => {
  const source = readFileSync(
    resolve(__dirname, "../useLongPress.ts"),
    "utf-8"
  );

  it("schedules a setTimeout keyed on threshold", () => {
    expect(source).toMatch(/setTimeout\([\s\S]*optionsRef\.current\.threshold/);
  });

  it("clears the timer on pointerup / pointercancel via reset()", () => {
    // reset() clears timer and nulls start ref. Both onPointerUp and
    // onPointerCancel must call reset.
    expect(source).toMatch(/onPointerUp = useCallback\(\(\) => \{[\s\S]*?reset\(\)/);
    expect(source).toMatch(
      /onPointerCancel = useCallback\(\(\) => \{[\s\S]*?reset\(\)/
    );
    expect(source).toMatch(/clearTimeout\(timerRef\.current\)/);
  });

  it("cancels the pending timer on a move beyond moveTolerance", () => {
    expect(source).toMatch(/Math\.hypot\(dx, dy\) > optionsRef\.current\.moveTolerance/);
  });

  it("preventDefaults the contextmenu (iOS callout / Android menu)", () => {
    expect(source).toMatch(/onContextMenu[\s\S]*?e\.preventDefault\(\)/);
  });

  it("only reacts to primary pointers", () => {
    expect(source).toMatch(/if \(!e\.isPrimary\) return/);
  });

  it("captures the press-start target (not document.activeElement)", () => {
    expect(source).toMatch(/startRef\.current = \{ x: e\.clientX, y: e\.clientY, target \}/);
    expect(source).toMatch(/optionsRef\.current\.onLongPress\(start\.target\)/);
  });

  it("exposes justLongPressed() with the 300ms window", () => {
    expect(source).toMatch(/Date\.now\(\) - justLongPressedAtRef\.current < JUST_LONG_PRESSED_MS/);
  });

  it("clears the timer on unmount", () => {
    expect(source).toMatch(/useEffect\(\(\) => \{[\s\S]*?return \(\) => \{[\s\S]*?clearTimeout/);
  });
});
