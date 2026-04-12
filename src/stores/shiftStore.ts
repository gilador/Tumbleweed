import { atom, selector, AtomEffect, DefaultValue } from "recoil";
import { UniqueString } from "../models/index";
import { UserShiftData, RosterState, createEmptyRoster, getActiveRoster } from "../models";
import { SyncStatus } from "../components/SyncStatusIcon";
import {
  saveStateToLocalStorage,
  LOCAL_STORAGE_KEY,
  LAST_LOCAL_SAVE_KEY,
  computeChecksum,
} from "../lib/localStorageUtils";

// Data structure for persistence, excluding syncStatus
export interface PersistedShiftData {
  // Multi-roster structure
  rosters: RosterState[];
  activeRosterId: string;
  userShiftData: UserShiftData[];
  hasInitialized: boolean;
  restTime?: number; // legacy, migrated to selectedShiftCount
  zeroRest?: boolean; // legacy, removed
  selectedShiftCount: number | null;
  // Snapshot of inputs used for the last successful optimization.
  // If current inputs match this, the schedule is considered optimized.
  optimizationSignature?: string | null;
}

// Full state including syncStatus
export interface ShiftState extends PersistedShiftData {
  syncStatus: SyncStatus;
  optimizationFailed?: boolean;
}

// --- Backward-compatible accessors ---
export function getActiveRosterFromState(state: ShiftState): RosterState {
  return getActiveRoster(state.rosters, state.activeRosterId);
}

export function updateActiveRoster(
  state: ShiftState,
  updater: (roster: RosterState) => RosterState
): ShiftState {
  return {
    ...state,
    rosters: state.rosters.map((r) =>
      r.id === state.activeRosterId ? updater(r) : r
    ),
  };
}

export function updateRosterById(
  state: ShiftState,
  rosterId: string,
  updater: (roster: RosterState) => RosterState
): ShiftState {
  return {
    ...state,
    rosters: state.rosters.map((r) =>
      r.id === rosterId ? updater(r) : r
    ),
  };
}

const defaultRoster = createEmptyRoster("", "default-roster");

export const initialLoadState: ShiftState = {
  rosters: [defaultRoster],
  activeRosterId: defaultRoster.id,
  userShiftData: [],
  hasInitialized: false,
  syncStatus: "idle",
  selectedShiftCount: null,
  optimizationSignature: null,
};

// --- Legacy format detection and migration ---
interface LegacyPersistedShiftData {
  posts: UniqueString[];
  hours: UniqueString[];
  userShiftData: UserShiftData[];
  hasInitialized: boolean;
  assignments: (string | null)[][];
  manuallyEditedSlots: {
    [slotKey: string]: {
      originalUserId: string | null;
      currentUserId: string | null;
    };
  };
  customCellDisplayNames: { [slotKey: string]: string };
  startTime: string;
  endTime: string;
  restTime: number;
  scheduleMode: "24h" | "7d";
  startDate: string | null;
  cachedWeeklyState: {
    hours: UniqueString[];
    assignments: (string | null)[][];
    userShiftData: UserShiftData[];
    startDate: string;
  } | null;
}

export function isLegacyFormat(data: any): data is LegacyPersistedShiftData {
  return data && "posts" in data && !("rosters" in data);
}

export function migrateLegacyState(legacy: LegacyPersistedShiftData): PersistedShiftData {
  const rosterId = "migrated-roster-1";
  const roster: RosterState = {
    id: rosterId,
    name: "",
    posts: legacy.posts || [],
    hours: legacy.hours || [],
    assignments: legacy.assignments || [],
    manuallyEditedSlots: legacy.manuallyEditedSlots || {},
    customCellDisplayNames: legacy.customCellDisplayNames || {},
    scheduleMode: legacy.scheduleMode || "24h",
    startTime: legacy.startTime || "08:00",
    endTime: legacy.endTime || "18:00",
    startDate: legacy.startDate || null,
    cachedWeeklyState: legacy.cachedWeeklyState || null,
  };

  const migratedUsers: UserShiftData[] = (legacy.userShiftData || []).map((u) => ({
    ...u,
    constraintsByRoster: { [rosterId]: u.constraints },
  }));

  return {
    rosters: [roster],
    activeRosterId: rosterId,
    userShiftData: migratedUsers,
    hasInitialized: legacy.hasInitialized,
    selectedShiftCount: null,
  };
}

// Define the persistence effect
const persistenceEffect: AtomEffect<ShiftState> = ({
  setSelf,
  onSet,
}) => {
  onSet(async (newValue, oldValue) => {
    console.log("[persistenceEffect] onSet triggered.");
    if (newValue instanceof DefaultValue) {
      console.log("[persistenceEffect] Atom was reset.");
      try {
        const { syncStatus, optimizationFailed: _of, ...persistableDefault } = initialLoadState;
        await saveStateToLocalStorage(LOCAL_STORAGE_KEY, persistableDefault);
      } catch (error) {
        console.error("[shiftStore] onSet (DefaultValue): Error saving:", error);
      }
      return;
    }

    const oldConcreteValue =
      oldValue instanceof DefaultValue ? initialLoadState : oldValue;

    const { syncStatus: _newSS, optimizationFailed: _newOF, ...newPersistedData } = newValue;
    const { syncStatus: _oldSS, optimizationFailed: _oldOF, ...oldPersistedData } = oldConcreteValue;

    // If userShiftData is empty and initialized, clear per-roster slot edits
    if (
      newPersistedData.hasInitialized &&
      newPersistedData.userShiftData?.length === 0
    ) {
      for (const roster of newPersistedData.rosters) {
        if (Object.keys(roster.manuallyEditedSlots).length > 0) {
          roster.manuallyEditedSlots = {};
        }
        if (Object.keys(roster.customCellDisplayNames).length > 0) {
          roster.customCellDisplayNames = {};
        }
      }
    }

    const newSerialized = JSON.stringify(newPersistedData);
    const oldSerialized = JSON.stringify(oldPersistedData);
    const persistableDataChanged = newSerialized !== oldSerialized;

    if (persistableDataChanged) {
      console.log("[persistenceEffect] Data changed, proceeding with save.");
      const startTime = Date.now();

      setSelf({
        ...newPersistedData,
        syncStatus: "syncing" as SyncStatus,
      });

      try {
        await saveStateToLocalStorage(LOCAL_STORAGE_KEY, newPersistedData);

        // Only update local save timestamp if content actually changed (by checksum)
        const newChecksum = await computeChecksum(newPersistedData);
        const lastChecksum = localStorage.getItem("tumbleweed-local-checksum");
        if (newChecksum !== lastChecksum) {
          localStorage.setItem("tumbleweed-local-checksum", newChecksum);
          localStorage.setItem(LAST_LOCAL_SAVE_KEY, new Date().toISOString());
        }

        console.log("[persistenceEffect] Successfully saved to localStorage.");

        const delayNeeded = Math.max(0, 1000 - (Date.now() - startTime));
        setTimeout(() => {
          setSelf((currentState) => {
            const base = currentState instanceof DefaultValue ? initialLoadState : currentState;
            return { ...base, syncStatus: "synced" as SyncStatus };
          });
        }, delayNeeded);
      } catch (error) {
        console.error("[shiftStore] onSet: Error saving:", error);
        const delayNeeded = Math.max(0, 1000 - (Date.now() - startTime));
        setTimeout(() => {
          setSelf((currentState) => {
            const base = currentState instanceof DefaultValue ? initialLoadState : currentState;
            return { ...base, syncStatus: "out-of-sync" as SyncStatus };
          });
        }, delayNeeded);
      }
    }
  });
};

export const shiftState = atom<ShiftState>({
  key: "shiftState",
  default: initialLoadState,
  effects: [persistenceEffect],
});

export interface ShiftScheduleInfo {
  shiftDuration: number;
  shiftsCount: number;
  shiftStartTimes: string[];
}

/**
 * Derived selector: computes shift duration, count, and start times
 * from the active roster's parameters. Single source of truth for
 * both toolbar and config dialog.
 */
export const shiftScheduleInfoSelector = selector<ShiftScheduleInfo>({
  key: "shiftScheduleInfo",
  get: ({ get }) => {
    const state = get(shiftState);
    const roster = getActiveRoster(state.rosters, state.activeRosterId);

    // Read directly from the roster — this is the actual data the grid uses.
    const hours = roster.hours || [];
    const startTimes = hours.map((h) => h.value);

    // Extract raw time from hour value (handles weekly "day·HH:MM" format)
    const parseTime = (val: string): [number, number] => {
      // Weekly format: "0·08:00" → extract "08:00"
      const timeStr = val.includes("·") ? val.split("·")[1] : val;
      const [h, m] = timeStr.split(":").map(Number);
      return [h || 0, m || 0];
    };

    const shiftsCount = roster.scheduleMode === "7d"
      ? Math.round(hours.length / 7)
      : hours.length;

    // Derive duration from the actual hours in the roster
    let shiftDuration = 0;
    if (roster.scheduleMode === "7d" && hours.length >= 2) {
      // For weekly mode, find consecutive hours on the same day
      const day0Hours = hours.filter((h) => h.value.startsWith("0·"));
      if (day0Hours.length >= 2) {
        const [h1, m1] = parseTime(day0Hours[0].value);
        const [h2, m2] = parseTime(day0Hours[1].value);
        let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diffMin <= 0) diffMin += 24 * 60;
        shiftDuration = diffMin / 60;
      } else if (day0Hours.length === 1) {
        // Single shift per day
        const startTime = roster.startTime || "08:00";
        const endTime = roster.endTime || "18:00";
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        let diffMin = (eh * 60 + em) - (sh * 60 + sm);
        if (diffMin <= 0) diffMin += 24 * 60;
        shiftDuration = diffMin / 60;
      }
    } else if (hours.length >= 2) {
      const [h1, m1] = parseTime(hours[0].value);
      const [h2, m2] = parseTime(hours[1].value);
      let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diffMin <= 0) diffMin += 24 * 60;
      shiftDuration = diffMin / 60;
    } else if (hours.length === 1) {
      const startTime = roster.startTime || "08:00";
      const endTime = roster.endTime || "18:00";
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      let diffMin = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMin <= 0) diffMin += 24 * 60;
      shiftDuration = diffMin / 60;
    }

    return {
      shiftDuration,
      shiftsCount,
      shiftStartTimes: startTimes,
    };
  },
});
