import { useRecoilState } from "recoil";
import { shiftState, updateActiveRoster } from "../stores/shiftStore";

export function useAssignmentHandlers() {
  const [recoilState, setRecoilState] = useRecoilState(shiftState);

  const handleAssignmentChange = (
    postIndex: number,
    hourIndex: number,
    userId: string | null
  ) => {
    setRecoilState((prevState) => {
      return updateActiveRoster(prevState, (roster) => {
        const newAssignments = roster.assignments.map((row) => [...row]);
        const originalUserIdInSlot = newAssignments[postIndex][hourIndex];
        newAssignments[postIndex][hourIndex] = userId;

        const newManuallyEditedSlots = { ...roster.manuallyEditedSlots };
        const slotKey = `${postIndex}-${hourIndex}`;

        const newCustomCellDisplayNames = { ...roster.customCellDisplayNames };
        if (newCustomCellDisplayNames[slotKey]) {
          delete newCustomCellDisplayNames[slotKey];
        }

        if (originalUserIdInSlot !== userId) {
          const existingEdit = newManuallyEditedSlots[slotKey];
          if (existingEdit) {
            if (userId === existingEdit.originalUserId) {
              delete newManuallyEditedSlots[slotKey];
            } else {
              newManuallyEditedSlots[slotKey] = {
                ...existingEdit,
                currentUserId: userId,
              };
            }
          } else {
            newManuallyEditedSlots[slotKey] = {
              originalUserId: originalUserIdInSlot,
              currentUserId: userId,
            };
          }
        }

        return {
          ...roster,
          assignments: newAssignments,
          manuallyEditedSlots: newManuallyEditedSlots,
          customCellDisplayNames: newCustomCellDisplayNames,
        };
      });
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
      handleAssignmentChange(postIndex, hourIndex, userToAssign.user.id);
    } else {
      setRecoilState((prevState) => {
        return updateActiveRoster(prevState, (roster) => {
          const newCustomCellDisplayNames = {
            ...roster.customCellDisplayNames,
            [slotKey]: newUserName,
          };

          const officialAssignmentInSlot =
            roster.assignments[postIndex][hourIndex];
          const newManuallyEditedSlots = { ...roster.manuallyEditedSlots };

          const existingEdit = newManuallyEditedSlots[slotKey];
          if (existingEdit) {
            if (
              newUserName ===
              prevState.userShiftData?.find(
                (u) => u.user.id === existingEdit.originalUserId
              )?.user.name
            ) {
              delete newManuallyEditedSlots[slotKey];
              delete newCustomCellDisplayNames[slotKey];
            } else {
              newManuallyEditedSlots[slotKey] = {
                originalUserId: existingEdit.originalUserId,
                currentUserId: officialAssignmentInSlot,
              };
            }
          } else if (officialAssignmentInSlot !== null || newUserName !== "") {
            newManuallyEditedSlots[slotKey] = {
              originalUserId: officialAssignmentInSlot,
              currentUserId: officialAssignmentInSlot,
            };
          }

          return {
            ...roster,
            customCellDisplayNames: newCustomCellDisplayNames,
            manuallyEditedSlots: newManuallyEditedSlots,
          };
        });
      });
    }
  };

  const handleClearAllAssignments = () => {
    setRecoilState((prevState) => {
      return updateActiveRoster(prevState, (roster) => {
        const newAssignments = (roster.assignments || []).map((row) =>
          row.map(() => null)
        );
        return {
          ...roster,
          assignments: newAssignments,
          manuallyEditedSlots: {},
          customCellDisplayNames: {},
        };
      });
    });
  };

  return {
    handleAssignmentChange,
    handleAssignmentNameUpdate,
    handleClearAllAssignments,
  };
}
