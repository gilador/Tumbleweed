/**
 * Unit tests for Shift Hour Helper Service
 * Following core-development: Public interface first, implementation details last
 */

import {
  calculateMinimumShifts,
  getShiftTimes,
  isShiftConfigurationFeasible,
  getMinimumStaffNeeded,
  getOptimalShiftDuration,
  type ShiftCalculationInput,
} from "./shiftHourHelperService";

describe("Shift Hour Helper Service", () => {
  // ==================== PRIMARY PUBLIC INTERFACE ====================

  describe("calculateMinimumShifts - Core Business Logic", () => {
    it("can calculate 2 shifts for 16-hour operation with 10 staff and 3 posts", () => {
      const input: ShiftCalculationInput = {
        startTime: "07:00",
        endTime: "23:00",
        postCount: 3,
        staffCount: 10,
        minimumTotalRestTime: 4,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(true);
      expect(result.minimumShiftsNeeded).toBe(2);
      expect(result.shiftDuration).toBe(8);
      expect(result.shiftStartTimes).toEqual(["07:00", "15:00"]);
    });

    it("can handle dual shift when rest time constrains single shift", () => {
      const input: ShiftCalculationInput = {
        startTime: "09:00",
        endTime: "17:00",
        postCount: 1,
        staffCount: 5,
        minimumTotalRestTime: 2,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(true);
      expect(result.minimumShiftsNeeded).toBe(2);
      expect(result.shiftDuration).toBe(4);
      expect(result.shiftStartTimes).toEqual(["09:00", "13:00"]);
    });

    it("can calculate 3 shifts with higher rest requirements", () => {
      const input: ShiftCalculationInput = {
        startTime: "07:00",
        endTime: "23:00",
        postCount: 3,
        staffCount: 10,
        minimumTotalRestTime: 10,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(true);
      expect(result.minimumShiftsNeeded).toBe(3);
      expect(result.shiftDuration).toBeCloseTo(5.33, 2);
      expect(result.shiftStartTimes).toEqual(["07:00", "12:20", "17:40"]);
    });

    it("handles default rest time when not specified", () => {
      const input: ShiftCalculationInput = {
        startTime: "08:00",
        endTime: "16:00",
        postCount: 2,
        staffCount: 4,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(true);
      expect(result.minimumShiftsNeeded).toBe(1);
      expect(result.shiftStartTimes).toEqual(["08:00"]);
    });

    it("rejects configuration when staff count is less than post count", () => {
      const input: ShiftCalculationInput = {
        startTime: "07:00",
        endTime: "23:00",
        postCount: 5,
        staffCount: 3,
        minimumTotalRestTime: 0,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(false);
      expect(result.minimumShiftsNeeded).toBe(0);
      expect(result.shiftStartTimes).toEqual([]);
      expect(result.message).toContain(
        "Need at least 5 staff for 5 posts, but only have 3"
      );
    });

    it("rejects configuration when rest time exceeds operation time", () => {
      const input: ShiftCalculationInput = {
        startTime: "07:00",
        endTime: "23:00",
        postCount: 1,
        staffCount: 5,
        minimumTotalRestTime: 20,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(false);
      expect(result.message).toBe("Minimum rest time exceeds operation time");
    });

    it("rejects configuration when total work capacity is insufficient", () => {
      const input: ShiftCalculationInput = {
        startTime: "07:00",
        endTime: "23:00",
        postCount: 10,
        staffCount: 2,
        minimumTotalRestTime: 2,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(false);
      expect(result.message).toContain(
        "Need at least 10 staff for 10 posts, but only have 2"
      );
    });

    it("identifies infeasible scenarios with high rest requirements", () => {
      const input: ShiftCalculationInput = {
        startTime: "06:00",
        endTime: "18:00",
        postCount: 4,
        staffCount: 6,
        minimumTotalRestTime: 6,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(false);
      expect(result.minimumShiftsNeeded).toBe(0);
      expect(result.shiftStartTimes).toEqual([]);
      expect(result.message).toContain(
        "Need 48 work-hours but only have 36 available"
      );
    });

    it("handles invalid time format gracefully", () => {
      const input: ShiftCalculationInput = {
        startTime: "25:00",
        endTime: "23:00",
        postCount: 1,
        staffCount: 2,
        minimumTotalRestTime: 0,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(false);
      expect(result.message).toContain("Invalid time format");
    });

    it("handles end time before start time", () => {
      const input: ShiftCalculationInput = {
        startTime: "23:00",
        endTime: "07:00",
        postCount: 1,
        staffCount: 2,
        minimumTotalRestTime: 0,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(false);
      expect(result.message).toBe("End time must be after start time");
    });

    it("handles invalid hour boundaries", () => {
      const input: ShiftCalculationInput = {
        startTime: "00:00",
        endTime: "24:00",
        postCount: 1,
        staffCount: 2,
        minimumTotalRestTime: 0,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(false);
      expect(result.message).toContain("Invalid time format");
    });

    it("processes 30-minute time increments correctly", () => {
      const input: ShiftCalculationInput = {
        startTime: "07:30",
        endTime: "15:30",
        postCount: 1,
        staffCount: 2,
        minimumTotalRestTime: 2,
      };

      const result = calculateMinimumShifts(input);

      expect(result.isFeasible).toBe(true);
      expect(result.shiftStartTimes).toEqual(["07:30", "11:30"]);
    });

    it("handles minimal operation time of 1 hour", () => {
      const result = calculateMinimumShifts({
        startTime: "09:00",
        endTime: "10:00",
        postCount: 1,
        staffCount: 2,
        minimumTotalRestTime: 0,
      });

      expect(result.isFeasible).toBe(true);
      expect(result.minimumShiftsNeeded).toBe(1);
      expect(result.shiftDuration).toBe(1);
    });

    it("handles exact staff-to-post ratio with zero rest", () => {
      const result = calculateMinimumShifts({
        startTime: "08:00",
        endTime: "16:00",
        postCount: 3,
        staffCount: 3,
        minimumTotalRestTime: 0,
      });

      expect(result.isFeasible).toBe(true);
      expect(result.minimumShiftsNeeded).toBe(1);
    });

    it("generates valid time formats for fractional durations", () => {
      const result = calculateMinimumShifts({
        startTime: "07:00",
        endTime: "22:00",
        postCount: 2,
        staffCount: 6,
        minimumTotalRestTime: 3,
      });

      expect(result.isFeasible).toBe(true);
      expect(result.shiftStartTimes.length).toBe(result.minimumShiftsNeeded);

      // Verify all times are valid HH:MM format
      result.shiftStartTimes.forEach((time) => {
        expect(time).toMatch(/^[0-2][0-9]:[0-5][0-9]$/);
      });
    });

    it("processes minute precision accurately", () => {
      const result = calculateMinimumShifts({
        startTime: "09:15",
        endTime: "17:45",
        postCount: 1,
        staffCount: 2,
        minimumTotalRestTime: 1,
      });

      expect(result.isFeasible).toBe(true);
      expect(result.shiftStartTimes[0]).toBe("09:15");
      expect(result.shiftDuration).toBeCloseTo(4.25, 1); // 8.5 hours / 2 shifts = 4.25
    });
  });

  // ==================== HELPER FUNCTIONS (SECONDARY INTERFACE) ====================

  describe("getShiftTimes - Quick Time Retrieval", () => {
    it("returns shift times array for feasible configuration", () => {
      const result = getShiftTimes("07:00", "23:00", 3, 10, 4);

      expect(result).toEqual(["07:00", "15:00"]);
    });

    it("returns empty array for infeasible configuration", () => {
      const result = getShiftTimes("07:00", "23:00", 10, 2, 0);

      expect(result).toEqual([]);
    });

    it("uses default rest time when not provided", () => {
      const result = getShiftTimes("08:00", "16:00", 2, 4);

      expect(result).toEqual(["08:00"]);
    });
  });

  describe("isShiftConfigurationFeasible - Quick Feasibility Check", () => {
    it("confirms feasible configurations", () => {
      const result = isShiftConfigurationFeasible("07:00", "23:00", 3, 10, 4);

      expect(result).toBe(true);
    });

    it("identifies insufficient staff scenarios", () => {
      const result = isShiftConfigurationFeasible("07:00", "23:00", 5, 3, 0);

      expect(result).toBe(false);
    });

    it("identifies excessive rest time scenarios", () => {
      const result = isShiftConfigurationFeasible("07:00", "23:00", 1, 5, 20);

      expect(result).toBe(false);
    });

    it("identifies insufficient work capacity scenarios", () => {
      const result = isShiftConfigurationFeasible("07:00", "23:00", 10, 2, 2);

      expect(result).toBe(false);
    });

    it("handles invalid inputs gracefully", () => {
      const result = isShiftConfigurationFeasible("25:00", "23:00", 1, 2, 0);

      expect(result).toBe(false);
    });
  });

  describe("getMinimumStaffNeeded - Staff Requirement Calculation", () => {
    it("calculates minimum staff based on work capacity", () => {
      const result = getMinimumStaffNeeded("07:00", "23:00", 3, 4);

      expect(result).toBe(4); // max(3 posts, ceil(48/12)) = 4
    });

    it("calculates staff needs considering both posts and work capacity", () => {
      const result = getMinimumStaffNeeded("08:00", "16:00", 5, 2);

      expect(result).toBe(7); // max(5 posts, ceil(40/6)) = max(5, 7) = 7
    });

    it("returns infinity for impossible scenarios", () => {
      const result = getMinimumStaffNeeded("07:00", "23:00", 1, 20);

      expect(result).toBe(Infinity);
    });

    it("handles invalid inputs gracefully", () => {
      const result = getMinimumStaffNeeded("25:00", "23:00", 1, 0);

      expect(result).toBe(Infinity);
    });

    it("works with zero rest time", () => {
      const result = getMinimumStaffNeeded("09:00", "17:00", 2, 0);

      expect(result).toBe(2);
    });
  });

  describe("getOptimalShiftDuration - Duration Calculation", () => {
    it("returns correct duration for feasible configurations", () => {
      const result = getOptimalShiftDuration("07:00", "23:00", 3, 10, 4);

      expect(result).toBe(8); // 16 hours / 2 shifts = 8 hours
    });

    it("returns zero for infeasible configurations", () => {
      const result = getOptimalShiftDuration("07:00", "23:00", 10, 2, 0);

      expect(result).toBe(0);
    });

    it("calculates optimal shift duration with rest constraints", () => {
      const result = getOptimalShiftDuration("08:00", "16:00", 1, 5, 2);

      expect(result).toBe(4); // 8 hours / 2 shifts = 4 hours per shift
    });

    it("returns zero for infeasible multiple shift scenarios", () => {
      const result = getOptimalShiftDuration("06:00", "18:00", 4, 6, 6);

      expect(result).toBe(0); // Infeasible due to insufficient work capacity
    });
  });

  // ==================== INTEGRATION TESTING ====================

  describe("Cross-Function Consistency", () => {
    it("maintains consistency across all helper functions", () => {
      const params = ["06:00", "20:00", 3, 8, 4] as const;

      const fullResult = calculateMinimumShifts({
        startTime: params[0],
        endTime: params[1],
        postCount: params[2],
        staffCount: params[3],
        minimumTotalRestTime: params[4],
      });

      const feasible = isShiftConfigurationFeasible(...params);
      const shiftTimes = getShiftTimes(...params);
      const duration = getOptimalShiftDuration(...params);

      expect(feasible).toBe(fullResult.isFeasible);
      expect(shiftTimes).toEqual(fullResult.shiftStartTimes);
      expect(duration).toBe(fullResult.shiftDuration);
    });
  });

  // ==================== IMPLEMENTATION DETAILS (INTERNAL) ====================

  describe("Performance and Technical Boundaries", () => {
    it("calculates large operation times efficiently", () => {
      const startTime = Date.now();

      const result = calculateMinimumShifts({
        startTime: "00:00",
        endTime: "23:59",
        postCount: 5,
        staffCount: 20,
        minimumTotalRestTime: 8,
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.isFeasible).toBe(true);
      expect(executionTime).toBeLessThan(100); // Should complete quickly
    });

    it("handles maximum valid hours correctly", () => {
      const result = calculateMinimumShifts({
        startTime: "00:00",
        endTime: "23:59",
        postCount: 1,
        staffCount: 2,
        minimumTotalRestTime: 0,
      });

      expect(result.isFeasible).toBe(true);
      expect(result.shiftStartTimes[0]).toBe("00:00");
    });
  });
});
