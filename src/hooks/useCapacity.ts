import { useLevels } from "./useLevels";

export interface CapacityInfo {
  capacity: number;
  needed: number;
  isOverCapacity: boolean;
  staff: number;
  posts: number;
  opHours: number;
}

export function useCapacity(): CapacityInfo {
  const { selectedLevel, opHours, staff, posts } = useLevels();

  const capacity = selectedLevel?.availableSlots ?? 0;
  const needed = selectedLevel?.neededSlots ?? 0;
  const isOverCapacity = needed > 0 && needed > capacity;

  return {
    capacity,
    needed,
    isOverCapacity,
    staff,
    posts,
    opHours,
  };
}
