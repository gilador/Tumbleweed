import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth, API_URL } from "../lib/auth";
import { trackEvent } from "../lib/analytics";
import type { SSEEvent, SSEEventType } from "@tumbleweed/shared";

type EventHandler = (event: SSEEvent) => void;

interface UseTeamEventsOptions {
  onEvent?: EventHandler;
  enabled?: boolean;
}

export function useTeamEvents({ onEvent, enabled = true }: UseTeamEventsOptions = {}) {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!token || !enabled) return;

    // Close existing connection
    eventSourceRef.current?.close();

    const url = `${API_URL}/api/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    const eventTypes: SSEEventType[] = [
      "availability-submitted",
      "schedule-state-changed",
      "schedule-published",
      "user-claimed",
      "user-updated",
    ];

    for (const eventType of eventTypes) {
      es.addEventListener(eventType, (e) => {
        try {
          const data = JSON.parse(e.data) as SSEEvent;
          if (data.type === "availability-submitted") {
            trackEvent("availability-received", { dayCount: 1 });
          }
          onEventRef.current?.(data);
        } catch {
          // Ignore malformed events
        }
      });
    }

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      // Reconnect with backoff
      retryTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
  }, [token, enabled]);

  useEffect(() => {
    if (isAuthenticated && enabled) {
      connect();
    }

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [isAuthenticated, enabled, connect]);

  return { isConnected };
}
