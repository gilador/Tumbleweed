import { useRecoilState } from "recoil";
import { shiftState } from "../stores/shiftStore";

export function useAssignmentHandlers() {
  const [recoilState, setRecoilState] = useRecoilState(shiftState);

  const handleAssignmentChange = (
    postIndex: number,
    hourIndex: number,
    userId: string | null
  ) => {
    setRecoilState((prevState) => {
      const newAssignments = prevState.assignments.map((row) => [...row]);
      const originalUserIdInSlot = newAssignments[postIndex][hourIndex];
      newAssignments[postIndex][hourIndex] = userId;

      console.log(
        "[handleAssignmentChange] Prev manuallyEditedSlots:",
        prevState.manuallyEditedSlots
      );
      const newManuallyEditedSlots = { ...prevState.manuallyEditedSlots };
      const slotKey = `${postIndex}-${hourIndex}`;

      // Since this function is now only for assigning EXISTING users,
      // we always clear any custom display name for this slot.
      const newCustomCellDisplayNames = { ...prevState.customCellDisplayNames };
      if (newCustomCellDisplayNames[slotKey]) {
        delete newCustomCellDisplayNames[slotKey];
        console.log(
          `[handleAssignmentChange] Cleared customDisplayName for ${slotKey}`
        );
      }

      // Update manuallyEditedSlots based on the change in the official assignments grid
      if (originalUserIdInSlot !== userId) {
        // If there's an actual change
        const existingEdit = newManuallyEditedSlots[slotKey];
        if (existingEdit) {
          // Slot was already manually edited, update currentUserId
          // If the new userId is the same as the very original one, remove the entry
          if (userId === existingEdit.originalUserId) {
            delete newManuallyEditedSlots[slotKey];
          } else {
            newManuallyEditedSlots[slotKey] = {
              ...existingEdit,
              currentUserId: userId,
            };
          }
        } else {
          // First manual edit for this slot
          newManuallyEditedSlots[slotKey] = {
            originalUserId: originalUserIdInSlot,
            currentUserId: userId,
          };
        }
      }

      console.log("Assignments updated:", newAssignments);
      console.log(
        "[handleAssignmentChange] Next manuallyEditedSlots:",
        newManuallyEditedSlots
      );

      return {
        ...prevState,
        assignments: newAssignments,
        manuallyEditedSlots: newManuallyEditedSlots,
        customCellDisplayNames: newCustomCellDisplayNames, // Include updated custom names
      };
    });
  };

  const handleAssignmentNameUpdate = (
    postIndex: number,
    hourIndex: number,
    newUserName: string
  ) => {
    const userToAssign = recoilState.userShiftData?.find(
      (userData) => userData.user.name === newUserName
    );
    const slotKey = `${postIndex}-${hourIndex}`;

    if (userToAssign) {
      // User found, this is an assignment to an existing worker
      console.log(
        `[handleAssignmentNameUpdate] User "${newUserName}" found. Assigning userId: ${userToAssign.user.id}`
      );
      handleAssignmentChange(postIndex, hourIndex, userToAssign.user.id);
    } else {
      // User not found, this is a custom text entry for display purposes
      console.log(
        `[handleAssignmentNameUpdate] User "${newUserName}" not found. Setting as custom display name for slot ${slotKey}.`
      );
      setRecoilState((prevState) => {
        const newCustomCellDisplayNames = {
          ...prevState.customCellDisplayNames,
          [slotKey]: newUserName,
        };

        const officialAssignmentInSlot =
          prevState.assignments[postIndex][hourIndex];
        const newManuallyEditedSlots = { ...prevState.manuallyEditedSlots };

        const existingEdit = newManuallyEditedSlots[slotKey];
        if (existingEdit) {
          if (
            newUserName ===
            prevState.userShiftData?.find(
              (u) => u.user.id === existingEdit.originalUserId
            )?.user.name
          ) {
            // Custom name IS the name of the original user for this manual edit, so remove manual edit marker for this slot.
            delete newManuallyEditedSlots[slotKey];
            // Also remove from customCellDisplayNames as it's now effectively reverted to an official (though perhaps original) assignment.
            delete newCustomCellDisplayNames[slotKey];
          } else {
            newManuallyEditedSlots[slotKey] = {
              originalUserId: existingEdit.originalUserId,
              currentUserId: officialAssignmentInSlot, // What's in the main assignments grid
            };
          }
        } else if (officialAssignmentInSlot !== null || newUserName !== "") {
          // Only add if there was something or custom name is not empty
          // First manual override for this slot (setting a custom name)
          newManuallyEditedSlots[slotKey] = {
            originalUserId: officialAssignmentInSlot,
            currentUserId: officialAssignmentInSlot, // The assignments grid doesn't change for a custom name
          };
        }

        console.log(
          "[handleAssignmentNameUpdate] Prev assignments:",
          prevState.assignments
        );
        console.log(
          "[handleAssignmentNameUpdate] Prev customCellDisplayNames:",
          prevState.customCellDisplayNames
        );
        console.log(
          "[handleAssignmentNameUpdate] Prev manuallyEditedSlots:",
          prevState.manuallyEditedSlots
        );

        return {
          ...prevState,
          // assignments grid does NOT change when setting a custom name that doesn't match a user
          customCellDisplayNames: newCustomCellDisplayNames,
          manuallyEditedSlots: newManuallyEditedSlots,
        };
      });
    }
  };

  const handleClearAllAssignments = () => {
    setRecoilState((prevState) => {
      const newAssignments = (prevState.assignments || []).map((row) =>
        row.map(() => null)
      );

      // Clear all manually edited slots and custom display names
      const newManuallyEditedSlots = {};
      const newCustomCellDisplayNames = {};

      console.log("All assignments cleared");

      return {
        ...prevState,
        assignments: newAssignments,
        manuallyEditedSlots: newManuallyEditedSlots,
        customCellDisplayNames: newCustomCellDisplayNames,
      };
    });
  };

  return {
    handleAssignmentChange,
    handleAssignmentNameUpdate,
    handleClearAllAssignments,
  };
}
