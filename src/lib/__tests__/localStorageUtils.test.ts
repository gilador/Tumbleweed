/**
 * Unit tests for localStorage utilities.
 */

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

const mockDispatchEvent = jest.fn();
Object.defineProperty(global, "window", {
  value: { dispatchEvent: mockDispatchEvent },
});

// Mock crypto.subtle for checksum tests
Object.defineProperty(global, "crypto", {
  value: {
    subtle: {
      digest: jest.fn(async (_algo: string, data: ArrayBuffer) => {
        // Simple mock: return a fixed-length buffer based on input length
        const arr = new Uint8Array(32);
        const view = new Uint8Array(data as ArrayBuffer);
        for (let i = 0; i < view.length; i++) {
          arr[i % 32] ^= view[i];
        }
        return arr.buffer;
      }),
    },
  },
});

import {
  notifyPreferencesChanged,
  loadStateFromLocalStorage,
  saveStateToLocalStorage,
  computeChecksum,
  LOCAL_STORAGE_KEY,
  DRIVE_ROSTER_CHECKSUM_KEY,
  DRIVE_PREFS_CHECKSUM_KEY,
} from "../localStorageUtils";

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});

describe("localStorageUtils", () => {
  describe("notifyPreferencesChanged", () => {
    it("dispatches preferences-changed event", () => {
      notifyPreferencesChanged();
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "preferences-changed" })
      );
    });
  });

  describe("loadStateFromLocalStorage", () => {
    it("returns null for missing key", async () => {
      const result = await loadStateFromLocalStorage("nonexistent");
      expect(result).toBeNull();
    });

    it("returns parsed data for existing key", async () => {
      localStorageMock.setItem("test-key", JSON.stringify({ foo: "bar" }));
      const result = await loadStateFromLocalStorage("test-key");
      expect(result).toEqual({ foo: "bar" });
    });
  });

  describe("saveStateToLocalStorage", () => {
    it("serializes and saves data", async () => {
      await saveStateToLocalStorage("test-key", { hello: "world" });
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "test-key",
        '{"hello":"world"}'
      );
    });
  });

  describe("computeChecksum", () => {
    it("returns a hex string", async () => {
      const hash = await computeChecksum({ foo: "bar" });
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it("returns same hash for same input", async () => {
      const h1 = await computeChecksum({ a: 1, b: 2 });
      const h2 = await computeChecksum({ a: 1, b: 2 });
      expect(h1).toBe(h2);
    });

    it("returns different hash for different input", async () => {
      const h1 = await computeChecksum({ a: 1 });
      const h2 = await computeChecksum({ a: 2 });
      expect(h1).not.toBe(h2);
    });
  });

  describe("exported constants", () => {
    it("exports correct keys", () => {
      expect(LOCAL_STORAGE_KEY).toBe("pakal-shmira-shiftState");
      expect(DRIVE_ROSTER_CHECKSUM_KEY).toBe("tumbleweed-drive-roster-checksum");
      expect(DRIVE_PREFS_CHECKSUM_KEY).toBe("tumbleweed-drive-prefs-checksum");
    });
  });
});
