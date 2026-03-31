import { useEffect, useRef } from "react";
import { useRecoilState } from "recoil";
import { shiftState, PersistedShiftData } from "../stores/shiftStore";
import {
  loadStateFromLocalStorage,
  LOCAL_STORAGE_KEY,
} from "../lib/localStorageUtils";
import { UserShiftData } from "../models";
import {
  defaultPosts,
  OPERATION_START_TIME,
  OPERATION_END_TIME,
  MINIMUM_REST_TIME,
  DEFAULT_STAFF_COUNT,
} from "../constants/shiftManagerConstants";
import {
  generateDynamicHours,
  getDefaultConstraints,
} from "../service/shiftManagerUtils";

export function useShiftManagerInitialization() {
  const [recoilState, setRecoilState] = useRecoilState(shiftState);
  const lastAppliedConstraintsSignature = useRef<string | null>(null);

  // Effect for initial loading from localStorage AND setting default workers if needed
  useEffect(() => {
    const isMounted = { current: true };
    console.log(
      "[ShiftManager useEffect] Initial data setup. Current recoilState:",
      recoilState
    );

    const setupInitialData = async () => {
      console.log("[ShiftManager useEffect] setupInitialData: Starting.");
      // 1. Set to syncing
      if (isMounted.current) {
        setRecoilState((prev) => {
          console.log(
            "[ShiftManager useEffect] setupInitialData: Setting syncStatus to 'syncing'. Prev state:",
            prev
          );
          // Ensure assignments is initialized here if not already, based on defaultPosts/Hours
          const initialAssignments =
            prev.assignments && prev.assignments.length > 0
              ? prev.assignments
              : defaultPosts.map(() => [].map(() => null));
          return {
            ...prev,
            syncStatus: "syncing",
            assignments: initialAssignments,
            manuallyEditedSlots: prev.manuallyEditedSlots || {},
            customCellDisplayNames: prev.customCellDisplayNames || {},
          };
        });
      }

      try {
        // 2. Try loading from localStorage
        const savedData = await loadStateFromLocalStorage<PersistedShiftData>(
          LOCAL_STORAGE_KEY
        );

        if (!isMounted.current) return;

        // Generate dynamic hours based on operation parameters
        console.log(
          "useShiftManagerInitialization: Generating dynamic hours with parameters:",
          {
            startTime: OPERATION_START_TIME,
            endTime: OPERATION_END_TIME,
            postCount: defaultPosts.length,
            staffCount: DEFAULT_STAFF_COUNT,
            minimumRestTime: MINIMUM_REST_TIME,
          }
        );

        const dynamicHours = generateDynamicHours(
          OPERATION_START_TIME,
          OPERATION_END_TIME,
          defaultPosts.length,
          DEFAULT_STAFF_COUNT,
          MINIMUM_REST_TIME
        );

        console.log(
          "useShiftManagerInitialization: Generated dynamic hours:",
          dynamicHours
        );

        if (savedData && savedData.hasInitialized) {
          console.log(
            `[ShiftManager useEffect] setupInitialData: Found saved data. Setting state.`,
            savedData
          );

          console.log(
            "useShiftManagerInitialization: Saved hours vs dynamic hours comparison:",
            {
              savedHours: savedData.hours,
              dynamicHours: dynamicHours,
              usingSavedHours: !!savedData.hours,
            }
          );

          // CRITICAL FIX: Use saved hours and fix constraint inconsistencies
          const savedHours = savedData.hours || [];
          const hoursToUse = savedHours.length > 0 ? savedHours : dynamicHours;

          // Fix user constraints to have consistent hourIDs matching saved hours
          const adjustedUserShiftData = (savedData.userShiftData || []).map(
            (userData) => {
              // Fix constraint hourIDs to match saved hours structure
              const updatedConstraints = (savedData.posts || []).map(
                (post, postIndex) => {
                  return hoursToUse.map((hour, hourIndex) => {
                    // Try to preserve existing constraint availability, but fix the hourID
                    const existingConstraint =
                      userData.constraints?.[postIndex]?.[hourIndex];
                    return {
                      postID: post.id,
                      hourID: hour.id, // Use correct hourID from saved hours
                      availability: existingConstraint?.availability ?? true, // Preserve availability
                    };
                  });
                }
              );

              return {
                ...userData,
                constraints: updatedConstraints,
              };
            }
          );

          console.log(
            "🔄 [useShiftManagerInitialization] Loading saved state and fixing constraint IDs:",
            {
              savedHoursCount: savedHours.length,
              dynamicHoursCount: dynamicHours.length,
              usingSavedHours: savedHours.length > 0,
              usersUpdated: adjustedUserShiftData.length,
              preservingAssignments: true,
            }
          );

          setRecoilState((prev) => ({
            ...prev,
            posts: savedData.posts || [],
            hours: hoursToUse, // Use saved hours if available, otherwise dynamic
            userShiftData: adjustedUserShiftData,
            assignments:
              savedData.assignments ||
              (savedData.posts || []).map(() => hoursToUse.map(() => null)),
            hasInitialized: true,
            syncStatus: "syncing",
            manuallyEditedSlots: savedData.manuallyEditedSlots || {},
            customCellDisplayNames: savedData.customCellDisplayNames || {},
            // Backward compat: default to 24h if not present in saved data
            scheduleMode: savedData.scheduleMode || "24h",
            startDate: savedData.startDate || null,
            cachedWeeklyState: savedData.cachedWeeklyState || null,
          }));
          // Set initial signature based on loaded data (preserve optimization state)
          lastAppliedConstraintsSignature.current = JSON.stringify({
            userShiftData: adjustedUserShiftData,
            posts: savedData.posts || [],
            hours: hoursToUse,
          });
        } else {
          // 3. No saved data, so set default workers and initial assignments
          const defaultWorkers: UserShiftData[] = [
            {
              user: { id: "worker-1", name: "ישראל מזרחי" },
              constraints: getDefaultConstraints(defaultPosts, dynamicHours),
              totalAssignments: 0,
            },
            {
              user: { id: "worker-2", name: "ישראל אשכנזי" },
              constraints: getDefaultConstraints(defaultPosts, dynamicHours),
              totalAssignments: 0,
            },
          ];
          const initialAssignments = recoilState.posts.map(() =>
            dynamicHours.map(() => null)
          );
          setRecoilState({
            hours: dynamicHours,
            posts: defaultPosts,
            userShiftData: defaultWorkers,
            hasInitialized: true,
            syncStatus: "syncing",
            assignments: initialAssignments,
            manuallyEditedSlots: {},
            customCellDisplayNames: {},
            // Default shift settings
            startTime: "08:00",
            endTime: "18:00",
            restTime: 2,
            // Schedule mode defaults
            scheduleMode: "24h",
            startDate: null,
            cachedWeeklyState: null,
          });
          // Set initial signature for default state
          lastAppliedConstraintsSignature.current = JSON.stringify({
            userShiftData: defaultWorkers,
            posts: defaultPosts,
            hours: dynamicHours,
          });
        }
      } catch (error) {
        console.error(
          "[ShiftManager useEffect] setupInitialData: Error during initial data setup:",
          error
        );
        if (isMounted.current) {
          // Generate fallback hours for error case
          const fallbackHours = generateDynamicHours(
            OPERATION_START_TIME,
            OPERATION_END_TIME,
            defaultPosts.length,
            DEFAULT_STAFF_COUNT,
            MINIMUM_REST_TIME
          );
          const errorAssignments = defaultPosts.map(() =>
            fallbackHours.map(() => null)
          );
          setRecoilState((prev) => ({
            ...prev,
            hasInitialized: true,
            syncStatus: "out-of-sync",
            assignments:
              prev.assignments && prev.assignments.length > 0
                ? prev.assignments
                : errorAssignments, // Keep existing or fallback
            manuallyEditedSlots: prev.manuallyEditedSlots || {},
            customCellDisplayNames: prev.customCellDisplayNames || {},
          }));
        }
      }
    };

    if (!recoilState.hasInitialized) {
      setupInitialData();
    }

    return () => {
      isMounted.current = false;
    };
  }, [
    recoilState.hasInitialized,
    recoilState.posts,
    recoilState.hours,
    setRecoilState,
  ]);

  return {
    lastAppliedConstraintsSignature,
  };
}
