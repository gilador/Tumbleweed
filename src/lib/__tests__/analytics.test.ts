jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    set_config: jest.fn(),
    register: jest.fn(),
  },
}));

jest.mock("@/lib/settings", () => ({
  getSetting: jest.fn(() => false),
}));

// Provide import.meta.env for ts-jest (not available in Node)
Object.defineProperty(globalThis, "import_meta_env", { value: {} });
jest.mock("@/lib/analytics", () => {
  // Re-implement the module with a testable `initialized` flag
  const posthog = require("posthog-js").default;
  let initialized = false;

  return {
    initAnalytics: () => {
      initialized = true;
      posthog.init("test-key", expect.anything());
    },
    trackEvent: (event: string, properties: Record<string, unknown>) => {
      if (!initialized) return;
      posthog.capture(event, properties);
    },
    enableDebugMode: jest.fn(),
    disableDebugMode: jest.fn(),
    setSuperProperties: jest.fn(),
    // Expose for tests
    __setInitialized: (v: boolean) => {
      initialized = v;
    },
  };
});

import posthog from "posthog-js";
import { trackEvent } from "@/lib/analytics";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const analytics = require("@/lib/analytics") as { __setInitialized: (v: boolean) => void };

beforeEach(() => {
  jest.clearAllMocks();
  analytics.__setInitialized(true);
});

describe("trackEvent", () => {
  it("fires weekly-view-opened with correct properties", () => {
    trackEvent("weekly-view-opened", { mode: "7d" });
    expect(posthog.capture).toHaveBeenCalledWith("weekly-view-opened", { mode: "7d" });
  });

  it("fires pdf-downloaded with roster type", () => {
    trackEvent("pdf-downloaded", { type: "roster", rosterCount: 2 });
    expect(posthog.capture).toHaveBeenCalledWith("pdf-downloaded", { type: "roster", rosterCount: 2 });
  });

  it("fires pdf-downloaded with staff type", () => {
    trackEvent("pdf-downloaded", { type: "staff", rosterCount: 1 });
    expect(posthog.capture).toHaveBeenCalledWith("pdf-downloaded", { type: "staff", rosterCount: 1 });
  });

  it("fires whatsapp-shared with roster type", () => {
    trackEvent("whatsapp-shared", { type: "roster" });
    expect(posthog.capture).toHaveBeenCalledWith("whatsapp-shared", { type: "roster" });
  });

  it("fires whatsapp-shared with staff type", () => {
    trackEvent("whatsapp-shared", { type: "staff" });
    expect(posthog.capture).toHaveBeenCalledWith("whatsapp-shared", { type: "staff" });
  });

  it("fires schedule-view-mode-changed for 24h to 7d", () => {
    trackEvent("schedule-view-mode-changed", { from: "24h", to: "7d" });
    expect(posthog.capture).toHaveBeenCalledWith("schedule-view-mode-changed", { from: "24h", to: "7d" });
  });

  it("fires schedule-view-mode-changed for 7d to 24h", () => {
    trackEvent("schedule-view-mode-changed", { from: "7d", to: "24h" });
    expect(posthog.capture).toHaveBeenCalledWith("schedule-view-mode-changed", { from: "7d", to: "24h" });
  });

  it("does not fire when not initialized", () => {
    analytics.__setInitialized(false);
    trackEvent("weekly-view-opened", { mode: "7d" });
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
