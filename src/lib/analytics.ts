import posthog from "posthog-js";
import { getSetting } from "./settings";

type CoreEventMap = {
  "schedule-created": { postCount: number };
  "optimizer-run": { staffCount: number; constraintCount: number; durationMs: number };
  "optimizer-run-multi": { staffCount: number; constraintCount: number; durationMs: number };
  "schedule-published": { filledSlots: number; totalSlots: number };
  "staff-invited": { count: number };
  "availability-received": { dayCount: number };
  "weekly-view-opened": { mode: "7d" };
  "pdf-downloaded": { type: "roster" | "staff"; rosterCount: number };
  "whatsapp-shared": { type: "roster" | "staff" };
  "schedule-view-mode-changed": { from: "24h" | "7d"; to: "24h" | "7d" };
  "multi-select-start": {
    kind: "staff" | "posts";
    entry: "row-click" | "checkbox" | "cmd-a" | "select-all";
  };
  "multi-select-cancel": {
    kind: "staff" | "posts";
    via: "cancel" | "deselect-all" | "kind-switch";
  };
  "post-rename": { from: string; to: string };
  "post-add": { totalAfter: number };
  "post-delete-single": Record<string, never>;
  "post-delete-bulk": { count: number };
  "user-delete-single": Record<string, never>;
  "user-delete-bulk": { count: number };
  "cmd-a-select-all": { kind: "staff" | "posts"; count: number };
  "intensity-change": {
    from: number;
    to: number;
    surface: "desktop" | "mobile";
    confirmed: boolean;
  };
  "intensity-confirm-cancel": {
    from: number;
    to: number;
    surface: "desktop" | "mobile";
  };
  "intensity-undo-click": {
    from: number;
    to: number;
    surface: "desktop" | "mobile";
  };
  "group-toggle-change": {
    from: "time" | "position";
    to: "time" | "position";
  };
  "staff-detail-open": { staffId: string };
  "staff-detail-back": Record<string, never>;
  "staff-multi-select-entered": { source: "mobile-long-press" };
  "staff-bulk-action": {
    action: "all-available" | "all-unavailable" | "weekdays-only" | "weekends-only";
  };
  "reset-availability": { userCount: number };
  "user-rename-start": { surface: "desktop" | "mobile" };
  "context-menu-open": { kind: "staff" | "posts" };
  "context-menu-action": {
    kind: "staff" | "posts";
    action: "select" | "assign-worker" | "rename" | "delete" | "copy-name";
  };
  "hour-strip-click": { chipIndex: number };
  "horizontal-scroll-start": Record<string, never>;
  "schedule-grid-chevron-click": { direction: "start" | "end" };
};

type CoreEventName = keyof CoreEventMap;

let initialized = false;

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

  if (!key) return;

  const debugMode = getSetting("shareDebugInfo");

  posthog.init(key, {
    api_host: host,
    ui_host: "https://eu.posthog.com",
    persistence: debugMode ? "localStorage+cookie" : "memory",
    ip: debugMode,
    disable_session_recording: !debugMode,
    respect_dnt: true,
    property_denylist: debugMode ? [] : ["$ip"],
    capture_pageview: true,
    capture_pageleave: true,
  });

  initialized = true;
}

export function enableDebugMode(email: string, teamId: string) {
  if (!initialized) return;
  posthog.identify(email, { email, teamId });
  posthog.set_config({
    persistence: "localStorage+cookie",
    ip: true,
    disable_session_recording: false,
    property_denylist: [],
  });
}

export function disableDebugMode() {
  if (!initialized) return;
  posthog.reset();
  posthog.set_config({
    persistence: "memory",
    ip: false,
    disable_session_recording: true,
    property_denylist: ["$ip"],
  });
}

export function setSuperProperties(props: Record<string, string>) {
  if (!initialized) return;
  posthog.register(props);
}

export function trackEvent<E extends CoreEventName>(
  event: E,
  properties: CoreEventMap[E]
) {
  if (!initialized) return;
  posthog.capture(event, properties);
}
