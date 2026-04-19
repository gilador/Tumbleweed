import posthog from "posthog-js";
import { getSetting } from "./settings";

type CoreEventMap = {
  "schedule-created": { postCount: number };
  "optimizer-run": { staffCount: number; constraintCount: number };
  "optimizer-run-multi": { staffCount: number; constraintCount: number };
  "schedule-published": { filledSlots: number; totalSlots: number };
  "staff-invited": { count: number };
  "availability-received": { dayCount: number };
  "weekly-view-opened": { mode: "7d" };
  "pdf-downloaded": { type: "roster" | "staff"; rosterCount: number };
  "whatsapp-shared": { type: "roster" | "staff" };
  "schedule-view-mode-changed": { from: "24h" | "7d"; to: "24h" | "7d" };
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
