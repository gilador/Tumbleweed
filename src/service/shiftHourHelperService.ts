/**
 * Shift Hour Helper Service - Minimum shift calculation
 * Provides modular, stateless functions for shift scheduling calculations
 */

// ==================== PUBLIC TYPES ====================

export interface ShiftCalculationInput {
  startTime: string;
  endTime: string;
  postCount: number;
  staffCount: number;
  minimumTotalRestTime?: number;
}

export interface ShiftCalculationResult {
  shiftStartTimes: string[];
  minimumShiftsNeeded: number;
  shiftDuration: number;
  isFeasible: boolean;
  message?: string;
}

export interface FeasibilityResult {
  isFeasible: boolean;
  message?: string;
}

// ==================== PUBLIC MAIN FUNCTIONS ====================

/**
 * Calculates minimum shifts needed using iterative approach
 */
export function calculateMinimumShifts(
  input: ShiftCalculationInput
): ShiftCalculationResult {
  try {
    const operationTime = calculateOperationTime(
      input.startTime,
      input.endTime
    );
    const minimumTotalRestTime = input.minimumTotalRestTime || 0;

    // Run all feasibility checks
    const basicCheck = validateBasicFeasibility(
      input.staffCount,
      input.postCount
    );
    if (!basicCheck.isFeasible) {
      return {
        shiftStartTimes: [],
        minimumShiftsNeeded: 0,
        shiftDuration: 0,
        isFeasible: false,
        message: basicCheck.message,
      };
    }

    // Special case: if no posts, return 0 duration
    if (input.postCount === 0) {
      return {
        shiftStartTimes: [],
        minimumShiftsNeeded: 0,
        shiftDuration: 0,
        isFeasible: false,
        message: "No posts to assign - duration is 0",
      };
    }

    const restCheck = validateRestFeasibility(
      operationTime,
      minimumTotalRestTime
    );
    if (!restCheck.isFeasible) {
      return {
        shiftStartTimes: [],
        minimumShiftsNeeded: 0,
        shiftDuration: 0,
        isFeasible: false,
        message: restCheck.message,
      };
    }

    const capacityCheck = validateWorkCapacity(
      input.staffCount,
      operationTime,
      input.postCount,
      minimumTotalRestTime
    );
    if (!capacityCheck.isFeasible) {
      return {
        shiftStartTimes: [],
        minimumShiftsNeeded: 0,
        shiftDuration: 0,
        isFeasible: false,
        message: capacityCheck.message,
      };
    }

    // Find minimum shifts needed
    const shiftSolution = findMinimumShifts(
      operationTime,
      input.staffCount,
      input.postCount,
      minimumTotalRestTime
    );

    if (shiftSolution.shifts === 0) {
      return {
        shiftStartTimes: [],
        minimumShiftsNeeded: 0,
        shiftDuration: 0,
        isFeasible: false,
        message: "Could not find feasible shift configuration",
      };
    }

    // Generate shift times using the actual duration from the solution
    const minimumShiftsNeeded = shiftSolution.shifts;
    const shiftDuration = shiftSolution.duration;
    const shiftStartTimes = generateShiftTimes(
      input.startTime,
      minimumShiftsNeeded,
      shiftDuration
    );

    return {
      shiftStartTimes,
      minimumShiftsNeeded,
      shiftDuration,
      isFeasible: true,
      message: `${minimumShiftsNeeded} shifts needed with ${shiftDuration.toFixed(
        1
      )}h duration each`,
    };
  } catch (error) {
    return {
      shiftStartTimes: [],
      minimumShiftsNeeded: 0,
      shiftDuration: 0,
      isFeasible: false,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// ==================== PUBLIC HELPER FUNCTIONS ====================

/**
 * Simple stateless helper that returns just the shift start times
 */
export function getShiftTimes(
  startTime: string,
  endTime: string,
  postCount: number,
  staffCount: number,
  minimumTotalRestTime: number = 0
): string[] {
  const result = calculateMinimumShifts({
    startTime,
    endTime,
    postCount,
    staffCount,
    minimumTotalRestTime,
  });
  return result.isFeasible ? result.shiftStartTimes : [];
}

/**
 * Stateless helper to check if a shift configuration is feasible
 */
export function isShiftConfigurationFeasible(
  startTime: string,
  endTime: string,
  postCount: number,
  staffCount: number,
  minimumTotalRestTime: number = 0
): boolean {
  try {
    const operationTime = calculateOperationTime(startTime, endTime);

    const basicCheck = validateBasicFeasibility(staffCount, postCount);
    if (!basicCheck.isFeasible) return false;

    const restCheck = validateRestFeasibility(
      operationTime,
      minimumTotalRestTime
    );
    if (!restCheck.isFeasible) return false;

    const capacityCheck = validateWorkCapacity(
      staffCount,
      operationTime,
      postCount,
      minimumTotalRestTime
    );
    if (!capacityCheck.isFeasible) return false;

    const minimumShifts = findMinimumShifts(
      operationTime,
      staffCount,
      postCount,
      minimumTotalRestTime
    );
    return minimumShifts.shifts > 0;
  } catch {
    return false;
  }
}

/**
 * Stateless helper to get minimum staff needed for a configuration
 */
export function getMinimumStaffNeeded(
  startTime: string,
  endTime: string,
  postCount: number,
  minimumTotalRestTime: number = 0
): number {
  try {
    const operationTime = calculateOperationTime(startTime, endTime);
    const maxWorkTimePerPerson = operationTime - minimumTotalRestTime;

    if (maxWorkTimePerPerson <= 0) return Infinity;

    const totalWorkNeeded = operationTime * postCount;
    return Math.max(
      postCount,
      Math.ceil(totalWorkNeeded / maxWorkTimePerPerson)
    );
  } catch {
    return Infinity;
  }
}

/**
 * Stateless helper to get shift duration for minimum shifts
 */
export function getOptimalShiftDuration(
  startTime: string,
  endTime: string,
  postCount: number,
  staffCount: number,
  minimumTotalRestTime: number = 0
): number {
  console.log(
    "🔧 [shiftHourHelperService] getOptimalShiftDuration called with:",
    {
      startTime,
      endTime,
      postCount,
      staffCount,
      minimumTotalRestTime,
    }
  );

  const result = calculateMinimumShifts({
    startTime,
    endTime,
    postCount,
    staffCount,
    minimumTotalRestTime,
  });

  console.log("📋 [shiftHourHelperService] calculateMinimumShifts result:", {
    isFeasible: result.isFeasible,
    shiftDuration: result.shiftDuration,
    minimumShiftsNeeded: result.minimumShiftsNeeded,
    message: result.message,
  });

  const finalDuration = result.isFeasible ? result.shiftDuration : 0;
  console.log("📤 [shiftHourHelperService] Returning duration:", finalDuration);

  return finalDuration;
}

// ==================== PRIVATE IMPLEMENTATION ====================

// Time utilities
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(
      `Invalid time format: ${timeStr}. Expected format: "HH:MM"`
    );
  }
  return hours + minutes / 60;
}

function formatTime(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${wholeHours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

function calculateOperationTime(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (end <= start) {
    throw new Error("End time must be after start time");
  }
  return end - start;
}

// Validation functions
function validateBasicFeasibility(
  staffCount: number,
  postCount: number
): FeasibilityResult {
  if (staffCount < postCount) {
    return {
      isFeasible: false,
      message: `Need at least ${postCount} staff for ${postCount} posts, but only have ${staffCount}`,
    };
  }
  return { isFeasible: true };
}

function validateRestFeasibility(
  operationTime: number,
  minimumTotalRestTime: number
): FeasibilityResult {
  const maxWorkTimePerPerson = operationTime - minimumTotalRestTime;
  if (maxWorkTimePerPerson <= 0) {
    return {
      isFeasible: false,
      message: "Minimum rest time exceeds operation time",
    };
  }
  return { isFeasible: true };
}

function validateWorkCapacity(
  staffCount: number,
  operationTime: number,
  postCount: number,
  minimumTotalRestTime: number
): FeasibilityResult {
  console.log("🔍 [validateWorkCapacity] Input:", {
    staffCount,
    operationTime,
    postCount,
    minimumTotalRestTime,
  });

  // The logic here was wrong! minimumTotalRestTime is the minimum rest time per worker,
  // not the total rest across all workers. Each worker should be able to work most of
  // the operation time, with some reasonable breaks.

  // A more reasonable approach: assume workers can work up to (operationTime - minimumRestPerWorker)
  // where minimumRestPerWorker is a reasonable fraction of minimumTotalRestTime
  const reasonableRestPerWorker = Math.min(
    minimumTotalRestTime,
    operationTime * 0.8
  ); // Cap at 80% of operation time
  const maxWorkTimePerPerson = operationTime - reasonableRestPerWorker;
  const totalWorkCapacity = staffCount * maxWorkTimePerPerson;
  const totalWorkNeeded = operationTime * postCount;

  console.log("📊 [validateWorkCapacity] Calculations:", {
    reasonableRestPerWorker,
    maxWorkTimePerPerson,
    totalWorkCapacity,
    totalWorkNeeded,
    isFeasible: totalWorkCapacity >= totalWorkNeeded,
  });

  if (totalWorkCapacity < totalWorkNeeded) {
    const message = `Need ${totalWorkNeeded} work-hours but only have ${totalWorkCapacity} available (${maxWorkTimePerPerson}h per person * ${staffCount} staff)`;
    console.warn("❌ [validateWorkCapacity] Failed:", message);
    return {
      isFeasible: false,
      message,
    };
  }

  console.log("✅ [validateWorkCapacity] Passed");
  return { isFeasible: true };
}

// Core calculation functions
function findMinimumShifts(
  operationTime: number,
  staffCount: number,
  postCount: number,
  minimumTotalRestTime: number
): { shifts: number; duration: number } {
  console.log("findMinimumShifts: Input:", {
    operationTime,
    staffCount,
    postCount,
    minimumTotalRestTime,
  });

  // Apply the same reasonable rest logic here
  const reasonableRestPerWorker = Math.min(
    minimumTotalRestTime,
    operationTime * 0.8
  );
  const maxWorkTimePerPerson = operationTime - reasonableRestPerWorker;

  console.log("findMinimumShifts: Work capacity:", {
    reasonableRestPerWorker,
    maxWorkTimePerPerson,
  });

  // Define allowed shift durations (in hours): multiples of 0.25 up to operation time
  const allowedDurations: number[] = [];
  const baseIncrement = 0.25;

  // Generate allowed durations: 0.25, 0.5, 0.75, 1, 1.25, 1.5, ..., up to operation time
  for (
    let duration = baseIncrement;
    duration <= operationTime;
    duration += baseIncrement
  ) {
    // Round to avoid floating point precision issues
    const roundedDuration = Math.round(duration * 4) / 4;
    allowedDurations.push(roundedDuration);
  }

  console.log(
    `findMinimumShifts: Allowed durations for ${operationTime}h operation:`,
    allowedDurations
  );

  // Find the best duration that divides the operation time evenly or with minimal remainder
  let bestSolution: { shifts: number; duration: number; score: number } | null =
    null;

  for (const shiftDuration of allowedDurations) {
    // Calculate how many shifts we need for this duration
    const exactShifts = operationTime / shiftDuration;
    const shiftsNeeded = Math.ceil(exactShifts);

    // Check if this configuration is feasible
    const maxShiftsPerPerson = Math.floor(maxWorkTimePerPerson / shiftDuration);
    const availableAssignments = staffCount * maxShiftsPerPerson;
    const requiredAssignments = shiftsNeeded * postCount;

    console.log(`findMinimumShifts: Try duration=${shiftDuration}h:`, {
      shiftsNeeded,
      exactShifts,
      shiftDuration,
      maxShiftsPerPerson,
      availableAssignments,
      requiredAssignments,
      feasible: availableAssignments >= requiredAssignments,
    });

    if (availableAssignments >= requiredAssignments) {
      // Calculate a score that prioritizes:
      // 1. Exact division (no remainder)
      // 2. Fewer shifts
      // 3. Longer durations (more efficient)
      const remainder = exactShifts - Math.floor(exactShifts);
      const isExactDivision = remainder < 0.001; // Account for floating point precision

      // Score: exact divisions get priority, then fewer shifts, then longer durations
      let score = 0;
      if (isExactDivision) {
        score += 1000; // High priority for exact divisions
      }
      score += 100 - shiftsNeeded; // Prefer fewer shifts
      score += shiftDuration; // Prefer longer durations as tiebreaker

      console.log(
        `findMinimumShifts: Duration ${shiftDuration}h score: ${score} (exact: ${isExactDivision}, remainder: ${remainder.toFixed(
          3
        )})`
      );

      if (!bestSolution || score > bestSolution.score) {
        bestSolution = { shifts: shiftsNeeded, duration: shiftDuration, score };
        console.log(
          `findMinimumShifts: New best solution: ${shiftsNeeded} shifts of ${shiftDuration}h (score: ${score})`
        );
      }
    }
  }

  if (bestSolution) {
    console.log(
      `findMinimumShifts: Final solution: ${bestSolution.shifts} shifts of ${bestSolution.duration}h`
    );
    return { shifts: bestSolution.shifts, duration: bestSolution.duration };
  }

  console.warn("findMinimumShifts: No solution found with allowed durations");
  return { shifts: 0, duration: 0 };
}

function generateShiftTimes(
  startTime: string,
  shiftsCount: number,
  shiftDuration: number
): string[] {
  const shiftStartTimes: string[] = [];
  const startHour = parseTime(startTime);

  for (let i = 0; i < shiftsCount; i++) {
    const shiftTime = startHour + i * shiftDuration;
    shiftStartTimes.push(formatTime(shiftTime));
  }

  return shiftStartTimes;
}
