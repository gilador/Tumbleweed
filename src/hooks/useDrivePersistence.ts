import { useEffect, useRef, useCallback } from "react";
import { useRecoilState } from "recoil";
import { shiftState, type PersistedShiftData } from "../stores/shiftStore";
import {
  hasGoogleDriveAccess,
  saveToDrive,
  loadFromDrive,
  clearGoogleAccessToken,
} from "../lib/googleDrive";
import {
  LOCAL_STORAGE_KEY,
} from "../lib/localStorageUtils";

const DEBOUNCE_MS = 2000;

/**
 * Syncs shift data to Google Drive when the user is signed in with Google.
 * On startup, compares Drive and localStorage timestamps and uses the newer one.
 * On sign-out, reverts to localStorage-only mode without losing local data.
 */
export function useDrivePersistence() {
  const [state, setState] = useRecoilState(shiftState);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedRef = useRef<string>("");

  // Load from Drive on mount (if Drive access available)
  useEffect(() => {
    if (!hasGoogleDriveAccess()) return;

    loadFromDrive()
      .then((driveResult) => {
        if (!driveResult) return;

        // Compare with localStorage timestamp
        const localRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
        const localTimestamp = localRaw
          ? localStorage.getItem(`${LOCAL_STORAGE_KEY}_timestamp`) ?? "0"
          : "0";

        const driveTime = new Date(driveResult.modifiedTime).getTime();
        const localTime = new Date(localTimestamp).getTime();

        if (driveTime > localTime && driveResult.data) {
          // Drive is newer — use it
          const driveData = driveResult.data as PersistedShiftData;
          setState((prev) => ({
            ...prev,
            ...driveData,
            syncStatus: "synced",
          }));
        }
      })
      .catch(() => {
        // Drive unavailable, continue with localStorage
      });
  }, [setState]);

  // Debounced save to Drive on state changes
  const saveCallback = useCallback(() => {
    if (!hasGoogleDriveAccess()) return;

    const { syncStatus, ...persistable } = state;
    const serialized = JSON.stringify(persistable);

    if (serialized === lastSavedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveToDrive(persistable);
        lastSavedRef.current = serialized;
        // Update localStorage timestamp for comparison
        localStorage.setItem(
          `${LOCAL_STORAGE_KEY}_timestamp`,
          new Date().toISOString()
        );
      } catch {
        // Drive save failed, localStorage still has the data
      }
    }, DEBOUNCE_MS);
  }, [state]);

  useEffect(() => {
    saveCallback();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [saveCallback]);

  const signOutDrive = useCallback(() => {
    clearGoogleAccessToken();
    // Local data is preserved — no action needed
  }, []);

  return { signOutDrive, hasDriveAccess: hasGoogleDriveAccess() };
}
