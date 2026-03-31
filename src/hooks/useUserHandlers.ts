import { useState } from "react";
import { useRecoilState } from "recoil";
import { shiftState } from "../stores/shiftStore";
import { UserShiftData, Constraint } from "../models";
import { defaultHours } from "../constants/shiftManagerConstants";
import { getDefaultConstraints } from "../service/shiftManagerUtils";

export function useUserHandlers() {
  const [recoilState, setRecoilState] = useRecoilState(shiftState);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const addUser = () => {
    const currentUserCount = recoilState.userShiftData?.length || 0;
    const userName = `New User ${currentUserCount + 1}`;
    const newUser: UserShiftData = {
      user: {
        id: `worker-${Date.now()}`,
        name: userName,
      },
      constraints: getDefaultConstraints(
        recoilState.posts || [],
        recoilState.hours || defaultHours
      ),
      totalAssignments: 0,
    };
    setRecoilState((prev) => ({
      ...prev,
      userShiftData: [newUser, ...(prev.userShiftData || [])],
      manuallyEditedSlots: prev.manuallyEditedSlots || {},
      customCellDisplayNames: prev.customCellDisplayNames || {},
    }));

    return userName; // Return the user name for toast notification
  };

  const updateUserConstraints = (
    userId: string,
    newConstraints: Constraint[][]
  ) => {
    // Print only the user availability object
    console.log(JSON.stringify(newConstraints, null, 2));

    setRecoilState((prev) => ({
      ...prev,
      userShiftData: (prev.userShiftData || []).map((userData) =>
        userData.user.id === userId
          ? { ...userData, constraints: newConstraints }
          : userData
      ),
      manuallyEditedSlots: prev.manuallyEditedSlots || {},
      customCellDisplayNames: prev.customCellDisplayNames || {},
    }));
  };

  const updateUserName = (userId: string, newName: string) => {
    console.log("1 - newName: ", newName);
    setRecoilState((prev) => ({
      ...prev,
      userShiftData: (prev.userShiftData || []).map((userData) =>
        userData.user.id === userId
          ? { ...userData, user: { ...userData.user, name: newName } }
          : userData
      ),
      manuallyEditedSlots: prev.manuallyEditedSlots || {},
      customCellDisplayNames: prev.customCellDisplayNames || {},
    }));
  };

  const removeUsers = (userIds: string[]) => {
    setRecoilState((prev) => ({
      ...prev,
      userShiftData: (prev.userShiftData || []).filter(
        (userData) => !userIds.includes(userData.user.id)
      ),
      manuallyEditedSlots: prev.manuallyEditedSlots || {},
      customCellDisplayNames: prev.customCellDisplayNames || {},
    }));
  };

  const handleUserSelect = (userId: string | null) => {
    console.log("handleUserSelect called with userId:", userId);
    setSelectedUserId(userId);
  };

  const resetAllAvailability = () => {
    setRecoilState((prev) => ({
      ...prev,
      userShiftData: (prev.userShiftData || []).map((userData) => ({
        ...userData,
        constraints: getDefaultConstraints(
          prev.posts || [],
          prev.hours || defaultHours
        ),
      })),
      manuallyEditedSlots: prev.manuallyEditedSlots || {},
      customCellDisplayNames: prev.customCellDisplayNames || {},
    }));
  };

  return {
    selectedUserId,
    addUser,
    updateUserConstraints,
    updateUserName,
    removeUsers,
    handleUserSelect,
    resetAllAvailability,
  };
}
