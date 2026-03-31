import { useState, useCallback } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/apiClient";
import { trackEvent } from "../lib/analytics";
import type { ScheduleState } from "@tumbleweed/shared";

interface Schedule {
  id: string;
  teamId: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  state: ScheduleState;
  posts: unknown;
  hours: unknown;
  createdAt: string;
}

interface AvailabilityEntry {
  id: string;
  scheduleId: string;
  userId: string;
  constraints: unknown;
  submittedBy: string;
  submittedAt: string;
}

/**
 * Server-aware schedule management for paid tier.
 * Manages schedule lifecycle: create, state transitions, availability, assignments.
 */
export function useServerSchedule() {
  const { isAuthenticated } = useAuth();
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);

  const createSchedule = useCallback(
    async (dateRangeStart: string, dateRangeEnd: string, posts: unknown, hours: unknown) => {
      if (!isAuthenticated) return null;
      const schedule = await api.post<Schedule>("/schedules", {
        dateRangeStart,
        dateRangeEnd,
        posts,
        hours,
      });
      setActiveSchedule(schedule);
      trackEvent("schedule-created", { postCount: Array.isArray(posts) ? posts.length : 0 });
      return schedule;
    },
    [isAuthenticated]
  );

  const transitionState = useCallback(
    async (scheduleId: string, newState: ScheduleState) => {
      if (!isAuthenticated) return null;
      const updated = await api.patch<Schedule>(`/schedules/${scheduleId}`, {
        state: newState,
      });
      setActiveSchedule(updated);
      return updated;
    },
    [isAuthenticated]
  );

  const getSchedules = useCallback(async () => {
    if (!isAuthenticated) return [];
    return api.get<Schedule[]>("/schedules");
  }, [isAuthenticated]);

  const getAvailability = useCallback(
    async (scheduleId: string) => {
      if (!isAuthenticated) return [];
      return api.get<AvailabilityEntry[]>(
        `/schedules/${scheduleId}/availability`
      );
    },
    [isAuthenticated]
  );

  const setGhostAvailability = useCallback(
    async (scheduleId: string, userId: string, constraints: unknown) => {
      if (!isAuthenticated) return null;
      return api.post<AvailabilityEntry>(
        `/schedules/${scheduleId}/availability/${userId}`,
        { constraints }
      );
    },
    [isAuthenticated]
  );

  const publishAssignments = useCallback(
    async (scheduleId: string, assignments: unknown) => {
      if (!isAuthenticated) return null;
      const result = await api.post(`/schedules/${scheduleId}/assignments`, { assignments });
      const assignmentArr = Array.isArray(assignments) ? assignments : [];
      const totalSlots = assignmentArr.length;
      const filledSlots = assignmentArr.filter((a: unknown) => a != null).length;
      trackEvent("schedule-published", { filledSlots, totalSlots });
      return result;
    },
    [isAuthenticated]
  );

  return {
    isPaidTier: isAuthenticated,
    activeSchedule,
    createSchedule,
    transitionState,
    getSchedules,
    getAvailability,
    setGhostAvailability,
    publishAssignments,
  };
}
