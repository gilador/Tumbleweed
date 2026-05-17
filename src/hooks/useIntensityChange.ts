import { useCallback, useRef, useState } from "react";
import { useRecoilState } from "recoil";
import {
  ShiftState,
  shiftState,
  getActiveRosterFromState,
  updateActiveRoster,
} from "../stores/shiftStore";
import { UniqueString, UserShiftData } from "../models/index";
import { ShiftLevel } from "../service/shiftLevels";
import {
  generateDynamicHours,
  generateWeeklyDynamicHours,
} from "../service/shiftManagerUtils";
import { trackEvent } from "../lib/analytics";

export interface IntensitySnapshot {
  level: ShiftLevel | null;
  hours: UniqueString[];
  assignments: (string | null)[][];
  selectedShiftCount: number | null;
  userShiftData: UserShiftData[];
}

export interface ConfirmState {
  open: boolean;
  pending: ShiftLevel | null;
  clearedShiftCount: number;
}

export interface UseIntensityChangeResult {
  requestLevelChange: (level: ShiftLevel) => void;
  confirmState: ConfirmState;
  cancelConfirm: () => void;
  acceptConfirm: () => void;
}

export interface UseIntensityChangeOpts {
  showToastWithAction: (
    message: string,
    actionLabel: string,
    onAction: () => void,
    duration?: number,
    onClose?: () => void
  ) => string;
  dismissToast: (id: string) => void;
  posts: UniqueString[];
  startTime: string;
  endTime: string;
  scheduleMode: "24h" | "7d";
  surface: "desktop" | "mobile";
  setLevel: (shiftCount: number) => void;
  /** Localized "Changed to N shifts" message */
  toastMessage: (newShifts: number) => string;
  /** Localized "Undo" label */
  undoLabel: string;
}

/**
 * Pure: build the next ShiftState by applying a level change. Mirrors the body
 * of the old `applyLevel` in both view files — single source of truth.
 */
export function buildLevelApplyState(
  prev: ShiftState,
  level: ShiftLevel,
  startTime: string,
  endTime: string,
  postsLen: number,
  staffCount: number,
  scheduleMode: "24h" | "7d"
): ShiftState {
  const newHours =
    scheduleMode === "7d"
      ? generateWeeklyDynamicHours(
          startTime,
          endTime,
          postsLen,
          staffCount,
          level.shifts
        )
      : generateDynamicHours(
          startTime,
          endTime,
          postsLen,
          staffCount,
          level.shifts
        );

  const roster = getActiveRosterFromState(prev);
  const activeRosterId = prev.activeRosterId;

  const updatedUserShiftData = (prev.userShiftData || []).map((userData) => {
    const updatedConstraints = (roster.posts || []).map((post, postIdx) => {
      return newHours.map((hour, hourIndex) => {
        const existingConstraint =
          userData.constraints?.[postIdx]?.[hourIndex];
        return (
          existingConstraint || {
            postID: post.id,
            hourID: hour.id,
            availability: true,
          }
        );
      });
    });
    return {
      ...userData,
      constraints: updatedConstraints,
      constraintsByRoster: {
        ...userData.constraintsByRoster,
        [activeRosterId]: updatedConstraints,
      },
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
    selectedShiftCount: level.shifts,
    userShiftData: updatedUserShiftData,
  };
}

/**
 * Pure: capture a snapshot from the current state for undo. Captures
 * roster.hours, roster.assignments, selectedShiftCount, and userShiftData
 * (which buildLevelApplyState mutates).
 */
export function captureSnapshot(state: ShiftState): IntensitySnapshot {
  const roster = getActiveRosterFromState(state);
  return {
    level: null,
    hours: roster.hours ? roster.hours.map((h) => ({ ...h })) : [],
    assignments: (roster.assignments || []).map((row) => row.slice()),
    selectedShiftCount: state.selectedShiftCount,
    userShiftData: (state.userShiftData || []).map((u) => ({
      ...u,
      constraints: u.constraints
        ? u.constraints.map((row) => row.slice())
        : u.constraints,
      constraintsByRoster: u.constraintsByRoster
        ? { ...u.constraintsByRoster }
        : u.constraintsByRoster,
    })),
  };
}

/**
 * Pure: restore a previously captured snapshot.
 */
export function restoreSnapshot(
  prev: ShiftState,
  snapshot: IntensitySnapshot
): ShiftState {
  return {
    ...updateActiveRoster(prev, (r) => ({
      ...r,
      hours: snapshot.hours,
      assignments: snapshot.assignments,
    })),
    selectedShiftCount: snapshot.selectedShiftCount,
    userShiftData: snapshot.userShiftData,
  };
}

/**
 * Pure: decide whether to require explicit confirm for the level change.
 * Returns a triple of booleans for the calling logic to act on.
 */
export function shouldConfirmLevelChange(
  state: ShiftState,
  level: ShiftLevel,
  startTime: string,
  endTime: string,
  postsLen: number,
  staffCount: number,
  scheduleMode: "24h" | "7d"
): {
  isNoOp: boolean;
  willClearAssignments: boolean;
  hasAssignments: boolean;
} {
  const roster = getActiveRosterFromState(state);
  const currentShifts = state.selectedShiftCount;
  const isNoOp = currentShifts === level.shifts;

  const expectedNewHours =
    scheduleMode === "7d"
      ? generateWeeklyDynamicHours(
          startTime,
          endTime,
          postsLen,
          staffCount,
          level.shifts
        )
      : generateDynamicHours(
          startTime,
          endTime,
          postsLen,
          staffCount,
          level.shifts
        );

  const willClearAssignments =
    (roster.hours?.length || 0) !== expectedNewHours.length;

  const hasAssignments = (roster.assignments || []).some((row) =>
    row.some((cell) => cell !== null)
  );

  return { isNoOp, willClearAssignments, hasAssignments };
}

export function useIntensityChange(
  opts: UseIntensityChangeOpts
): UseIntensityChangeResult & {
  /** Whether the confirm dialog is currently visible (UI-only — used to gate auto-apply effects) */
  isConfirmOpen: boolean;
} {
  const {
    showToastWithAction,
    dismissToast,
    posts,
    startTime,
    endTime,
    scheduleMode,
    surface,
    setLevel,
    toastMessage,
    undoLabel,
  } = opts;
  const [recoilStateValue, setRecoilState] = useRecoilState(shiftState);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    pending: null,
    clearedShiftCount: 0,
  });
  const snapshotRef = useRef<IntensitySnapshot | null>(null);
  const activeToastIdRef = useRef<string | null>(null);

  const staffCount = recoilStateValue.userShiftData?.length || 0;

  const dropActiveSnapshot = useCallback(() => {
    if (activeToastIdRef.current) {
      const id = activeToastIdRef.current;
      activeToastIdRef.current = null;
      // Best-effort dismiss — caller's toast manager removes by id.
      dismissToast(id);
    }
    snapshotRef.current = null;
  }, [dismissToast]);

  const performApply = useCallback(
    (level: ShiftLevel, fromShifts: number, confirmed: boolean) => {
      // Last-write-wins: drop any pending snapshot/toast before capturing fresh.
      dropActiveSnapshot();

      const snapshot = captureSnapshot(recoilStateValue);
      snapshot.level = level;
      snapshotRef.current = snapshot;

      setRecoilState((prev) =>
        buildLevelApplyState(
          prev,
          level,
          startTime,
          endTime,
          posts.length,
          staffCount,
          scheduleMode
        )
      );
      setLevel(level.shifts);

      trackEvent("intensity-change", {
        from: fromShifts,
        to: level.shifts,
        surface,
        confirmed,
      });

      const toastId = showToastWithAction(
        toastMessage(level.shifts),
        undoLabel,
        () => {
          // Undo click
          const snap = snapshotRef.current;
          if (!snap) return;
          trackEvent("intensity-undo-click", {
            from: level.shifts,
            to: snap.selectedShiftCount ?? level.shifts,
            surface,
          });
          setRecoilState((prev) => restoreSnapshot(prev, snap));
          snapshotRef.current = null;
          activeToastIdRef.current = null;
        },
        8000,
        () => {
          // Toast closed (timeout, programmatic dismiss, or close button) — drop snapshot.
          snapshotRef.current = null;
          activeToastIdRef.current = null;
        }
      );
      activeToastIdRef.current = toastId;
    },
    [
      dropActiveSnapshot,
      recoilStateValue,
      setRecoilState,
      startTime,
      endTime,
      posts.length,
      staffCount,
      scheduleMode,
      setLevel,
      surface,
      showToastWithAction,
      toastMessage,
      undoLabel,
    ]
  );

  const requestLevelChange = useCallback(
    (level: ShiftLevel) => {
      if (!level.feasible) return;
      const { isNoOp, willClearAssignments, hasAssignments } =
        shouldConfirmLevelChange(
          recoilStateValue,
          level,
          startTime,
          endTime,
          posts.length,
          staffCount,
          scheduleMode
        );
      if (isNoOp) return;

      const fromShifts = recoilStateValue.selectedShiftCount ?? 0;

      if (willClearAssignments && hasAssignments) {
        setConfirmState({
          open: true,
          pending: level,
          clearedShiftCount: fromShifts,
        });
        return;
      }

      performApply(level, fromShifts, false);
    },
    [
      recoilStateValue,
      startTime,
      endTime,
      posts.length,
      staffCount,
      scheduleMode,
      performApply,
    ]
  );

  const cancelConfirm = useCallback(() => {
    const fromShifts = recoilStateValue.selectedShiftCount ?? 0;
    const toShifts = confirmState.pending?.shifts ?? fromShifts;
    setConfirmState({ open: false, pending: null, clearedShiftCount: 0 });
    trackEvent("intensity-confirm-cancel", {
      from: fromShifts,
      to: toShifts,
      surface,
    });
  }, [confirmState.pending, recoilStateValue.selectedShiftCount, surface]);

  const acceptConfirm = useCallback(() => {
    const pending = confirmState.pending;
    if (!pending) return;
    const fromShifts = recoilStateValue.selectedShiftCount ?? 0;
    setConfirmState({ open: false, pending: null, clearedShiftCount: 0 });
    performApply(pending, fromShifts, true);
  }, [confirmState.pending, recoilStateValue.selectedShiftCount, performApply]);

  return {
    requestLevelChange,
    confirmState,
    cancelConfirm,
    acceptConfirm,
    isConfirmOpen: confirmState.open,
  };
}
