export interface ShiftLevel {
  /** Number of shifts in the day */
  shifts: number;
  /** Duration of each shift in hours */
  duration: number;
  /** Whether this level is feasible with the current staff/posts */
  feasible: boolean;
  /** Total slots needed: shifts × posts */
  neededSlots: number;
  /** Total slots available: staff × maxPerWorker */
  availableSlots: number;
  /** How many shifts a typical worker does */
  shiftsPerWorker: number;
  /** Total work hours per worker */
  workHours: number;
  /** Minimum rest between shifts (= duration, from LP no-consecutive constraint) */
  restBetween: number;
  /** Additional staff needed to make this level feasible (undefined if feasible) */
  staffGap?: number;
  /** Posts to remove to make this level feasible (undefined if feasible) */
  postGap?: number;
}

/**
 * Compute all feasible and infeasible shift levels for a given configuration.
 *
 * Each level represents a distinct shift count with a clean duration
 * (divisible into 15-minute increments). Feasibility is based on the
 * LP optimizer's no-consecutive-slots constraint:
 *   staff × ceil(shifts / 2) ≥ shifts × posts
 *
 * @param opHours - Operation hours (e.g., 10 for 08:00-18:00)
 * @param posts - Number of posts to fill
 * @param staff - Number of available workers
 * @param minShiftDuration - Minimum shift duration in hours (default 0.5)
 * @returns Array of ShiftLevel sorted by shift count ascending
 */
export function computeLevels(
  opHours: number,
  posts: number,
  staff: number,
  minShiftDuration: number = 0.5
): ShiftLevel[] {
  if (opHours <= 0 || posts <= 0 || staff <= 0) {
    return [];
  }

  const maxShifts = Math.floor(opHours / minShiftDuration);
  const levels: ShiftLevel[] = [];

  for (let shiftCount = 1; shiftCount <= maxShifts; shiftCount++) {
    const duration = opHours / shiftCount;

    if (duration < minShiftDuration) break;

    // Only keep clean divisions: duration must be a multiple of 15 minutes (0.25h)
    if ((opHours * 4) % shiftCount !== 0) continue;

    const neededSlots = shiftCount * posts;
    // LP no-consecutive constraint: a worker can do at most ceil(shifts/2) shifts
    const maxPerWorker = Math.ceil(shiftCount / 2);
    const availableSlots = staff * maxPerWorker;
    const feasible = availableSlots >= neededSlots;

    const shiftsPerWorker = feasible
      ? Math.ceil(neededSlots / staff)
      : 0;
    const workHours = shiftsPerWorker * duration;
    // Rest = one slot gap (guaranteed by LP no-consecutive constraint)
    // For 1 shift, no rest needed
    const restBetween = shiftCount === 1 ? 0 : duration;

    const level: ShiftLevel = {
      shifts: shiftCount,
      duration,
      feasible,
      neededSlots,
      availableSlots,
      shiftsPerWorker,
      workHours,
      restBetween,
    };

    if (!feasible) {
      level.staffGap = Math.ceil(neededSlots / maxPerWorker) - staff;
      level.postGap = posts - Math.floor(availableSlots / shiftCount);
    }

    levels.push(level);
  }

  return levels;
}
