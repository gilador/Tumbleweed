import { useEffect } from "react";
import { useRecoilState } from "recoil";
import { shiftState, PersistedShiftData, isLegacyFormat, migrateLegacyState } from "../stores/shiftStore";
import {
  loadStateFromLocalStorage,
  LOCAL_STORAGE_KEY,
} from "../lib/localStorageUtils";
import { UserShiftData, RosterState } from "../models";
import {
  defaultPosts,
  OPERATION_START_TIME,
  OPERATION_END_TIME,
  MINIMUM_REST_TIME,
} from "../constants/shiftManagerConstants";
import {
  generateDynamicHours,
  getDefaultConstraints,
} from "../service/shiftManagerUtils";

export function useShiftManagerInitialization() {
  const [recoilState, setRecoilState] = useRecoilState(shiftState);

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
        setRecoilState((prev) => ({
          ...prev,
          syncStatus: "syncing",
        }));
      }

      try {
        // 2. Try loading from localStorage
        const rawSavedData = await loadStateFromLocalStorage<any>(
          LOCAL_STORAGE_KEY
        );

        if (!isMounted.current) return;

        // Generate dynamic hours based on operation parameters
        const dynamicHours = generateDynamicHours(
          OPERATION_START_TIME,
          OPERATION_END_TIME,
          defaultPosts.length,
          2, // default bootstrap creates 2 workers
          MINIMUM_REST_TIME
        );

        // Detect and migrate legacy format
        let savedData: PersistedShiftData | null = null;
        if (rawSavedData) {
          if (isLegacyFormat(rawSavedData)) {
            console.log("[ShiftManager] Detected legacy format, migrating...");
            savedData = migrateLegacyState(rawSavedData);
          } else if (rawSavedData.rosters) {
            savedData = rawSavedData as PersistedShiftData;
          }
        }

        if (savedData && savedData.hasInitialized) {
          console.log(
            `[ShiftManager useEffect] setupInitialData: Found saved data.`,
            savedData
          );

          const activeRoster = savedData.rosters.find(
            (r) => r.id === savedData!.activeRosterId
          ) ?? savedData.rosters[0];

          const savedHours = activeRoster?.hours || [];
          const hoursToUse = savedHours.length > 0 ? savedHours : dynamicHours;

          // Fix user constraints to have consistent hourIDs matching saved hours
          const adjustedUserShiftData = (savedData.userShiftData || []).map(
            (userData) => {
              const updatedConstraints = (activeRoster?.posts || []).map(
                (post, postIndex) => {
                  return hoursToUse.map((hour, hourIndex) => {
                    const existingConstraint =
                      userData.constraints?.[postIndex]?.[hourIndex];
                    return {
                      postID: post.id,
                      hourID: hour.id,
                      availability: existingConstraint?.availability ?? true,
                    };
                  });
                }
              );

              return {
                ...userData,
                constraints: updatedConstraints,
                constraintsByRoster: userData.constraintsByRoster || {
                  [savedData!.activeRosterId]: updatedConstraints,
                },
              };
            }
          );

          setRecoilState((prev) => ({
            ...prev,
            rosters: savedData!.rosters,
            activeRosterId: savedData!.activeRosterId,
            userShiftData: adjustedUserShiftData,
            hasInitialized: true,
            syncStatus: "syncing",
            selectedShiftCount: savedData!.selectedShiftCount ?? null,
            optimizationSignature: savedData!.optimizationSignature ?? null,
          }));
        } else {
          // 3. No saved data, so set default workers and initial assignments
          const defaultRosterId = "default-roster";
          const defaultRoster: RosterState = {
            id: defaultRosterId,
            name: "",
            posts: defaultPosts,
            hours: dynamicHours,
            assignments: defaultPosts.map(() => dynamicHours.map(() => null)),
            manuallyEditedSlots: {},
            customCellDisplayNames: {},
            scheduleMode: "24h",
            startTime: "08:00",
            endTime: "18:00",
            startDate: null,
            cachedWeeklyState: null,
          };

          const defaultWorkers: UserShiftData[] = [
            {
              user: { id: "worker-2", name: "עובד 2" },
              constraints: getDefaultConstraints(defaultPosts, dynamicHours),
              constraintsByRoster: {
                [defaultRosterId]: getDefaultConstraints(defaultPosts, dynamicHours),
              },
              totalAssignments: 0,
            },
            {
              user: { id: "worker-1", name: "עובד 1" },
              constraints: getDefaultConstraints(defaultPosts, dynamicHours),
              constraintsByRoster: {
                [defaultRosterId]: getDefaultConstraints(defaultPosts, dynamicHours),
              },
              totalAssignments: 0,
            },
          ];

          setRecoilState({
            rosters: [defaultRoster],
            activeRosterId: defaultRosterId,
            userShiftData: defaultWorkers,
            hasInitialized: true,
            syncStatus: "syncing",
            selectedShiftCount: null,
            optimizationSignature: null,
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
            2, // default bootstrap creates 2 workers
            MINIMUM_REST_TIME
          );
          const fallbackRoster: RosterState = {
            id: "fallback-roster",
            name: "",
            posts: defaultPosts,
            hours: fallbackHours,
            assignments: defaultPosts.map(() => fallbackHours.map(() => null)),
            manuallyEditedSlots: {},
            customCellDisplayNames: {},
            scheduleMode: "24h",
            startTime: "08:00",
            endTime: "18:00",
            startDate: null,
            cachedWeeklyState: null,
          };

          setRecoilState((prev) => ({
            ...prev,
            rosters: prev.rosters.length > 0 ? prev.rosters : [fallbackRoster],
            activeRosterId: prev.activeRosterId || fallbackRoster.id,
            hasInitialized: true,
            syncStatus: "out-of-sync",
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
    setRecoilState,
  ]);

}
