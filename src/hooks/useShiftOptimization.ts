import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilState } from "recoil";
import { shiftState, getActiveRosterFromState, updateRosterById } from "../stores/shiftStore";
import { optimizeAllRosters, RosterInput } from "../service/shiftOptimizedService";
import { UserShiftData } from "../models";

function buildSignature(state: { userShiftData: UserShiftData[]; posts: any[]; hours: any[]; startTime: string; endTime: string; selectedShiftCount: number | null }): string {
  return JSON.stringify({
    userShiftData: state.userShiftData,
    posts: state.posts,
    hours: state.hours,
    startTime: state.startTime,
    endTime: state.endTime,
    selectedShiftCount: state.selectedShiftCount,
  });
}

export function useShiftOptimization(
  isEditing: boolean,
  showSuccess: (
    message: string,
    duration?: number,
    highlightText?: string
  ) => void,
  showError: (message: string, duration?: number) => void,
  showInfo: (message: string, duration?: number) => void
) {
  const { t } = useTranslation();
  const [recoilState, setRecoilState] = useRecoilState(shiftState);
  const [isOptimizeDisabled, setIsOptimizeDisabled] = useState(true);
  const [optimizeButtonTitle, setOptimizeButtonTitle] = useState(
    ""
  );

  const activeRoster = getActiveRosterFromState(recoilState);

  // Update optimization button state based on conditions
  useEffect(() => {
    const currentSyncStatus = recoilState.syncStatus;
    const currentAssignments = activeRoster.assignments;
    const currentUserShiftData = recoilState.userShiftData;
    const savedSignature = recoilState.optimizationSignature;
    let newTitle = t("optimizeShiftAssignments"); // Default title

    // Condition 1: Edit mode is active
    if (isEditing) {
      setIsOptimizeDisabled(true);
      newTitle = t("cannotOptimizeEditMode");
      setOptimizeButtonTitle(newTitle);
      return;
    }

    // Condition 2: Sync status is out-of-sync (error state)
    if (currentSyncStatus === "out-of-sync") {
      setIsOptimizeDisabled(true);
      newTitle = t("cannotOptimizeOutOfSync");
      setOptimizeButtonTitle(newTitle);
      return;
    }

    // Condition 3: No actual assignments currently exist in the state.
    const hasAnyActualAssignments =
      currentAssignments &&
      currentAssignments.flat().some((userId) => userId !== null);

    if (!hasAnyActualAssignments) {
      if (currentUserShiftData && currentUserShiftData.length > 0) {
        setIsOptimizeDisabled(false);
        newTitle = t("generateInitialAssignments");

        setRecoilState((prev) => ({
          ...prev,
          syncStatus: "no-optimised",
        }));
      } else {
        setIsOptimizeDisabled(true);
        newTitle = t("cannotOptimizeNoUsers");
      }
      setOptimizeButtonTitle(newTitle);
      return;
    }

    // Condition 4: Assignments exist — check if still optimized
    if (!savedSignature) {
      setIsOptimizeDisabled(false);
      newTitle = t("optimizeWithNewConstraints");
      setOptimizeButtonTitle(newTitle);
      return;
    }

    const currentSignature = buildSignature({
      userShiftData: currentUserShiftData,
      posts: activeRoster.posts,
      hours: activeRoster.hours,
      startTime: activeRoster.startTime,
      endTime: activeRoster.endTime,
      selectedShiftCount: recoilState.selectedShiftCount,
    });

    if (currentSignature === savedSignature) {
      setIsOptimizeDisabled(true);
      newTitle = t("alreadyOptimized");
    } else {
      setIsOptimizeDisabled(false);
      newTitle = t("optimizeWithUpdatedConstraints");
      setRecoilState((prev) => ({
        ...prev,
        syncStatus: "no-optimised",
        optimizationSignature: null,
      }));
    }
    setOptimizeButtonTitle(newTitle);
  }, [
    isEditing,
    recoilState.syncStatus,
    recoilState.optimizationSignature,
    activeRoster.assignments,
    recoilState.userShiftData,
    activeRoster.posts,
    activeRoster.hours,
    activeRoster.startTime,
    activeRoster.endTime,
    recoilState.selectedShiftCount,
    t,
    setRecoilState,
  ]);

  const handleOptimize = async () => {
    console.log("Optimization process started.");
    if (isOptimizeDisabled) {
      console.log("Optimization skipped: button is disabled.");
      showInfo(t("optimizationSkippedAlreadyOptimized"));
      return;
    }

    try {
      // Build inputs for ALL rosters
      const inputs: RosterInput[] = recoilState.rosters.map((roster) => {
        // Build per-roster user data using constraintsByRoster
        const rosterUserData: UserShiftData[] = (recoilState.userShiftData || []).map((u) => ({
          ...u,
          constraints: u.constraintsByRoster?.[roster.id] || u.constraints,
        }));

        return {
          rosterId: roster.id,
          userData: rosterUserData,
          posts: roster.posts,
          hours: roster.hours,
        };
      });

      const { results, allOptimal } = await optimizeAllRosters(inputs);

      if (!allOptimal) {
        // Check if the active roster failed
        const activeResult = results.get(recoilState.activeRosterId);
        if (activeResult && !activeResult.isOptim) {
          let detailedMessage = t("optimizationInfeasible");
          if (activeResult.infeasiblePositions?.length) {
            const problematicSlots = activeResult.infeasiblePositions
              .map((pos) => pos.description)
              .join(", ");
            detailedMessage += `\n\n${t("problematicTimeSlots")}:\n${problematicSlots}`;
            detailedMessage += `\n\n${t("fixAvailabilityHint")}`;
          }
          showError(detailedMessage);
        }
      }

      // Capture the signature BEFORE applying (uses current inputs)
      const signature = buildSignature({
        userShiftData: recoilState.userShiftData,
        posts: activeRoster.posts,
        hours: activeRoster.hours,
        startTime: activeRoster.startTime,
        endTime: activeRoster.endTime,
        selectedShiftCount: recoilState.selectedShiftCount,
      });

      // Apply results to all rosters
      setRecoilState((prev) => {
        let newState = { ...prev };

        for (const [rosterId, result] of results) {
          if (!result.isOptim) continue;

          const roster = newState.rosters.find((r) => r.id === rosterId);
          if (!roster) continue;

          let newAssignments: (string | null)[][] = roster.posts.map(
            () => roster.hours.map(() => null)
          );

          // Build per-roster user data for mapping
          const rosterUserData = (newState.userShiftData || []).map((u) => ({
            ...u,
            constraints: u.constraintsByRoster?.[rosterId] || u.constraints,
          }));

          result.result.forEach((postAssignments, postIndex) => {
            if (postIndex < newAssignments.length) {
              postAssignments.forEach((shiftAssignments, shiftIndex) => {
                if (shiftIndex < newAssignments[postIndex].length) {
                  const assignedUserIndex = shiftAssignments.findIndex(
                    (isAssigned) => isAssigned
                  );
                  if (
                    assignedUserIndex >= 0 &&
                    assignedUserIndex < rosterUserData.length
                  ) {
                    newAssignments[postIndex][shiftIndex] =
                      rosterUserData[assignedUserIndex]?.user.id || null;
                  }
                }
              });
            }
          });

          newState = updateRosterById(newState, rosterId, (r) => ({
            ...r,
            assignments: newAssignments,
          }));
        }

        // Persist optimization signature only when all rosters optimized successfully
        if (allOptimal) {
          newState.syncStatus = "synced";
          newState.optimizationSignature = signature;
          newState.optimizationFailed = false;
        } else {
          newState.syncStatus = "no-optimised";
          newState.optimizationSignature = null;
          newState.optimizationFailed = true;
        }
        return newState;
      });

      console.log("Optimization successful, new assignments applied.");

      if (allOptimal) {
        showSuccess(t("optimizationSuccess"));
      }
    } catch (error) {
      console.error("Error during optimization:", error);
      setRecoilState((prev) =>
        updateRosterById(prev, prev.activeRosterId, (r) => ({
          ...r,
          assignments: r.posts.map(() => r.hours.map(() => null)),
        }))
      );

      showError(t("optimizationError"));
    }
  };

  return {
    isOptimizeDisabled,
    optimizeButtonTitle,
    handleOptimize,
  };
}
