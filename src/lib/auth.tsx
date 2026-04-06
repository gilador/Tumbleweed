import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { setGoogleAccessToken, clearGoogleAccessToken, hasGoogleDriveAccess } from "./googleDrive";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
export const isGoogleAuthAvailable = !!GOOGLE_CLIENT_ID;
const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file";
const ACCESS_TOKEN_KEY = "tumbleweed_google_access_token";
const USER_PROFILE_KEY = "tumbleweed_google_user";

// Server API URL — used by apiClient and server-integration hooks (paid tier)
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Google Identity Services types (loaded dynamically)
declare namespace google.accounts.oauth2 {
  interface TokenClient {
    requestAccessToken: (overrides?: { prompt?: string }) => void;
  }
  interface TokenResponse {
    access_token: string;
    error?: string;
    error_description?: string;
  }
  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
  }): TokenClient;
  function revoke(token: string, callback: () => void): void;
}

interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

interface AuthContextValue {
  token: string | null;
  user: GoogleUser | null;
  isAuthenticated: boolean;
  signInWithGoogle: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  user: null,
  isAuthenticated: false,
  signInWithGoogle: () => {},
  signOut: () => {},
});

// Load the Google Identity Services script
function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById("gis-script")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

// Fetch user profile using the access token
async function fetchUserProfile(accessToken: string): Promise<GoogleUser> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch user profile");
  const data = await res.json();
  return { name: data.name, email: data.email, picture: data.picture };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(() => {
    const stored = localStorage.getItem(USER_PROFILE_KEY);
    if (stored && hasGoogleDriveAccess()) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    return null;
  });

  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);
  const gisReadyRef = useRef(false);

  // Listen for token changes from other tabs (popup/redirect login)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === ACCESS_TOKEN_KEY && e.newValue) {
        // Token was set in another tab — refresh user profile
        fetchUserProfile(e.newValue)
          .then((profile) => {
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
            setUser(profile);
          })
          .catch(() => {});
      }
      if (e.key === ACCESS_TOKEN_KEY && !e.newValue) {
        // Token was removed
        setUser(null);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Also listen for same-tab token changes via custom event
  useEffect(() => {
    const handleTokenRenewed = () => {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (token && !user) {
        fetchUserProfile(token)
          .then((profile) => {
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
            setUser(profile);
          })
          .catch(() => {});
      }
    };
    window.addEventListener("storage-token-renewed", handleTokenRenewed);
    return () => window.removeEventListener("storage-token-renewed", handleTokenRenewed);
  }, [user]);

  // Initialize GIS on mount
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    loadGisScript().then(() => {
      tokenClientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (response: google.accounts.oauth2.TokenResponse) => {
          if (response.error) {
            console.error("Google OAuth error:", response.error);
            return;
          }
          const accessToken = response.access_token;
          setGoogleAccessToken(accessToken);
          try {
            const profile = await fetchUserProfile(accessToken);
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
            setUser(profile);
          } catch (err) {
            console.error("Failed to fetch profile:", err);
          }
        },
      });
      gisReadyRef.current = true;
    });
  }, []);

  const signInWithGoogle = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn("VITE_GOOGLE_CLIENT_ID is not configured — Google sign-in unavailable");
      return;
    }
    if (!gisReadyRef.current || !tokenClientRef.current) {
      console.error("Google Identity Services not ready");
      return;
    }
    tokenClientRef.current.requestAccessToken();
  }, []);

  const signOut = useCallback(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      google.accounts.oauth2.revoke(token, () => {});
    }
    clearGoogleAccessToken();
    localStorage.removeItem(USER_PROFILE_KEY);
    setUser(null);
  }, []);

  // Expose the raw access token for server-integration hooks (paid tier)
  const token = hasGoogleDriveAccess() ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!user,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
