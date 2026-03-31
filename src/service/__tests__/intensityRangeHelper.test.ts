import { calculateFeasibleIntensityRange } from "../intensityRangeHelper";

// Mock console methods to avoid cluttering test output
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

describe("Intensity Range Helper", () => {
  describe("calculateFeasibleIntensityRange", () => {
    it("should return feasible intensities for normal operation", () => {
      const result = calculateFeasibleIntensityRange(
        "08:00", // startTime
        "18:00", // endTime (10 hours)
        3, // postCount
        12 // staffCount
      );

      expect(result.feasibleIntensities.length).toBeGreaterThan(0);
      expect(result.recommendedIntensity).toBeGreaterThan(0);
      expect(result.maxFeasibleIntensity).toBeGreaterThan(0);
      expect(result.minFeasibleIntensity).toBeGreaterThan(0);
    });

    it("should handle zero posts gracefully", () => {
      const result = calculateFeasibleIntensityRange(
        "08:00", // startTime
        "18:00", // endTime
        0, // postCount
        12 // staffCount
      );

      expect(result.feasibleIntensities).toEqual([1]);
      expect(result.recommendedIntensity).toBe(1);
    });

    it("should handle zero staff gracefully", () => {
      const result = calculateFeasibleIntensityRange(
        "08:00", // startTime
        "18:00", // endTime
        3, // postCount
        0 // staffCount
      );

      expect(result.feasibleIntensities).toEqual([1]);
      expect(result.recommendedIntensity).toBe(1);
    });

    it("should handle overnight shifts (not supported)", () => {
      const result = calculateFeasibleIntensityRange(
        "22:00", // startTime
        "06:00", // endTime (overnight)
        2, // postCount
        8 // staffCount
      );

      expect(result.feasibleIntensities).toEqual([1]);
      expect(result.recommendedIntensity).toBe(1);
    });

    it("should exclude intensities that exceed operation time", () => {
      const result = calculateFeasibleIntensityRange(
        "08:00", // startTime
        "12:00", // endTime (4 hours)
        2, // postCount
        6 // staffCount
      );

      // Should not include intensities >= 4 hours
      result.feasibleIntensities.forEach((intensity) => {
        expect(intensity).toBeLessThan(4);
      });
    });

    it("should return at least one feasible intensity", () => {
      const result = calculateFeasibleIntensityRange(
        "08:00", // startTime
        "09:00", // endTime (1 hour - very short)
        1, // postCount
        2 // staffCount
      );

      expect(result.feasibleIntensities.length).toBeGreaterThanOrEqual(1);
      expect(result.recommendedIntensity).toBeGreaterThan(0);
    });

    it("should have recommended intensity within feasible range", () => {
      const result = calculateFeasibleIntensityRange(
        "08:00", // startTime
        "18:00", // endTime
        3, // postCount
        12 // staffCount
      );

      expect(result.feasibleIntensities).toContain(result.recommendedIntensity);
    });

    it("should have min/max values correspond to actual range", () => {
      const result = calculateFeasibleIntensityRange(
        "08:00", // startTime
        "18:00", // endTime
        3, // postCount
        12 // staffCount
      );

      if (result.feasibleIntensities.length > 1) {
        expect(result.minFeasibleIntensity).toBe(
          Math.min(...result.feasibleIntensities)
        );
        expect(result.maxFeasibleIntensity).toBe(
          Math.max(...result.feasibleIntensities)
        );
      }
    });
  });
});
