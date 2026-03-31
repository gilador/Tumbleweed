import {
  getDistinguishedIntensities,
  clearCalculationCache,
  getCacheStats,
} from "../shiftCalculationCache";

// Mock console methods to avoid cluttering test output
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  clearCalculationCache();
});

describe("Shift Calculation Cache", () => {
  describe("getDistinguishedIntensities", () => {
    it("should return distinguished intensities for normal operation", () => {
      const result = getDistinguishedIntensities({
        startTime: "08:00",
        endTime: "18:00", // 10 hours
        postCount: 3,
        staffCount: 12,
      });

      expect(result.distinguishedIntensities.length).toBeGreaterThan(0);
      expect(result.intensityDurationMap).toBeDefined();
      expect(result.durationGroups).toBeDefined();

      // Each distinguished intensity should have a unique duration
      const durations = result.distinguishedIntensities.map(
        (i) => result.intensityDurationMap[i]
      );
      const uniqueDurations = [...new Set(durations)];
      expect(durations.length).toBe(uniqueDurations.length);
    });

    it("should prefer higher intensity for same duration (more rest)", () => {
      const result = getDistinguishedIntensities({
        startTime: "08:00",
        endTime: "18:00",
        postCount: 3,
        staffCount: 12,
      });

      // Check that for each duration group, we chose the highest intensity
      Object.values(result.durationGroups).forEach((intensitiesInGroup) => {
        if (intensitiesInGroup.length > 1) {
          const maxIntensity = Math.max(...intensitiesInGroup);
          expect(result.distinguishedIntensities).toContain(maxIntensity);
        }
      });
    });

    it("should use memoization (cache) for repeated calls", () => {
      const params = {
        startTime: "08:00",
        endTime: "18:00",
        postCount: 3,
        staffCount: 12,
      };

      // First call
      const result1 = getDistinguishedIntensities(params);
      expect(getCacheStats().size).toBe(1);

      // Second call should use cache
      const result2 = getDistinguishedIntensities(params);
      expect(result1).toEqual(result2);
      expect(getCacheStats().size).toBe(1); // Still only 1 cached entry
    });

    it("should handle edge cases gracefully", () => {
      // Zero posts
      let result = getDistinguishedIntensities({
        startTime: "08:00",
        endTime: "18:00",
        postCount: 0,
        staffCount: 12,
      });
      expect(result.distinguishedIntensities).toEqual([1]);

      // Zero staff
      result = getDistinguishedIntensities({
        startTime: "08:00",
        endTime: "18:00",
        postCount: 3,
        staffCount: 0,
      });
      expect(result.distinguishedIntensities).toEqual([1]);

      // Invalid time range (overnight)
      result = getDistinguishedIntensities({
        startTime: "22:00",
        endTime: "06:00",
        postCount: 2,
        staffCount: 8,
      });
      expect(result.distinguishedIntensities).toEqual([1]);
    });

    it("should exclude intensities that exceed operation time", () => {
      const result = getDistinguishedIntensities({
        startTime: "08:00",
        endTime: "12:00", // 4 hours
        postCount: 2,
        staffCount: 6,
      });

      // Should not include intensities >= 4 hours
      result.distinguishedIntensities.forEach((intensity) => {
        expect(intensity).toBeLessThan(4);
      });
    });

    it("should return intensities corresponding to ascending durations", () => {
      const result = getDistinguishedIntensities({
        startTime: "08:00",
        endTime: "18:00",
        postCount: 3,
        staffCount: 12,
      });

      // Check that durations are in ascending order (each step makes shift shorter)
      const durations = result.distinguishedIntensities.map(
        (i) => result.intensityDurationMap[i]
      );
      const sortedDurations = [...durations].sort((a, b) => a - b);
      expect(durations).toEqual(sortedDurations);
    });

    it("should cache different parameter combinations separately", () => {
      const params1 = {
        startTime: "08:00",
        endTime: "18:00",
        postCount: 3,
        staffCount: 12,
      };
      const params2 = {
        startTime: "09:00",
        endTime: "17:00",
        postCount: 2,
        staffCount: 8,
      };

      getDistinguishedIntensities(params1);
      getDistinguishedIntensities(params2);

      expect(getCacheStats().size).toBe(2);
      expect(getCacheStats().keys).toContain("08:00-18:00-3-12");
      expect(getCacheStats().keys).toContain("09:00-17:00-2-8");
    });
  });

  describe("cache management", () => {
    it("should clear cache when requested", () => {
      getDistinguishedIntensities({
        startTime: "08:00",
        endTime: "18:00",
        postCount: 3,
        staffCount: 12,
      });

      expect(getCacheStats().size).toBe(1);
      clearCalculationCache();
      expect(getCacheStats().size).toBe(0);
    });

    it("should provide accurate cache stats", () => {
      const stats1 = getCacheStats();
      expect(stats1.size).toBe(0);
      expect(stats1.keys).toEqual([]);

      getDistinguishedIntensities({
        startTime: "08:00",
        endTime: "18:00",
        postCount: 3,
        staffCount: 12,
      });

      const stats2 = getCacheStats();
      expect(stats2.size).toBe(1);
      expect(stats2.keys.length).toBe(1);
    });
  });
});
