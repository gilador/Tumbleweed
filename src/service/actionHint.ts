import { computeLevels } from "./shiftLevels";

export type HintKey =
  | { key: "hintAddStaff" }
  | { key: "hintAddPosts" }
  | { key: "hintOptimized" }
  | { key: "hintNotOptimized" }
  | { key: "hintOverCapacity"; capacity: string; needed: string }
  | { key: "hintRunOptimizer" }
  | null;

export type HintVariant = "info" | "warning" | "success";

/**
 * Determine the action hint based on current state.
 * Uses the level-based feasibility model: staff × ceil(shifts/2) ≥ shifts × posts.
 */
export function getActionHint(params: {
  posts: number;
  staff: number;
  opHours: number;
  hasAssignments: boolean;
  isOptimized: boolean;
  selectedShiftCount: number | null;
  optimizationFailed?: boolean;
}): { hint: HintKey; variant: HintVariant } {
  const { posts, staff, opHours, hasAssignments, isOptimized, optimizationFailed } = params;

  // 1. Missing inputs
  if (staff === 0) {
    return { hint: { key: "hintAddStaff" }, variant: "info" };
  }
  if (posts === 0) {
    return { hint: { key: "hintAddPosts" }, variant: "info" };
  }

  // 2. Check feasibility via levels
  const levels = computeLevels(opHours, posts, staff);
  const feasibleLevels = levels.filter((l) => l.feasible);
  const hasFeasibleLevels = feasibleLevels.length > 0;

  // Check if the selected shift count is feasible
  const { selectedShiftCount } = params;
  const selectedLevel = selectedShiftCount !== null
    ? levels.find((l) => l.shifts === selectedShiftCount)
    : null;
  const isSelectedFeasible = selectedLevel ? selectedLevel.feasible : hasFeasibleLevels;

  // No feasible levels at all, or the selected level is infeasible
  if (!hasFeasibleLevels || !isSelectedFeasible) {
    const refLevel = selectedLevel || levels.find((l) => l.shifts === 1);
    return {
      hint: {
        key: "hintOverCapacity",
        capacity: (refLevel?.availableSlots ?? 0).toString(),
        needed: (refLevel?.neededSlots ?? posts).toString(),
      },
      variant: "warning",
    };
  }

  // 3. Optimizer ran and explicitly failed (infeasible due to real constraints)
  //    computeLevels may say feasible, but HiGHS with availability/rest constraints disagrees
  if (optimizationFailed) {
    const refLevel = selectedLevel || levels.find((l) => l.shifts === 1);
    return {
      hint: {
        key: "hintOverCapacity",
        capacity: (refLevel?.availableSlots ?? 0).toString(),
        needed: (refLevel?.neededSlots ?? posts).toString(),
      },
      variant: "warning",
    };
  }

  // 4. Optimizer ran successfully and assignments exist
  if (isOptimized && hasAssignments) {
    return { hint: { key: "hintOptimized" }, variant: "success" };
  }

  // 5. Manual assignments exist
  if (hasAssignments) {
    return { hint: { key: "hintNotOptimized" }, variant: "info" };
  }

  // 6. Ready to optimize
  return { hint: { key: "hintRunOptimizer" }, variant: "info" };
}
