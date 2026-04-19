import { useRecoilState } from "recoil";
import { shiftState, getActiveRosterFromState, updateActiveRoster } from "@/stores/shiftStore";
import { UniqueString, UserShiftData } from "@/models";
import { encodeFlatHour, parseFlatHour } from "@/service/weeklyScheduleUtils";
import { getTodayISO } from "@/service/dayLabelUtils";
import { trackEvent } from "@/lib/analytics";

export function useScheduleMode() {
  const [state, setState] = useRecoilState(shiftState);
  const activeRoster = getActiveRosterFromState(state);

  const switchTo7D = () => {
    setState((prev) => {
      const roster = getActiveRosterFromState(prev);
      const activeRosterId = prev.activeRosterId;

      // If we have cached weekly state, restore it — but preserve current users
      if (roster.cachedWeeklyState) {
        const cachedHours = roster.cachedWeeklyState.hours;
        const cachedUserMap = new Map(
          roster.cachedWeeklyState.userShiftData.map((u) => [u.user.id, u])
        );

        // Merge: keep current users, restore cached constraints where possible
        const mergedUserShiftData: UserShiftData[] = prev.userShiftData.map(
          (currentUser) => {
            const cachedUser = cachedUserMap.get(currentUser.user.id);
            if (cachedUser) {
              return {
                ...cachedUser,
                constraintsByRoster: {
                  ...currentUser.constraintsByRoster,
                  [activeRosterId]: cachedUser.constraints,
                },
              };
            }
            // New user added while in 24H — create default 7D constraints
            const weeklyConstraints = (roster.posts || []).map((post) =>
              cachedHours.map((hour) => ({
                postID: post.id,
                hourID: hour.id,
                availability: true,
              }))
            );
            return {
              ...currentUser,
              constraints: weeklyConstraints,
              constraintsByRoster: {
                ...currentUser.constraintsByRoster,
                [activeRosterId]: weeklyConstraints,
              },
            };
          }
        );

        return {
          ...updateActiveRoster(prev, (r) => ({
            ...r,
            scheduleMode: "7d" as const,
            hours: cachedHours,
            assignments: (r.posts || []).map(() => cachedHours.map(() => null)),
            startDate: r.cachedWeeklyState!.startDate,
            cachedWeeklyState: null,
          })),
          userShiftData: mergedUserShiftData,
        };
      }

      // Otherwise, duplicate current single-day state x 7
      const singleDayHours = roster.hours;
      const startDate = getTodayISO();

      // Build flat 7-day hours
      const weeklyHours: UniqueString[] = [];
      for (let day = 0; day < 7; day++) {
        for (let i = 0; i < singleDayHours.length; i++) {
          weeklyHours.push({
            id: `d${day}-h${i}`,
            value: encodeFlatHour(day, singleDayHours[i].value),
          });
        }
      }

      // Duplicate constraints x 7 for each user
      const weeklyUserShiftData: UserShiftData[] = prev.userShiftData.map(
        (userData) => {
          const weeklyConstraints = (roster.posts || []).map(
            (post, postIndex) => {
              const singleDayPostConstraints =
                userData.constraints[postIndex] || [];
              const allDayConstraints = [];
              for (let day = 0; day < 7; day++) {
                for (let h = 0; h < singleDayPostConstraints.length; h++) {
                  allDayConstraints.push({
                    postID: post.id,
                    hourID: weeklyHours[day * singleDayHours.length + h].id,
                    availability: singleDayPostConstraints[h]?.availability ?? true,
                  });
                }
              }
              return allDayConstraints;
            }
          );
          return {
            ...userData,
            constraints: weeklyConstraints,
            constraintsByRoster: {
              ...userData.constraintsByRoster,
              [activeRosterId]: weeklyConstraints,
            },
          };
        }
      );

      // Clear assignments for the new weekly structure
      const weeklyAssignments = (roster.posts || []).map(() =>
        weeklyHours.map(() => null)
      );

      return {
        ...updateActiveRoster(prev, (r) => ({
          ...r,
          scheduleMode: "7d" as const,
          startDate,
          hours: weeklyHours,
          assignments: weeklyAssignments,
          manuallyEditedSlots: {},
          customCellDisplayNames: {},
          cachedWeeklyState: null,
        })),
        userShiftData: weeklyUserShiftData,
      };
    });
    trackEvent("weekly-view-opened", { mode: "7d" });
    trackEvent("schedule-view-mode-changed", { from: "24h", to: "7d" });
  };

  const switchTo24H = () => {
    setState((prev) => {
      const roster = getActiveRosterFromState(prev);
      const activeRosterId = prev.activeRosterId;
      const shiftsPerDay = roster.hours.length / 7;

      // Extract day 0 hours (strip day prefix)
      const day0Hours: UniqueString[] = roster.hours
        .slice(0, shiftsPerDay)
        .map((h, i) => ({
          id: `hour-${i + 1}`,
          value: parseFlatHour(h.value).time,
        }));

      // Extract day 0 constraints for each user
      const day0UserShiftData: UserShiftData[] = prev.userShiftData.map(
        (userData) => {
          const day0Constraints = (roster.posts || []).map(
            (_post, postIndex) => {
              return userData.constraints[postIndex]?.slice(0, shiftsPerDay).map(
                (c, h) => ({
                  ...c,
                  hourID: day0Hours[h].id,
                })
              ) || [];
            }
          );
          return {
            ...userData,
            constraints: day0Constraints,
            constraintsByRoster: {
              ...userData.constraintsByRoster,
              [activeRosterId]: day0Constraints,
            },
          };
        }
      );

      // Clear assignments
      const day0Assignments = (roster.posts || []).map(() =>
        day0Hours.map(() => null)
      );

      return {
        ...updateActiveRoster(prev, (r) => ({
          ...r,
          scheduleMode: "24h" as const,
          hours: day0Hours,
          assignments: day0Assignments,
          manuallyEditedSlots: {},
          customCellDisplayNames: {},
          // Cache the weekly state for potential restore
          cachedWeeklyState: {
            hours: r.hours,
            assignments: r.assignments,
            userShiftData: prev.userShiftData,
            startDate: r.startDate || getTodayISO(),
          },
        })),
        userShiftData: day0UserShiftData,
      };
    });
    trackEvent("schedule-view-mode-changed", { from: "7d", to: "24h" });
  };

  const updateStartDate = (date: string) => {
    setState((prev) =>
      updateActiveRoster(prev, (r) => ({
        ...r,
        startDate: date,
      }))
    );
  };

  return {
    scheduleMode: activeRoster.scheduleMode,
    startDate: activeRoster.startDate,
    switchTo7D,
    switchTo24H,
    updateStartDate,
  };
}
