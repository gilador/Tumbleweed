import { useRecoilState } from "recoil";
import { shiftState } from "@/stores/shiftStore";
import { UniqueString, UserShiftData } from "@/models";
import { encodeFlatHour, parseFlatHour } from "@/service/weeklyScheduleUtils";
import { getTodayISO } from "@/service/dayLabelUtils";

export function useScheduleMode() {
  const [state, setState] = useRecoilState(shiftState);

  const switchTo7D = () => {
    setState((prev) => {
      // If we have cached weekly state, restore it — but preserve current users
      if (prev.cachedWeeklyState) {
        const cachedHours = prev.cachedWeeklyState.hours;
        const cachedUserMap = new Map(
          prev.cachedWeeklyState.userShiftData.map((u) => [u.user.id, u])
        );

        // Merge: keep current users, restore cached constraints where possible
        const mergedUserShiftData: UserShiftData[] = prev.userShiftData.map(
          (currentUser) => {
            const cachedUser = cachedUserMap.get(currentUser.user.id);
            if (cachedUser) {
              // User existed in cache — restore their 7D constraints
              return cachedUser;
            }
            // New user added while in 24H — create default 7D constraints
            const weeklyConstraints = (prev.posts || []).map((post) =>
              cachedHours.map((hour) => ({
                postID: post.id,
                hourID: hour.id,
                availability: true,
              }))
            );
            return { ...currentUser, constraints: weeklyConstraints };
          }
        );

        return {
          ...prev,
          scheduleMode: "7d" as const,
          hours: cachedHours,
          assignments: (prev.posts || []).map(() => cachedHours.map(() => null)),
          userShiftData: mergedUserShiftData,
          startDate: prev.cachedWeeklyState.startDate,
          cachedWeeklyState: null,
        };
      }

      // Otherwise, duplicate current single-day state × 7
      const singleDayHours = prev.hours;
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

      // Duplicate constraints × 7 for each user
      const weeklyUserShiftData: UserShiftData[] = prev.userShiftData.map(
        (userData) => {
          const weeklyConstraints = (prev.posts || []).map(
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
          };
        }
      );

      // Clear assignments for the new weekly structure
      const weeklyAssignments = (prev.posts || []).map(() =>
        weeklyHours.map(() => null)
      );

      return {
        ...prev,
        scheduleMode: "7d" as const,
        startDate,
        hours: weeklyHours,
        userShiftData: weeklyUserShiftData,
        assignments: weeklyAssignments,
        manuallyEditedSlots: {},
        customCellDisplayNames: {},
        cachedWeeklyState: null,
      };
    });
  };

  const switchTo24H = () => {
    setState((prev) => {
      const shiftsPerDay = prev.hours.length / 7;

      // Extract day 0 hours (strip day prefix)
      const day0Hours: UniqueString[] = prev.hours
        .slice(0, shiftsPerDay)
        .map((h, i) => ({
          id: `hour-${i + 1}`,
          value: parseFlatHour(h.value).time,
        }));

      // Extract day 0 constraints for each user
      const day0UserShiftData: UserShiftData[] = prev.userShiftData.map(
        (userData) => {
          const day0Constraints = (prev.posts || []).map(
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
          };
        }
      );

      // Clear assignments
      const day0Assignments = (prev.posts || []).map(() =>
        day0Hours.map(() => null)
      );

      return {
        ...prev,
        scheduleMode: "24h" as const,
        hours: day0Hours,
        userShiftData: day0UserShiftData,
        assignments: day0Assignments,
        manuallyEditedSlots: {},
        customCellDisplayNames: {},
        // Cache the weekly state for potential restore
        cachedWeeklyState: {
          hours: prev.hours,
          assignments: prev.assignments,
          userShiftData: prev.userShiftData,
          startDate: prev.startDate || getTodayISO(),
        },
      };
    });
  };

  const updateStartDate = (date: string) => {
    setState((prev) => ({
      ...prev,
      startDate: date,
    }));
  };

  return {
    scheduleMode: state.scheduleMode,
    startDate: state.startDate,
    switchTo7D,
    switchTo24H,
    updateStartDate,
  };
}
