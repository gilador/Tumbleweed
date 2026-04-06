import { useMemo, useCallback, useEffect } from "react";
import { useRecoilState } from "recoil";
import { shiftState, getActiveRosterFromState, updateActiveRoster } from "../stores/shiftStore";
import { computeLevels, ShiftLevel } from "../service/shiftLevels";
import { generateDynamicHours } from "../service/shiftManagerUtils";

/**
 * Determines whether the auto-apply effect should regenerate hours and clear assignments.
 * Exported for testing.
 */
/**
 * Determines whether the auto-apply effect should regenerate hours and clear assignments.
 * Exported for testing.
 */
export function shouldAutoApplyLevel(
  selectedLevel: ShiftLevel | null,
  posts: number,
  staff: number,
  currentHourCount: number,
  optimizationSignature: string | null,
  scheduleMode: string
): boolean {
  if (!selectedLevel || posts === 0 || staff === 0) return false;
  // In 7D mode, hours are managed by useScheduleMode (7x single-day hours).
  // useLevels only generates single-day hours, so skip to avoid overwriting.
  if (scheduleMode === "7d") return false;
  if (currentHourCount === selectedLevel.shifts) return false;
  if (optimizationSignature) return false;
  return true;
}

export interface UseLevelsResult {
  /** All computed levels (feasible and infeasible) */
  levels: ShiftLevel[];
  /** The currently selected level (or null if none selected / none feasible) */
  selectedLevel: ShiftLevel | null;
  /** Select a level by shift count and apply to roster hours */
  setLevel: (shiftCount: number) => void;
  /** Operation hours */
  opHours: number;
  /** Number of staff */
  staff: number;
  /** Number of posts */
  posts: number;
}

export function useLevels(): UseLevelsResult {
  const [recoilStateValue, setRecoilState] = useRecoilState(shiftState);
  const activeRoster = getActiveRosterFromState(recoilStateValue);

  const staff = recoilStateValue.userShiftData?.length || 0;
  const posts = activeRoster.posts?.length || 0;
  const startTime = activeRoster.startTime || "08:00";
  const endTime = activeRoster.endTime || "18:00";

  const [sh] = startTime.split(":").map(Number);
  const [eh] = endTime.split(":").map(Number);
  let opHours = eh - sh;
  if (opHours <= 0) opHours += 24;

  const levels = useMemo(
    () => computeLevels(opHours, posts, staff),
    [opHours, posts, staff]
  );

  const selectedShiftCount = recoilStateValue.selectedShiftCount;

  const selectedLevel = useMemo(() => {
    if (levels.length === 0) return null;

    // If user has a selection, find the matching level
    if (selectedShiftCount !== null && selectedShiftCount !== undefined) {
      const match = levels.find((l) => l.shifts === selectedShiftCount && l.feasible);
      if (match) return match;
    }

    // Auto-select: pick the middle feasible level
    const feasible = levels.filter((l) => l.feasible);
    if (feasible.length === 0) return null;
    return feasible[Math.floor(feasible.length / 2)];
  }, [levels, selectedShiftCount]);

  // Auto-apply: when the selected level's shift count doesn't match the roster hours count,
  // regenerate the hours to match. This handles cases like:
  // - Fresh state (no selectedShiftCount yet)
  // - Posts/staff changed making the old shift count infeasible
  // - Old restTime-based state being migrated
  useEffect(() => {
    const currentHourCount = activeRoster.hours?.length || 0;
    const scheduleMode = activeRoster.scheduleMode || "24h";
    if (!shouldAutoApplyLevel(selectedLevel, posts, staff, currentHourCount, recoilStateValue.optimizationSignature ?? null, scheduleMode)) return;

    const newHours = generateDynamicHours(startTime, endTime, posts, staff, selectedLevel!.shifts);

    setRecoilState((prev) => {
      const roster = getActiveRosterFromState(prev);
      const activeRosterId = prev.activeRosterId;

      const updatedUserShiftData = (prev.userShiftData || []).map((userData) => {
        const updatedConstraints = (roster.posts || []).map((post) => {
          return newHours.map((hour, hourIndex) => {
            const existingConstraint = userData.constraints?.[roster.posts?.indexOf(post) || 0]?.[hourIndex];
            return existingConstraint || { postID: post.id, hourID: hour.id, availability: true };
          });
        });
        return {
          ...userData,
          constraints: updatedConstraints,
          constraintsByRoster: { ...userData.constraintsByRoster, [activeRosterId]: updatedConstraints },
        };
      });

      const clearedAssignments = (roster.posts || []).map(() => newHours.map(() => null));

      return {
        ...updateActiveRoster(prev, (r) => ({
          ...r,
          hours: newHours,
          assignments: clearedAssignments,
        })),
        selectedShiftCount: selectedLevel!.shifts,
        userShiftData: updatedUserShiftData,
        optimizationSignature: null,
      };
    });
  }, [selectedLevel?.shifts, posts, staff, startTime, endTime, recoilStateValue.optimizationSignature]);

  const setLevel = useCallback(
    (shiftCount: number) => {
      setRecoilState((prev) => ({
        ...prev,
        selectedShiftCount: shiftCount,
      }));
    },
    [setRecoilState]
  );

  return {
    levels,
    selectedLevel,
    setLevel,
    opHours,
    staff,
    posts,
  };
}
