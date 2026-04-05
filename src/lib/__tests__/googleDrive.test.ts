/**
 * Unit tests for Google Drive token handling and request logic.
 */

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

// Mock window events
const mockDispatchEvent = jest.fn();
Object.defineProperty(global, "window", {
  value: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: mockDispatchEvent,
  },
});

import {
  setGoogleAccessToken,
  clearGoogleAccessToken,
  hasGoogleDriveAccess,
  getFileMetadata,
  DRIVE_FILE_ROSTER,
} from "../googleDrive";

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});

describe("googleDrive", () => {
  describe("token management", () => {
    it("setGoogleAccessToken stores token and dispatches event", () => {
      setGoogleAccessToken("test-token");
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "tumbleweed_google_access_token",
        "test-token"
      );
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "storage-token-renewed" })
      );
    });

    it("clearGoogleAccessToken removes token", () => {
      setGoogleAccessToken("test-token");
      clearGoogleAccessToken();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "tumbleweed_google_access_token"
      );
      expect(hasGoogleDriveAccess()).toBe(false);
    });

    it("hasGoogleDriveAccess returns true when token exists", () => {
      setGoogleAccessToken("test-token");
      expect(hasGoogleDriveAccess()).toBe(true);
    });
  });

  describe("driveRequest on 401", () => {
    it("throws DRIVE_TOKEN_EXPIRED on 401 and clears token", async () => {
      setGoogleAccessToken("old-token");

      mockFetch.mockResolvedValueOnce({ status: 401, ok: false });

      await expect(getFileMetadata(DRIVE_FILE_ROSTER)).rejects.toThrow(
        "DRIVE_TOKEN_EXPIRED"
      );

      // Token should be cleared
      expect(hasGoogleDriveAccess()).toBe(false);
    });
  });

  describe("driveRequest on 403", () => {
    it("throws DRIVE_PERMISSION_ERROR on 403", async () => {
      setGoogleAccessToken("valid-token");

      mockFetch.mockResolvedValueOnce({ status: 403, ok: false });

      await expect(getFileMetadata(DRIVE_FILE_ROSTER)).rejects.toThrow(
        "DRIVE_PERMISSION_ERROR"
      );
    });
  });
});
