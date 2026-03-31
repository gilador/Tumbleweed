import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilState } from "recoil";
import { shiftState } from "../stores/shiftStore";
import { optimizeShift } from "../service/shiftOptimizedService";
import { defaultHours } from "../constants/shiftManagerConstants";

export function useShiftOptimization(
  isEditing: boolean,
  lastAppliedConstraintsSignature: React.MutableRefObject<string | null>,
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

  // Update optimization button state based on conditions
  useEffect(() => {
    const currentSyncStatus = recoilState.syncStatus;
    const currentAssignments = recoilState.assignments;
    const currentUserShiftData = recoilState.userShiftData;
    let newTitle = t("optimizeShiftAssignments"); // Default title

    // Invalidate optimization cache if config has changed
    if (lastAppliedConstraintsSignature.current !== null) {
      const currentSignature = JSON.stringify({
        userShiftData: currentUserShiftData,
        posts: recoilState.posts,
        hours: recoilState.hours,
        startTime: recoilState.startTime,
        endTime: recoilState.endTime,
        restTime: recoilState.restTime,
      });
      if (currentSignature !== lastAppliedConstraintsSignature.current) {
        lastAppliedConstraintsSignature.current = null;
      }
    }

    // Condition 1: Edit mode is active
    if (isEditing) {
      console.log("🚫 [useShiftOptimization] Disabled: Edit mode active");
      setIsOptimizeDisabled(true);
      newTitle = t("cannotOptimizeEditMode");
      setOptimizeButtonTitle(newTitle);
      return;
    }

    // Condition 2: Sync status is problematic
    if (
      currentSyncStatus === "syncing" ||
      currentSyncStatus === "out-of-sync"
    ) {
      console.log(
        "🚫 [useShiftOptimization] Disabled: Sync status problematic:",
        currentSyncStatus
      );
      setIsOptimizeDisabled(true);
      newTitle =
        currentSyncStatus === "syncing"
          ? t("cannotOptimizeSyncing")
          : t("cannotOptimizeOutOfSync");
      setOptimizeButtonTitle(newTitle);
      return;
    }

    // Condition 3: No actual assignments currently exist in the state.
    const hasAnyActualAssignments =
      currentAssignments &&
      currentAssignments.flat().some((userId) => userId !== null);

    console.log("🔍 [useShiftOptimization] Assignment check:", {
      hasAnyActualAssignments,
      currentAssignments: currentAssignments?.map((arr) => arr.slice(0, 3)), // Show first 3 items
      flatAssignments: currentAssignments?.flat().slice(0, 10), // Show first 10 items
    });

    if (!hasAnyActualAssignments) {
      if (currentUserShiftData && currentUserShiftData.length > 0) {
        console.log(
          "✅ [useShiftOptimization] Enabled: No assignments, but has user data - can generate initial"
        );
        setIsOptimizeDisabled(false);
        newTitle = t("generateInitialAssignments");
        
        // Set sync status to "no-optimised" as default when no assignments exist
        setRecoilState((prev) => ({
          ...prev,
          syncStatus: "no-optimised",
        }));
      } else {
        console.log(
          "🚫 [useShiftOptimization] Disabled: No assignments and no user data"
        );
        setIsOptimizeDisabled(true);
        newTitle = t("cannotOptimizeNoUsers");
      }
      setOptimizeButtonTitle(newTitle);
      return;
    }

    // Condition 4: Assignments exist. Button disabled if current constraints match those that produced these assignments.
    if (lastAppliedConstraintsSignature.current === null) {
      console.warn(
        "[isOptimizeDisabled] lastAppliedConstraintsSignature.current is null, but assignments exist. Enabling button."
      );
      setIsOptimizeDisabled(false);
      newTitle = t("optimizeWithNewConstraints");
      setOptimizeButtonTitle(newTitle);
      return;
    }

    const currentConstraintsSignature = JSON.stringify({
      userShiftData: currentUserShiftData,
      posts: recoilState.posts,
      hours: recoilState.hours,
      startTime: recoilState.startTime,
      endTime: recoilState.endTime,
      restTime: recoilState.restTime,
    });

    if (
      currentConstraintsSignature === lastAppliedConstraintsSignature.current
    ) {
      setIsOptimizeDisabled(true);
      newTitle = t("alreadyOptimized");
    } else {
      setIsOptimizeDisabled(false);
      newTitle = t("optimizeWithUpdatedConstraints");
      // Set sync status to "no-optimised" when constraints have changed
      setRecoilState((prev) => ({
        ...prev,
        syncStatus: "no-optimised",
      }));
    }
    setOptimizeButtonTitle(newTitle);
  }, [
    isEditing,
    recoilState.syncStatus,
    recoilState.assignments,
    recoilState.userShiftData,
    recoilState.posts,
    recoilState.hours,
    recoilState.startTime,
    recoilState.endTime,
    recoilState.restTime,
    lastAppliedConstraintsSignature,
    t,
  ]);

  const handleOptimize = async () => {
    console.log("Optimization process started.");
    if (isOptimizeDisabled) {
      console.log("Optimization skipped: button is disabled.");
      showInfo(t("optimizationSkippedAlreadyOptimized"));
      return;
    }

    console.log("Starting optimization process...");
    console.log("Current state:", {
      posts: recoilState.posts,
      hours: recoilState.hours,
      userShiftData: recoilState.userShiftData,
    });

    console.log("useShiftOptimization: Detailed hours analysis:", {
      hoursCount: recoilState.hours?.length || 0,
      hoursValues: recoilState.hours?.map((h) => h.value) || [],
      postsCount: recoilState.posts?.length || 0,
      usersCount: recoilState.userShiftData?.length || 0,
    });

    try {
      // Debug the exact data being sent to optimization
      console.log(
        "🔍 [useShiftOptimization] Data being sent to optimization:",
        {
          userCount: recoilState.userShiftData?.length || 0,
          postsCount: recoilState.posts?.length || 0,
          hoursCount: recoilState.hours?.length || 0,
          sampleUserConstraints:
            recoilState.userShiftData?.[0]?.constraints?.length || 0,
          samplePostConstraints:
            recoilState.userShiftData?.[0]?.constraints?.[0]?.length || 0,
          currentHours: recoilState.hours?.map((h) => h.value) || [],
        }
      );

      const optimizedResult = await optimizeShift(
        recoilState.userShiftData || []
      );

      if (!optimizedResult.isOptim) {
        // Handle infeasible optimization
        console.warn(
          "Optimization failed: Problem is infeasible - some shifts have no available users"
        );
        // Clear assignments since no valid solution exists
        setRecoilState((prev) => ({
          ...prev,
          assignments: (recoilState.posts || []).map(() =>
            (recoilState.hours || defaultHours).map(() => null)
          ),
          manuallyEditedSlots: prev.manuallyEditedSlots || {},
          customCellDisplayNames: prev.customCellDisplayNames || {},
        }));

        // Log detailed infeasible positions if available
        if (optimizedResult.infeasiblePositions) {
          console.warn(
            "Problematic time slots:",
            optimizedResult.infeasiblePositions
          );
        }

        // Create detailed error message (always use translated strings)
        let detailedMessage = t("optimizationInfeasible");

        if (
          optimizedResult.infeasiblePositions &&
          optimizedResult.infeasiblePositions.length > 0
        ) {
          const problematicSlots = optimizedResult.infeasiblePositions
            .map((pos) => pos.description)
            .join(", ");
          detailedMessage += `\n\n${t("problematicTimeSlots")}:\n${problematicSlots}`;
          detailedMessage += `\n\n${t("fixAvailabilityHint")}`;
        }

        showError(detailedMessage);
        return; // Early return for infeasible problems
      }

      // Handle successful optimization
      console.log("Optimization result dimensions:", {
        resultPosts: optimizedResult.result.length,
        resultTimeSlots: optimizedResult.result[0]?.length || 0,
        recoilPosts: recoilState.posts?.length || 0,
        recoilHours: recoilState.hours?.length || 0,
      });

      // Use recoilState dimensions for UI consistency
      let newAssignments: (string | null)[][] = (recoilState.posts || []).map(
        () => (recoilState.hours || defaultHours).map(() => null)
      );

      optimizedResult.result.forEach((postAssignments, postIndex) => {
        // Ensure we don't try to access postAssignments out of bounds of newAssignments
        if (postIndex < newAssignments.length) {
          postAssignments.forEach((shiftAssignments, shiftIndex) => {
            if (shiftIndex < newAssignments[postIndex].length) {
              const assignedUserIndex = shiftAssignments.findIndex(
                (isAssigned) => isAssigned
              );

              if (
                assignedUserIndex >= 0 &&
                assignedUserIndex < (recoilState.userShiftData?.length || 0)
              ) {
                const userId =
                  recoilState.userShiftData?.[assignedUserIndex]?.user.id ||
                  null;
                newAssignments[postIndex][shiftIndex] = userId;
              } else {
                newAssignments[postIndex][shiftIndex] = null;
              }
            }
          });
        }
      });

      setRecoilState((prev) => ({
        ...prev,
        assignments: newAssignments,
        manuallyEditedSlots: prev.manuallyEditedSlots || {},
        customCellDisplayNames: prev.customCellDisplayNames || {},
      }));

      // Capture the signature of constraints that led to THIS successful optimization
      lastAppliedConstraintsSignature.current = JSON.stringify({
        userShiftData: recoilState.userShiftData, // Constraints used for this optimization
        posts: recoilState.posts,
        hours: recoilState.hours,
        startTime: recoilState.startTime,
        endTime: recoilState.endTime,
        restTime: recoilState.restTime,
      });

      console.log("Optimization successful, new assignments applied.");

      // Show success feedback
      showSuccess(t("optimizationSuccess"));
    } catch (error) {
      console.error("Error during optimization:", error);
      setRecoilState((prev) => ({
        ...prev,
        assignments: (recoilState.posts || []).map(() =>
          (recoilState.hours || defaultHours).map(() => null)
        ),
        manuallyEditedSlots: prev.manuallyEditedSlots || {},
        customCellDisplayNames: prev.customCellDisplayNames || {},
      }));

      // Show error feedback
      showError(t("optimizationError"));
    }
  };

  return {
    isOptimizeDisabled,
    optimizeButtonTitle,
    handleOptimize,
  };
}
