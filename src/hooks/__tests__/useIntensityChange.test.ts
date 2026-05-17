jest.mock("../../lib/analytics", () => ({
  trackEvent: jest.fn(),
}));

import {
  buildLevelApplyState,
  captureSnapshot,
  restoreSnapshot,
  shouldConfirmLevelChange,
} from "../useIntensityChange";
import {
  ShiftState,
  getActiveRosterFromState,
} from "../../stores/shiftStore";
import { createEmptyRoster, UniqueString } from "../../models/index";
import { ShiftLevel } from "../../service/shiftLevels";
import { SyncStatus } from "../../components/SyncStatusIcon";
import { generateDynamicHours } from "../../service/shiftManagerUtils";

const startTime = "08:00";
const endTime = "18:00";

const posts: UniqueString[] = [
  { id: "post-0", value: "Bar" },
  { id: "post-1", value: "Kitchen" },
];

function makeLevel(shifts: number, opHours = 10): ShiftLevel {
  const duration = opHours / shifts;
  return {
    shifts,
    duration,
    feasible: true,
    neededSlots: shifts * posts.length,
    availableSlots: 12,
    shiftsPerWorker: 1,
    workHours: duration,
    restBetween: shifts === 1 ? 0 : duration,
  };
}

function buildMockState(opts: {
  selectedShiftCount: number | null;
  hours: UniqueString[];
  withAssignments: boolean;
}): ShiftState {
  const roster = createEmptyRoster("Test", "roster-1");
  roster.posts = posts;
  roster.hours = opts.hours;
  roster.startTime = startTime;
  roster.endTime = endTime;
  roster.assignments = posts.map(() =>
    opts.hours.map((_, i) => (opts.withAssignments && i === 0 ? "user-1" : null))
  );
  return {
    rosters: [roster],
    activeRosterId: "roster-1",
    userShiftData: [
      {
        user: { id: "user-1", name: "Worker" },
        constraints: posts.map(() =>
          opts.hours.map((h) => ({
            postID: posts[0].id,
            hourID: h.id,
            availability: true,
          }))
        ),
        constraintsByRoster: {},
        totalAssignments: 0,
      },
    ],
    hasInitialized: true,
    selectedShiftCount: opts.selectedShiftCount,
    syncStatus: "saved" as SyncStatus,
  };
}

describe("useIntensityChange — pure helpers", () => {
  describe("shouldConfirmLevelChange", () => {
    it("flags isNoOp when selecting the current level", () => {
      const hours = generateDynamicHours(startTime, endTime, posts.length, 4, 2);
      const state = buildMockState({
        selectedShiftCount: 2,
        hours,
        withAssignments: false,
      });
      const result = shouldConfirmLevelChange(
        state,
        makeLevel(2),
        startTime,
        endTime,
        posts.length,
        4,
        "24h"
      );
      expect(result.isNoOp).toBe(true);
    });

    it("requires confirm when assignments would be cleared and exist", () => {
      const hours = generateDynamicHours(startTime, endTime, posts.length, 4, 2);
      const state = buildMockState({
        selectedShiftCount: 2,
        hours,
        withAssignments: true,
      });
      const result = shouldConfirmLevelChange(
        state,
        makeLevel(5),
        startTime,
        endTime,
        posts.length,
        4,
        "24h"
      );
      expect(result.willClearAssignments).toBe(true);
      expect(result.hasAssignments).toBe(true);
      expect(result.isNoOp).toBe(false);
    });

    it("does not require confirm when no assignments exist", () => {
      const hours = generateDynamicHours(startTime, endTime, posts.length, 4, 2);
      const state = buildMockState({
        selectedShiftCount: 2,
        hours,
        withAssignments: false,
      });
      const result = shouldConfirmLevelChange(
        state,
        makeLevel(5),
        startTime,
        endTime,
        posts.length,
        4,
        "24h"
      );
      expect(result.hasAssignments).toBe(false);
    });
  });

  describe("captureSnapshot + restoreSnapshot", () => {
    it("captures hours, assignments, selectedShiftCount, and userShiftData", () => {
      const hours = generateDynamicHours(startTime, endTime, posts.length, 4, 2);
      const state = buildMockState({
        selectedShiftCount: 2,
        hours,
        withAssignments: true,
      });
      const snap = captureSnapshot(state);
      expect(snap.selectedShiftCount).toBe(2);
      expect(snap.hours.length).toBe(hours.length);
      expect(snap.assignments.length).toBe(posts.length);
      expect(snap.assignments[0][0]).toBe("user-1");
      expect(snap.userShiftData.length).toBe(1);
    });

    it("restores previous state including userShiftData constraints", () => {
      const hoursBefore = generateDynamicHours(startTime, endTime, posts.length, 4, 2);
      const before = buildMockState({
        selectedShiftCount: 2,
        hours: hoursBefore,
        withAssignments: true,
      });
      const snap = captureSnapshot(before);

      // Apply a level change (which mutates userShiftData constraints)
      const after = buildLevelApplyState(
        before,
        makeLevel(5),
        startTime,
        endTime,
        posts.length,
        4,
        "24h"
      );
      expect(after.selectedShiftCount).toBe(5);
      const afterRoster = getActiveRosterFromState(after);
      expect(afterRoster.hours?.length).toBe(5);
      // assignments cleared
      expect(afterRoster.assignments?.[0]?.[0]).toBeNull();
      // userShiftData constraints reshaped
      expect(after.userShiftData[0].constraints?.[0]?.length).toBe(5);

      // Now restore the snapshot
      const restored = restoreSnapshot(after, snap);
      const restoredRoster = getActiveRosterFromState(restored);
      expect(restored.selectedShiftCount).toBe(2);
      expect(restoredRoster.hours?.length).toBe(hoursBefore.length);
      expect(restoredRoster.assignments?.[0]?.[0]).toBe("user-1");
      // userShiftData restored to pre-change constraint shape (2 hours)
      expect(restored.userShiftData[0].constraints?.[0]?.length).toBe(
        hoursBefore.length
      );
    });
  });

  describe("rapid double-change last-write-wins", () => {
    it("after two consecutive changes, restoring the FIRST snapshot would be stale; only the SECOND snapshot is valid", () => {
      // Start: 2 shifts, with assignments
      const hoursA = generateDynamicHours(startTime, endTime, posts.length, 4, 2);
      const stateA = buildMockState({
        selectedShiftCount: 2,
        hours: hoursA,
        withAssignments: true,
      });

      // First change → 5 shifts. Snapshot A captured (2 shifts, with assignments).
      const snapA = captureSnapshot(stateA);
      const stateB = buildLevelApplyState(
        stateA,
        makeLevel(5),
        startTime,
        endTime,
        posts.length,
        4,
        "24h"
      );
      expect(stateB.selectedShiftCount).toBe(5);

      // Second change (within 8s window) → 10 shifts. Hook drops snapA, captures snapB.
      const snapB = captureSnapshot(stateB);
      const stateC = buildLevelApplyState(
        stateB,
        makeLevel(10),
        startTime,
        endTime,
        posts.length,
        4,
        "24h"
      );
      expect(stateC.selectedShiftCount).toBe(10);

      // Undo using snapB → expect 5 shifts (intermediate), NOT 2.
      const restoredFromB = restoreSnapshot(stateC, snapB);
      expect(restoredFromB.selectedShiftCount).toBe(5);
      const rosterFromB = getActiveRosterFromState(restoredFromB);
      expect(rosterFromB.hours?.length).toBe(5);

      // Sanity: the FIRST snapshot would restore to 2; this is what last-write-wins drops.
      const restoredFromA = restoreSnapshot(stateC, snapA);
      expect(restoredFromA.selectedShiftCount).toBe(2);
      // Documents the "stale" property: first snapshot is no longer applicable.
      expect(restoredFromB.selectedShiftCount).not.toBe(
        snapA.selectedShiftCount
      );
    });
  });
});
