import { computeLevels } from "../shiftLevels";

describe("computeLevels", () => {
  // ── Clean divisions filter ──────────────────────────────────
  describe("clean divisions", () => {
    it("only includes shift counts that produce 15-min increment durations", () => {
      const levels = computeLevels(10, 2, 20);
      const shiftCounts = levels.map((l) => l.shifts);

      // 10h: 1×10, 2×5, 4×2.5, 5×2, 8×1.25, 10×1, 20×0.5
      expect(shiftCounts).toContain(1);
      expect(shiftCounts).toContain(2);
      expect(shiftCounts).toContain(4);
      expect(shiftCounts).toContain(5);
      expect(shiftCounts).toContain(10);
      expect(shiftCounts).toContain(20);

      // 3×3.33, 6×1.67, 7×1.43 excluded
      expect(shiftCounts).not.toContain(3);
      expect(shiftCounts).not.toContain(6);
      expect(shiftCounts).not.toContain(7);
    });

    it("durations are all multiples of 0.25h", () => {
      const levels = computeLevels(10, 2, 20);
      for (const level of levels) {
        expect((level.duration * 4) % 1).toBeCloseTo(0, 5);
      }
    });
  });

  // ── Feasibility formula ─────────────────────────────────────
  describe("feasibility: staff × ceil(shifts/2) ≥ shifts × posts", () => {
    it("marks feasible when capacity is sufficient", () => {
      // 2 shifts, 5 posts, 12 staff
      // needed = 10, maxPerWorker = ceil(2/2) = 1, available = 12
      const levels = computeLevels(10, 5, 12);
      const level2 = levels.find((l) => l.shifts === 2);
      expect(level2).toBeDefined();
      expect(level2!.feasible).toBe(true);
      expect(level2!.neededSlots).toBe(10);
      expect(level2!.availableSlots).toBe(12);
    });

    it("marks infeasible when capacity is insufficient", () => {
      // 5 shifts, 5 posts, 6 staff
      // needed = 25, maxPerWorker = ceil(5/2) = 3, available = 18
      const levels = computeLevels(10, 5, 6);
      const level5 = levels.find((l) => l.shifts === 5);
      expect(level5).toBeDefined();
      expect(level5!.feasible).toBe(false);
      expect(level5!.neededSlots).toBe(25);
      expect(level5!.availableSlots).toBe(18);
    });

    it("single shift feasible when staff >= posts", () => {
      const levels = computeLevels(10, 5, 5);
      const level1 = levels.find((l) => l.shifts === 1);
      expect(level1!.feasible).toBe(true);
    });

    it("single shift infeasible when staff < posts", () => {
      const levels = computeLevels(10, 5, 3);
      const level1 = levels.find((l) => l.shifts === 1);
      expect(level1!.feasible).toBe(false);
    });
  });

  // ── Gap calculations ────────────────────────────────────────
  describe("gap calculations", () => {
    it("computes staffGap for infeasible levels", () => {
      // 4 shifts, 5 posts, 6 staff
      // needed = 20, maxPerWorker = ceil(4/2) = 2, available = 12
      // staffGap = ceil(20/2) - 6 = 4
      const levels = computeLevels(10, 5, 6);
      const level4 = levels.find((l) => l.shifts === 4);
      expect(level4!.feasible).toBe(false);
      expect(level4!.staffGap).toBe(4);
    });

    it("computes postGap for infeasible levels", () => {
      // 4 shifts, 5 posts, 6 staff, available = 12
      // postGap = 5 - floor(12/4) = 5 - 3 = 2
      const levels = computeLevels(10, 5, 6);
      const level4 = levels.find((l) => l.shifts === 4);
      expect(level4!.postGap).toBe(2);
    });

    it("feasible levels have no gap info", () => {
      const levels = computeLevels(10, 2, 12);
      const feasible = levels.filter((l) => l.feasible);
      for (const level of feasible) {
        expect(level.staffGap).toBeUndefined();
        expect(level.postGap).toBeUndefined();
      }
    });
  });

  // ── Rest derivation ─────────────────────────────────────────
  describe("rest derivation", () => {
    it("rest equals duration for multi-shift levels", () => {
      const levels = computeLevels(10, 2, 20);
      const level4 = levels.find((l) => l.shifts === 4);
      expect(level4!.restBetween).toBe(2.5); // duration = 2.5h
    });

    it("rest is 0 for single shift", () => {
      const levels = computeLevels(10, 2, 20);
      const level1 = levels.find((l) => l.shifts === 1);
      expect(level1!.restBetween).toBe(0);
    });
  });

  // ── Per-worker breakdown ────────────────────────────────────
  describe("per-worker breakdown", () => {
    it("computes shifts per worker and work hours", () => {
      // 4 shifts, 5 posts, 12 staff → needed=20, shiftsPerWorker=ceil(20/12)=2
      const levels = computeLevels(10, 5, 12);
      const level4 = levels.find((l) => l.shifts === 4);
      expect(level4!.shiftsPerWorker).toBe(2);
      expect(level4!.workHours).toBe(5); // 2 × 2.5h
    });

    it("minimal load when many staff", () => {
      // 2 shifts, 3 posts, 12 staff → needed=6, shiftsPerWorker=ceil(6/12)=1
      const levels = computeLevels(10, 3, 12);
      const level2 = levels.find((l) => l.shifts === 2);
      expect(level2!.shiftsPerWorker).toBe(1);
      expect(level2!.workHours).toBe(5); // 1 × 5h
    });

    it("infeasible levels have 0 shifts per worker", () => {
      const levels = computeLevels(10, 5, 3);
      const infeasible = levels.filter((l) => !l.feasible);
      for (const level of infeasible) {
        expect(level.shiftsPerWorker).toBe(0);
      }
    });
  });

  // ── Ordering ────────────────────────────────────────────────
  describe("ordering", () => {
    it("levels are sorted by shift count ascending", () => {
      const levels = computeLevels(10, 2, 20);
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i].shifts).toBeGreaterThan(levels[i - 1].shifts);
      }
    });
  });

  // ── Min shift duration ──────────────────────────────────────
  describe("min shift duration", () => {
    it("defaults to 0.5h", () => {
      const levels = computeLevels(10, 2, 20);
      const minDur = Math.min(...levels.map((l) => l.duration));
      expect(minDur).toBeGreaterThanOrEqual(0.5);
    });

    it("custom minimum caps max levels", () => {
      const levels = computeLevels(10, 2, 20, 2.0);
      for (const level of levels) {
        expect(level.duration).toBeGreaterThanOrEqual(2.0);
      }
      // Max shift count = 10/2 = 5
      expect(levels[levels.length - 1].shifts).toBeLessThanOrEqual(5);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────
  describe("edge cases", () => {
    it("returns empty for 0 staff", () => {
      expect(computeLevels(10, 2, 0)).toEqual([]);
    });

    it("returns empty for 0 posts", () => {
      expect(computeLevels(10, 0, 5)).toEqual([]);
    });

    it("returns empty for 0 operation hours", () => {
      expect(computeLevels(0, 2, 5)).toEqual([]);
    });

    it("handles 1h operation", () => {
      const levels = computeLevels(1, 1, 2);
      expect(levels.length).toBeGreaterThanOrEqual(1);
      expect(levels[0].shifts).toBe(1);
      expect(levels[0].duration).toBe(1);
    });

    it("handles large staff count", () => {
      const levels = computeLevels(10, 2, 100);
      // All levels should be feasible with 100 staff
      for (const level of levels) {
        expect(level.feasible).toBe(true);
      }
    });

    it("staff equals posts: only 1 shift feasible", () => {
      const levels = computeLevels(10, 5, 5);
      const feasible = levels.filter((l) => l.feasible);
      expect(feasible.length).toBe(1);
      expect(feasible[0].shifts).toBe(1);
    });
  });
});
