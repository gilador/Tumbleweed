import { api } from "./apiClient";
import { LOCAL_STORAGE_KEY } from "./localStorageUtils";

interface LocalState {
  userShiftData?: { user: { name: string } }[];
}

/**
 * Migrates free-tier localStorage data to the server after upgrade.
 * Sends all staff members as ghosts to the server's migration endpoint.
 * Returns the number of users migrated, or null if nothing to migrate.
 */
export async function migrateLocalDataToServer(): Promise<number | null> {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;

  let state: LocalState;
  try {
    state = JSON.parse(raw);
  } catch {
    return null;
  }

  const staffMembers = state.userShiftData?.map((u) => ({ name: u.user.name })) ?? [];
  if (staffMembers.length === 0) return null;

  const result = await api.post<{ migrated: number }>("/teams/me/migrate", {
    staffMembers,
  });

  return result.migrated;
}
