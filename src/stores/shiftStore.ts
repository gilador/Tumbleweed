import { atom, AtomEffect, DefaultValue } from "recoil";
import { UniqueString } from "../models/index";
import { UserShiftData } from "../models";
import { SyncStatus } from "../components/SyncStatusIcon";
import {
  saveStateToLocalStorage,
  LOCAL_STORAGE_KEY,
} from "../lib/localStorageUtils";

// Data structure for persistence, excluding syncStatus
export interface PersistedShiftData {
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
  // Shift settings
  startTime: string;
  endTime: string;
  restTime: number;
  // Schedule mode
  scheduleMode: "24h" | "7d";
  startDate: string | null;
  cachedWeeklyState: {
    hours: UniqueString[];
    assignments: (string | null)[][];
    userShiftData: UserShiftData[];
    startDate: string;
  } | null;
}

// Full state including syncStatus
export interface ShiftState extends PersistedShiftData {
  syncStatus: SyncStatus;
}

// This is the true initial state before any localStorage interaction from component
export const initialLoadState: ShiftState = {
  posts: [],
  hours: [],
  userShiftData: [],
  hasInitialized: false,
  syncStatus: "idle", // New status: idle, until component loads from storage
  assignments: [],
  manuallyEditedSlots: {}, // Initialize as empty object
  customCellDisplayNames: {}, // Initialize as empty object
  // Default shift settings
  startTime: "08:00",
  endTime: "18:00",
  restTime: 2,
  // Schedule mode
  scheduleMode: "24h",
  startDate: null,
  cachedWeeklyState: null,
};

// Define the persistence effect
const persistenceEffect: AtomEffect<ShiftState> = ({
  setSelf,
  onSet,
  // trigger,
}) => {
  // trigger === 'get' is no longer responsible for async loading here.
  // The atom will initialize with its `default` value synchronously.
  // A component (e.g., App or ShiftManager) will handle async loading in useEffect.

  onSet(async (newValue, oldValue) => {
    console.log("[persistenceEffect] onSet triggered."); // Log trigger
    if (newValue instanceof DefaultValue) {
      console.log("[persistenceEffect] Atom was reset.");
      // Atom was reset. Save the initialLoadState (or clear storage).
      try {
        const { syncStatus, ...persistableDefault } = initialLoadState;
        console.log(
          "[shiftStore] onSet (DefaultValue): Attempting to save initialLoadState to localStorage."
        );
        await saveStateToLocalStorage(LOCAL_STORAGE_KEY, persistableDefault);
        console.log(
          "[shiftStore] onSet (DefaultValue): Successfully saved initialLoadState."
        );
        // setSelf({...initialLoadState, syncStatus: 'synced'}); // or 'idle' after reset
      } catch (error) {
        console.error(
          "[shiftStore] onSet (DefaultValue): Error saving default state on reset:",
          error
        );
        // Consider how to set syncStatus if reset save fails
      }
      return;
    }

    const oldConcreteValue =
      oldValue instanceof DefaultValue ? initialLoadState : oldValue;

    const { syncStatus: newSS, ...newPersistedData } = newValue;
    const { syncStatus: oldSS, ...oldPersistedData } = oldConcreteValue;

    // If userShiftData is empty and the state has been initialized,
    // it implies a reset of user-specific data, so clear related slot edits and names.
    if (
      newPersistedData.hasInitialized &&
      newPersistedData.userShiftData && // Ensure userShiftData exists on the object
      newPersistedData.userShiftData.length === 0
    ) {
      if (Object.keys(newPersistedData.manuallyEditedSlots).length > 0) {
        newPersistedData.manuallyEditedSlots = {};
        console.log(
          "[persistenceEffect] Cleared manuallyEditedSlots as userShiftData is empty and state initialized."
        );
      }
      if (Object.keys(newPersistedData.customCellDisplayNames).length > 0) {
        newPersistedData.customCellDisplayNames = {};
        console.log(
          "[persistenceEffect] Cleared customCellDisplayNames as userShiftData is empty and state initialized."
        );
      }
    }

    // Log addition or removal of posts (columns in the assignments array)
    const oldAssignmentsData = oldPersistedData.assignments || [];
    const newAssignmentsData = newPersistedData.assignments || [];

    const oldNumPosts =
      oldAssignmentsData.length > 0 && oldAssignmentsData[0]
        ? oldAssignmentsData[0].length
        : 0;
    const newNumPosts =
      newAssignmentsData.length > 0 && newAssignmentsData[0]
        ? newAssignmentsData[0].length
        : 0;

    if (newNumPosts !== oldNumPosts) {
      if (newNumPosts > oldNumPosts) {
        console.log(
          `DELETE: Post(s) ADDED. Old column count: ${oldNumPosts}, New column count: ${newNumPosts}. Reflected assignments state:`,
          JSON.stringify(newAssignmentsData)
        );
      } else {
        // newNumPosts < oldNumPosts
        console.log(
          `DELETE: Post(s) REMOVED. Old column count: ${oldNumPosts}, New column count: ${newNumPosts}. Reflected assignments state:`,
          JSON.stringify(newAssignmentsData)
        );
      }
    }

    // Log the data being compared
    console.log(
      "[persistenceEffect] Old assignments:",
      oldPersistedData.assignments
    );
    console.log(
      "[persistenceEffect] New assignments:",
      newPersistedData.assignments
    );

    const persistableDataChanged =
      JSON.stringify(newPersistedData) !== JSON.stringify(oldPersistedData);
    console.log(
      "[persistenceEffect] Persistable data changed?",
      persistableDataChanged
    );

    if (persistableDataChanged) {
      console.log("[persistenceEffect] Data changed, proceeding with save.");
      const startTime = Date.now(); // Record start time

      // Set to syncing AND update to the new data immediately
      setSelf({
        ...newPersistedData, // Commit the new data part of the state
        syncStatus: "syncing" as SyncStatus, // Set status to syncing
      });
      // At this point, the Recoil state reflects newPersistedData and is "syncing"
      console.log(
        '[shiftStore] onSet: State updated immediately with new data and status "syncing". Start time:',
        startTime,
        "Persisted data committed:",
        newPersistedData
      );

      try {
        console.log(
          "[persistenceEffect] Attempting to save to localStorage. Data:",
          newPersistedData
        );
        await saveStateToLocalStorage(LOCAL_STORAGE_KEY, newPersistedData);
        console.log("[persistenceEffect] Successfully saved to localStorage.");

        const endTime = Date.now();
        const elapsedTime = endTime - startTime;
        const delayNeeded = Math.max(0, 1000 - elapsedTime);

        console.log(
          `[persistenceEffect] Save successful. Elapsed: ${elapsedTime}ms, Delay needed: ${delayNeeded}ms`
        );

        setTimeout(() => {
          // After the delay, update ONLY the syncStatus.
          // The rest of the state already reflects newPersistedData from the earlier setSelf.
          setSelf((currentState) => {
            const base =
              currentState instanceof DefaultValue
                ? initialLoadState
                : currentState;
            console.log(
              '[shiftStore] onSet (after delay, success): Updating syncStatus to "synced". State before this update was:',
              base
            );
            return {
              ...base, // Spread the current state (which has the correct data and was syncing)
              syncStatus: "synced" as SyncStatus,
            };
          });
        }, delayNeeded);
      } catch (error) {
        console.error(
          "[shiftStore] onSet: Error saving state to localStorage:",
          error
        );

        const endTime = Date.now();
        const elapsedTime = endTime - startTime;
        const delayNeeded = Math.max(0, 1000 - elapsedTime);

        console.log(
          `[persistenceEffect] Save failed. Elapsed: ${elapsedTime}ms, Delay needed: ${delayNeeded}ms`
        );

        setTimeout(() => {
          // After the delay, update ONLY the syncStatus.
          // The rest of the state already reflects newPersistedData.
          setSelf((currentState) => {
            const base =
              currentState instanceof DefaultValue
                ? initialLoadState
                : currentState;
            console.log(
              '[shiftStore] onSet (after delay, error): Updating syncStatus to "out-of-sync". State before this update was:',
              base
            );
            return {
              ...base, // Spread the current state (which has the correct data and was syncing)
              syncStatus: "out-of-sync" as SyncStatus,
            };
          });
        }, delayNeeded);
      }
    } else {
      console.log(
        "[persistenceEffect] Data has not changed (persistable part), or syncStatus change is internal. No save needed now. New syncStatus:",
        newValue instanceof DefaultValue ? "Default" : newValue.syncStatus,
        "Old syncStatus:",
        oldValue instanceof DefaultValue ? "Default" : oldValue.syncStatus
      );
    }
  });
};

export const shiftState = atom<ShiftState>({
  key: "shiftState",
  default: initialLoadState, // Initialize synchronously
  effects: [persistenceEffect],
});
