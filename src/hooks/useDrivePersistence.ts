import { useEffect, useRef, useCallback, useState } from "react";
import { useRecoilState } from "recoil";
import { shiftState, type PersistedShiftData, isLegacyFormat, migrateLegacyState } from "../stores/shiftStore";
import {
  hasGoogleDriveAccess,
  saveToDrive,
  loadFromDrive,
  DRIVE_FILE_ROSTER,
  DRIVE_FILE_PREFERENCES,
} from "../lib/googleDrive";
import {
  LOCAL_STORAGE_KEY,
  DRIVE_ROSTER_CHECKSUM_KEY,
  DRIVE_PREFS_CHECKSUM_KEY,
  LAST_CLOUD_SAVE_KEY,
  loadStateFromLocalStorage,
  computeChecksum,
  type DrivePreferences,
} from "../lib/localStorageUtils";
import { useAuth } from "../lib/auth";
import i18n from "../lib/i18n";

const SHIFT_DEBOUNCE_MS = 2000;

export interface DriveConflict {
  type: "roster";
}

function getLocalPreferences(): DrivePreferences {
  return {
    theme: localStorage.getItem("tumbleweed-theme") || "system",
    lang: localStorage.getItem("tumbleweed-lang") || "en",
    settings: (() => {
      try {
        const raw = localStorage.getItem("tumbleweed-settings");
        return raw ? JSON.parse(raw) : { shareDebugInfo: false };
      } catch {
        return { shareDebugInfo: false };
      }
    })(),
  };
}

function applyPreferences(prefs: DrivePreferences) {
  localStorage.setItem("tumbleweed-theme", prefs.theme);
  localStorage.setItem("tumbleweed-lang", prefs.lang);
  localStorage.setItem("tumbleweed-settings", JSON.stringify(prefs.settings));

  const resolved = prefs.theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : prefs.theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");

  if (i18n.language !== prefs.lang) {
    i18n.changeLanguage(prefs.lang);
  }
}

function classifyDriveError(err: unknown): "permission-error" | "token-expired" | "error" {
  if (err instanceof Error) {
    if (err.message === "DRIVE_PERMISSION_ERROR") return "permission-error";
    if (err.message === "DRIVE_TOKEN_EXPIRED") return "token-expired";
  }
  return "error";
}

export function useDrivePersistence() {
  const [state, setState] = useRecoilState(shiftState);
  const { isAuthenticated } = useAuth();
  const shiftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedShiftRef = useRef<string>("");
  const lastSavedPrefsRef = useRef<string>("");
  const [conflicts, setConflicts] = useState<DriveConflict[]>([]);
  const [syncReady, setSyncReady] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"idle" | "syncing" | "synced" | "error" | "permission-error" | "token-expired">("idle");
  const syncInProgressRef = useRef(false);

  // --- Core sync check: fetch Drive content, compare checksums ---
  const checkDrive = useCallback(async () => {
    if (!isAuthenticated || !hasGoogleDriveAccess() || syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    setCloudSyncStatus("syncing");

    try {
      const catchNonFatal = (err: unknown) => {
        if (err instanceof Error && (err.message === "DRIVE_TOKEN_EXPIRED" || err.message === "DRIVE_PERMISSION_ERROR")) {
          throw err; // Re-throw critical errors
        }
        return null;
      };
      const [rosterResult, prefsResult] = await Promise.all([
        loadFromDrive(DRIVE_FILE_ROSTER).catch(catchNonFatal),
        loadFromDrive(DRIVE_FILE_PREFERENCES).catch(catchNonFatal),
      ]);

      const pendingConflicts: DriveConflict[] = [];

      // --- Roster ---
      const storedRosterChecksum = localStorage.getItem(DRIVE_ROSTER_CHECKSUM_KEY);
      if (rosterResult?.data) {
        const driveChecksum = await computeChecksum(rosterResult.data);

        if (!storedRosterChecksum) {
          // First time syncing — auto-load from Drive
          let driveData = rosterResult.data as any;
          if (isLegacyFormat(driveData)) {
            driveData = migrateLegacyState(driveData);
          }
          const typedData = driveData as PersistedShiftData;
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(typedData));
          localStorage.setItem(DRIVE_ROSTER_CHECKSUM_KEY, driveChecksum);
          setState((prev) => ({ ...prev, ...typedData, syncStatus: "synced" }));
        } else if (driveChecksum !== storedRosterChecksum) {
          // Content differs — another device changed it
          pendingConflicts.push({ type: "roster" });
        }
      }

      // --- Preferences (always auto-sync, no prompt) ---
      const storedPrefsChecksum = localStorage.getItem(DRIVE_PREFS_CHECKSUM_KEY);
      if (prefsResult?.data) {
        const driveChecksum = await computeChecksum(prefsResult.data);
        if (!storedPrefsChecksum || driveChecksum !== storedPrefsChecksum) {
          localStorage.setItem(DRIVE_PREFS_CHECKSUM_KEY, driveChecksum);
          applyPreferences(prefsResult.data as DrivePreferences);
        }
      }

      if (pendingConflicts.length > 0) {
        setConflicts(pendingConflicts);
      }

      // If no roster on Drive yet, push local data
      if (!rosterResult?.data) {
        const localData = await loadStateFromLocalStorage<PersistedShiftData>(LOCAL_STORAGE_KEY);
        if (localData) {
          await saveToDrive(DRIVE_FILE_ROSTER, localData);
          const checksum = await computeChecksum(localData);
          localStorage.setItem(DRIVE_ROSTER_CHECKSUM_KEY, checksum);
          localStorage.setItem(LAST_CLOUD_SAVE_KEY, new Date().toISOString());
        }
      }
      if (!prefsResult?.data) {
        const prefs = getLocalPreferences();
        await saveToDrive(DRIVE_FILE_PREFERENCES, prefs);
        const checksum = await computeChecksum(prefs);
        localStorage.setItem(DRIVE_PREFS_CHECKSUM_KEY, checksum);
        localStorage.setItem(LAST_CLOUD_SAVE_KEY, new Date().toISOString());
      }

      setCloudSyncStatus("synced");
    } catch (err) {
      setCloudSyncStatus(classifyDriveError(err));
    } finally {
      syncInProgressRef.current = false;
    }
  }, [isAuthenticated, setState]);

  // --- Initial load check ---
  useEffect(() => {
    if (!isAuthenticated || !hasGoogleDriveAccess() || syncReady) return;

    (async () => {
      await checkDrive();

      // Seed push refs — only if cloud is in sync
      const localCk = localStorage.getItem("tumbleweed-local-checksum");
      const cloudCk = localStorage.getItem(DRIVE_ROSTER_CHECKSUM_KEY);
      const rosterInSync = localCk && cloudCk && localCk === cloudCk;

      if (rosterInSync) {
        const currentLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (currentLocal) {
          try {
            const parsed = JSON.parse(currentLocal);
            const { syncStatus, ...persistable } = parsed;
            lastSavedShiftRef.current = JSON.stringify(persistable ?? parsed);
          } catch {
            lastSavedShiftRef.current = currentLocal;
          }
        }
      }

      lastSavedPrefsRef.current = JSON.stringify(getLocalPreferences());
      setSyncReady(true);
    })();
  }, [isAuthenticated, syncReady, checkDrive]);

  // --- Poll on tab focus ---
  useEffect(() => {
    if (!syncReady || !isAuthenticated || !hasGoogleDriveAccess()) return;

    const handleFocus = () => {
      checkDrive();
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") handleFocus();
    });
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncReady, isAuthenticated, checkDrive]);

  // --- Manual sync trigger ---
  const triggerSync = useCallback(async () => {
    if (!isAuthenticated || !hasGoogleDriveAccess()) return;

    // First push any pending local changes
    const { syncStatus, ...persistable } = state;
    const localData = await loadStateFromLocalStorage<PersistedShiftData>(LOCAL_STORAGE_KEY);
    if (localData) {
      setCloudSyncStatus("syncing");
      try {
        await saveToDrive(DRIVE_FILE_ROSTER, localData);
        const checksum = await computeChecksum(localData);
        localStorage.setItem(DRIVE_ROSTER_CHECKSUM_KEY, checksum);
        localStorage.setItem(LAST_CLOUD_SAVE_KEY, new Date().toISOString());
        lastSavedShiftRef.current = JSON.stringify(persistable);

        const prefs = getLocalPreferences();
        await saveToDrive(DRIVE_FILE_PREFERENCES, prefs);
        const prefsChecksum = await computeChecksum(prefs);
        localStorage.setItem(DRIVE_PREFS_CHECKSUM_KEY, prefsChecksum);
        lastSavedPrefsRef.current = JSON.stringify(prefs);

        setCloudSyncStatus("synced");
      } catch (err) {
        setCloudSyncStatus(
          err instanceof Error && err.message === "DRIVE_PERMISSION_ERROR"
            ? "permission-error"
            : "error"
        );
      }
    }

    // Then check for remote changes
    await checkDrive();
  }, [isAuthenticated, state, checkDrive]);

  // --- One-way push: shift data (debounced 2s) ---
  useEffect(() => {
    if (!syncReady || !isAuthenticated || !hasGoogleDriveAccess() || conflicts.length > 0) return;

    const { syncStatus, ...persistable } = state;
    const serialized = JSON.stringify(persistable);
    if (serialized === lastSavedShiftRef.current) return;

    if (shiftSaveTimeoutRef.current) clearTimeout(shiftSaveTimeoutRef.current);

    shiftSaveTimeoutRef.current = setTimeout(async () => {
      setCloudSyncStatus("syncing");
      try {
        await saveToDrive(DRIVE_FILE_ROSTER, persistable);
        lastSavedShiftRef.current = serialized;
        const checksum = await computeChecksum(persistable);
        localStorage.setItem(DRIVE_ROSTER_CHECKSUM_KEY, checksum);
        localStorage.setItem(LAST_CLOUD_SAVE_KEY, new Date().toISOString());
        setCloudSyncStatus("synced");
      } catch (err) {
        setCloudSyncStatus(
          err instanceof Error && err.message === "DRIVE_PERMISSION_ERROR"
            ? "permission-error"
            : "error"
        );
      }
    }, SHIFT_DEBOUNCE_MS);

    return () => {
      if (shiftSaveTimeoutRef.current) clearTimeout(shiftSaveTimeoutRef.current);
    };
  }, [state, syncReady, isAuthenticated, conflicts.length]);

  // --- One-way push: preferences (immediate) ---
  const pushPreferences = useCallback(() => {
    if (!syncReady || !isAuthenticated || !hasGoogleDriveAccess() || conflicts.length > 0) return;

    const prefs = getLocalPreferences();
    const serialized = JSON.stringify(prefs);
    if (serialized === lastSavedPrefsRef.current) return;

    lastSavedPrefsRef.current = serialized;
    setCloudSyncStatus("syncing");
    saveToDrive(DRIVE_FILE_PREFERENCES, prefs)
      .then(async () => {
        const checksum = await computeChecksum(prefs);
        localStorage.setItem(DRIVE_PREFS_CHECKSUM_KEY, checksum);
        localStorage.setItem(LAST_CLOUD_SAVE_KEY, new Date().toISOString());
        setCloudSyncStatus("synced");
      })
      .catch((err) => {
        setCloudSyncStatus(classifyDriveError(err));
      });
  }, [syncReady, isAuthenticated, conflicts.length]);

  useEffect(() => {
    if (!syncReady || !isAuthenticated || !hasGoogleDriveAccess()) return;

    const handler = () => pushPreferences();
    window.addEventListener("preferences-changed", handler);
    return () => window.removeEventListener("preferences-changed", handler);
  }, [pushPreferences, syncReady, isAuthenticated]);

  // --- Conflict resolution (roster only) ---
  const resolveConflict = useCallback(async (conflict: DriveConflict, choice: "drive" | "local") => {
    if (choice === "drive") {
      const driveResult = await loadFromDrive(DRIVE_FILE_ROSTER);
      if (driveResult?.data) {
        let driveData = driveResult.data as any;
        if (isLegacyFormat(driveData)) {
          driveData = migrateLegacyState(driveData);
        }
        const typedData = driveData as PersistedShiftData;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(typedData));
        const checksum = await computeChecksum(driveResult.data);
        localStorage.setItem(DRIVE_ROSTER_CHECKSUM_KEY, checksum);
        setState((prev) => ({ ...prev, ...typedData, syncStatus: "synced" }));
      }
    } else {
      const localData = await loadStateFromLocalStorage<PersistedShiftData>(LOCAL_STORAGE_KEY);
      if (localData) {
        await saveToDrive(DRIVE_FILE_ROSTER, localData);
        const checksum = await computeChecksum(localData);
        localStorage.setItem(DRIVE_ROSTER_CHECKSUM_KEY, checksum);
        localStorage.setItem(LAST_CLOUD_SAVE_KEY, new Date().toISOString());
      }
    }

    setConflicts((prev) => prev.filter((c) => c.type !== conflict.type));
  }, [state, setState]);

  const isSyncing = isAuthenticated && hasGoogleDriveAccess() && !syncReady;

  // Derive effective cloud status
  let effectiveCloudStatus = cloudSyncStatus;
  if (cloudSyncStatus === "idle") {
    const localCk = localStorage.getItem("tumbleweed-local-checksum");
    const cloudCk = localStorage.getItem(DRIVE_ROSTER_CHECKSUM_KEY);
    if (localCk && cloudCk && localCk === cloudCk) {
      effectiveCloudStatus = "synced";
    }
  }

  return {
    conflicts,
    resolveConflict,
    hasDriveAccess: hasGoogleDriveAccess(),
    isSyncing,
    cloudSyncStatus: effectiveCloudStatus,
    triggerSync,
  };
}
