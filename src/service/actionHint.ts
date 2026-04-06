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
}): { hint: HintKey; variant: HintVariant } {
  const { posts, staff, opHours, hasAssignments, isOptimized } = params;

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

  // selectedShiftCount is informational only — we check hasFeasibleLevels for the hint

  // No feasible levels at all — truly impossible configuration
  if (!hasFeasibleLevels) {
    const level1 = levels.find((l) => l.shifts === 1);
    return {
      hint: {
        key: "hintOverCapacity",
        capacity: (level1?.availableSlots ?? 0).toString(),
        needed: (level1?.neededSlots ?? posts).toString(),
      },
      variant: "warning",
    };
  }

  // 3. Optimizer ran successfully and assignments exist
  if (isOptimized && hasAssignments) {
    return { hint: { key: "hintOptimized" }, variant: "success" };
  }

  // 4. Manual assignments exist
  if (hasAssignments) {
    return { hint: { key: "hintNotOptimized" }, variant: "info" };
  }

  // 5. Ready to optimize
  return { hint: { key: "hintRunOptimizer" }, variant: "info" };
}
