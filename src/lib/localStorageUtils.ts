export const LOCAL_STORAGE_KEY = "pakal-shmira-shiftState";

// Checksum of the last roster data we pushed to / loaded from Drive.
// On load, we compare this with the checksum of Drive's current content.
// Different checksum → another device changed it → prompt user.
export const DRIVE_ROSTER_CHECKSUM_KEY = "tumbleweed-drive-roster-checksum";
// For preferences we always auto-sync, but track to avoid redundant pushes.
export const DRIVE_PREFS_CHECKSUM_KEY = "tumbleweed-drive-prefs-checksum";

// Timestamps for sync status display
export const LAST_LOCAL_SAVE_KEY = "tumbleweed-last-local-save";
export const LAST_CLOUD_SAVE_KEY = "tumbleweed-last-cloud-save";

export interface DrivePreferences {
  theme: string;
  lang: string;
  settings: { shareDebugInfo: boolean };
}

export function notifyPreferencesChanged(): void {
  window.dispatchEvent(new Event("preferences-changed"));
}

/**
 * Compute a simple checksum of a JSON-serializable value.
 * Uses SHA-256 via Web Crypto API (available in all modern browsers).
 * Falls back to a djb2 hash if crypto.subtle is unavailable.
 */
export async function computeChecksum(data: unknown): Promise<string> {
  const str = JSON.stringify(data);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback: djb2 hash
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

export async function loadStateFromLocalStorage<T>(
  key: string
): Promise<T | null> {
  try {
    const serializedState = localStorage.getItem(key);
    if (serializedState === null) {
      return null;
    }
    return JSON.parse(serializedState) as T;
  } catch (error) {
    console.error("Could not load state from localStorage:", error);
    throw error;
  }
}

export async function saveStateToLocalStorage<T>(
  key: string,
  state: T
): Promise<void> {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(key, serializedState);
  } catch (error) {
    console.error("Could not save state to localStorage:", error);
    throw error;
  }
}
