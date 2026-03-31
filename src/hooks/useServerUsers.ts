import { useCallback } from "react";
import { useAuth } from "../lib/auth";
import { api, ApiError } from "../lib/apiClient";
import { trackEvent } from "../lib/analytics";

interface ServerUser {
  id: string;
  teamId: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
}

/**
 * Server-aware user management for paid tier.
 * When authenticated, calls the API to manage ghost users on the server.
 * Returns null helpers when not authenticated (free tier uses local Recoil state).
 */
export function useServerUsers() {
  const { isAuthenticated } = useAuth();

  const createGhost = useCallback(
    async (name: string, role: "staff" | "co-manager" = "staff"): Promise<ServerUser | null> => {
      if (!isAuthenticated) return null;
      return api.post<ServerUser>("/users", { name, role });
    },
    [isAuthenticated]
  );

  const assignEmail = useCallback(
    async (userId: string, email: string): Promise<{ magicLinkSent: boolean } | null> => {
      if (!isAuthenticated) return null;
      const result = await api.patch<ServerUser & { magicLinkSent: boolean }>(`/users/${userId}`, { email });
      if (result?.magicLinkSent) {
        trackEvent("staff-invited", { count: 1 });
      }
      return result;
    },
    [isAuthenticated]
  );

  const removeUser = useCallback(
    async (userId: string): Promise<boolean> => {
      if (!isAuthenticated) return false;
      try {
        await api.delete(`/users/${userId}`);
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return false;
        throw e;
      }
    },
    [isAuthenticated]
  );

  const listUsers = useCallback(async (): Promise<ServerUser[]> => {
    if (!isAuthenticated) return [];
    return api.get<ServerUser[]>("/users");
  }, [isAuthenticated]);

  return {
    isPaidTier: isAuthenticated,
    createGhost,
    assignEmail,
    removeUser,
    listUsers,
  };
}
