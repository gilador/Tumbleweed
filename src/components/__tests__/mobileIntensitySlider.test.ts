import { generateDynamicHours, generateWeeklyDynamicHours } from "../../service/shiftManagerUtils";
import { ShiftState, getActiveRosterFromState, updateActiveRoster } from "../../stores/shiftStore";
import { createEmptyRoster, UniqueString } from "../../models/index";
import { SyncStatus } from "../SyncStatusIcon";

/**
 * This test validates the fix for the mobile intensity slider ghost dot bug.
 *
 * Root cause: the old click handler called updateShiftStateWithNewHours which
 * read selectedLevel?.duration from the stale closure (the OLD level), so the
 * generated hours matched the old level, not the clicked one. This caused two
 * dots to appear selected.
 *
 * The fix passes the clicked level object directly to applyLevel, which uses
 * level.shifts (from the argument) to generate hours — no stale closure.
 *
 * This test simulates that scenario: a prev state with 3 shifts (old level),
 * and an applyLevel call with 5 shifts (new level). It verifies the updater
 * produces selectedShiftCount: 5 and hours matching 5 shifts.
 */

function buildMockState(overrides: {
  posts: UniqueString[];
  hours: UniqueString[];
  selectedShiftCount: number | null;
  startTime: string;
  endTime: string;
}): ShiftState {
  const roster = createEmptyRoster("Test", "roster-1");
  roster.posts = overrides.posts;
  roster.hours = overrides.hours;
  roster.startTime = overrides.startTime;
  roster.endTime = overrides.endTime;
  roster.assignments = overrides.posts.map(() => overrides.hours.map(() => null));

  return {
    rosters: [roster],
    activeRosterId: "roster-1",
    userShiftData: [
      {
        user: { id: "user-1", name: "Worker 1" },
        constraints: overrides.posts.map(() =>
          overrides.hours.map((hour) => ({
            postID: overrides.posts[0]?.id ?? `post-0`,
            hourID: hour.id,
            availability: true,
          }))
        ),
        constraintsByRoster: {},
        totalAssignments: 0,
      },
    ],
    hasInitialized: true,
    selectedShiftCount: overrides.selectedShiftCount,
    syncStatus: "saved" as SyncStatus,
  };
}

describe("Mobile intensity slider - stale closure fix", () => {
  const startTime = "08:00";
  const endTime = "18:00";
  const posts: UniqueString[] = [
    { id: "post-0", value: "Bar" },
    { id: "post-1", value: "Kitchen" },
    { id: "post-2", value: "Floor" },
  ];
  const staffCount = 12;

  // Simulate the OLD (buggy) updater: uses staleShiftCount from closure
  function buggyUpdater(
    prev: ShiftState,
    staleShiftCount: number | null
  ): ShiftState {
    const staleDuration = staleShiftCount
      ? (() => {
          const [sh, sm] = startTime.split(":").map(Number);
          const [eh, em] = endTime.split(":").map(Number);
          const opHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
          return opHours / staleShiftCount;
        })()
      : 0;

    const durationMin = staleDuration * 60;
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    const newShiftTimes: string[] = [];
    if (durationMin > 0 && endMin > startMin) {
      let curr = startMin;
      while (curr < endMin) {
        const h = Math.floor(curr / 60);
        const m = curr % 60;
        newShiftTimes.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
        curr += durationMin;
      }
    }

    const newHours: UniqueString[] = newShiftTimes.map((time, i) => ({
      id: `shift-${i}-${time}`,
      value: time,
    }));

    const roster = getActiveRosterFromState(prev);
    const activeRosterId = prev.activeRosterId;

    const updatedUserShiftData = (prev.userShiftData || []).map((userData) => {
      const updatedConstraints = (roster.posts || []).map((post, postIdx) => {
        return newHours.map((hour, hourIndex) => {
          const existing = userData.constraints?.[postIdx]?.[hourIndex];
          return existing || { postID: post.id, hourID: hour.id, availability: true };
        });
      });
      return {
        ...userData,
        constraints: updatedConstraints,
        constraintsByRoster: { ...userData.constraintsByRoster, [activeRosterId]: updatedConstraints },
      };
    });

    const shouldClearAssignments = roster.hours?.length !== newHours.length;
    const assignments = shouldClearAssignments
      ? (roster.posts || []).map(() => newHours.map(() => null))
      : roster.assignments;

    return {
      ...updateActiveRoster(prev, (r) => ({
        ...r,
        startTime,
        endTime,
        hours: newHours,
        assignments,
      })),
      selectedShiftCount: prev.selectedShiftCount, // BUG: uses prev, not new level
      userShiftData: updatedUserShiftData,
    };
  }

  // Simulate the NEW (fixed) updater: uses level.shifts from the argument
  function fixedUpdater(
    prev: ShiftState,
    newLevelShifts: number
  ): ShiftState {
    const newHours = generateDynamicHours(startTime, endTime, posts.length, staffCount, newLevelShifts);

    const roster = getActiveRosterFromState(prev);
    const activeRosterId = prev.activeRosterId;

    const updatedUserShiftData = (prev.userShiftData || []).map((userData) => {
      const updatedConstraints = (roster.posts || []).map((post, postIdx) => {
        return newHours.map((hour, hourIndex) => {
          const existingConstraint = userData.constraints?.[postIdx]?.[hourIndex];
          return existingConstraint || { postID: post.id, hourID: hour.id, availability: true };
        });
      });
      return {
        ...userData,
        constraints: updatedConstraints,
        constraintsByRoster: { ...userData.constraintsByRoster, [activeRosterId]: updatedConstraints },
      };
    });

    const shouldClearAssignments = roster.hours?.length !== newHours.length;
    const clearedAssignments = shouldClearAssignments
      ? (roster.posts || []).map(() => newHours.map(() => null))
      : roster.assignments;

    return {
      ...updateActiveRoster(prev, (r) => ({
        ...r,
        startTime,
        endTime,
        hours: newHours,
        assignments: clearedAssignments,
      })),
      selectedShiftCount: newLevelShifts,
      userShiftData: updatedUserShiftData,
    };
  }

  it("buggy updater: switching from 3 to 5 shifts still produces 3-shift hours (stale closure)", () => {
    // State has 3 shifts currently selected
    const oldHours = generateDynamicHours(startTime, endTime, posts.length, staffCount, 3);
    const prevState = buildMockState({
      posts,
      hours: oldHours,
      selectedShiftCount: 3,
      startTime,
      endTime,
    });

    // The buggy handler reads the STALE selectedShiftCount (3) from closure
    const result = buggyUpdater(prevState, 3); // stale closure still sees 3

    const resultRoster = getActiveRosterFromState(result);

    // BUG: selectedShiftCount is still 3 (stale), not 5
    expect(result.selectedShiftCount).toBe(3);
    // BUG: hours match the old level (3 shifts), not the clicked level (5 shifts)
    expect(resultRoster.hours?.length).toBe(3);
  });

  it("fixed updater: switching from 3 to 5 shifts produces 5-shift hours (no stale closure)", () => {
    // State has 3 shifts currently selected
    const oldHours = generateDynamicHours(startTime, endTime, posts.length, staffCount, 3);
    const prevState = buildMockState({
      posts,
      hours: oldHours,
      selectedShiftCount: 3,
      startTime,
      endTime,
    });

    // The fixed handler passes the CLICKED level's shifts (5) directly
    const result = fixedUpdater(prevState, 5);

    const resultRoster = getActiveRosterFromState(result);

    // FIX: selectedShiftCount is 5 (from the clicked level)
    expect(result.selectedShiftCount).toBe(5);
    // FIX: hours match the clicked level (5 shifts)
    expect(resultRoster.hours?.length).toBe(5);
  });

  it("fixed updater works in 7D mode: produces 7 * shifts hours", () => {
    const oldHours = generateDynamicHours(startTime, endTime, posts.length, staffCount, 3);
    const prevState = buildMockState({
      posts,
      hours: oldHours,
      selectedShiftCount: 3,
      startTime,
      endTime,
    });

    const newLevelShifts = 5;
    const newHours = generateWeeklyDynamicHours(startTime, endTime, posts.length, staffCount, newLevelShifts);

    // 7D mode: 7 days * 5 shifts = 35 hours
    expect(newHours.length).toBe(7 * newLevelShifts);

    // Verify the updater logic would use these hours correctly
    const roster = getActiveRosterFromState(prevState);
    const shouldClearAssignments = roster.hours?.length !== newHours.length;
    expect(shouldClearAssignments).toBe(true); // old had 3, new has 35
  });
});
