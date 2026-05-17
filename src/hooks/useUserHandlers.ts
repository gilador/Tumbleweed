import { useTranslation } from "react-i18next";
import { useRecoilState } from "recoil";
import { shiftState, getActiveRosterFromState } from "../stores/shiftStore";
import { selectedStaffIdState } from "../stores/selectionStore";
import { UserShiftData, Constraint } from "../models";
import { defaultHours } from "../constants/shiftManagerConstants";
import { getDefaultConstraints } from "../service/shiftManagerUtils";
import { trackEvent } from "../lib/analytics";

export function useUserHandlers() {
  const { t } = useTranslation();
  const [recoilState, setRecoilState] = useRecoilState(shiftState);
  const [selectedUserId, setSelectedUserId] = useRecoilState(selectedStaffIdState);

  const addUser = () => {
    const currentUserCount = recoilState.userShiftData?.length || 0;
    const userName = t("defaultMember", { n: currentUserCount + 1 });

    // Build constraintsByRoster for ALL rosters
    const constraintsByRoster: Record<string, Constraint[][]> = {};
    for (const roster of recoilState.rosters) {
      constraintsByRoster[roster.id] = getDefaultConstraints(
        roster.posts || [],
        roster.hours || defaultHours
      );
    }

    const activeRoster = getActiveRosterFromState(recoilState);
    const newUser: UserShiftData = {
      user: {
        id: `worker-${Date.now()}`,
        name: userName,
      },
      constraints: constraintsByRoster[recoilState.activeRosterId] || getDefaultConstraints(
        activeRoster.posts || [],
        activeRoster.hours || defaultHours
      ),
      constraintsByRoster,
      totalAssignments: 0,
    };
    setRecoilState((prev) => ({
      ...prev,
      userShiftData: [newUser, ...(prev.userShiftData || [])],
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
          ? {
              ...userData,
              constraints: newConstraints,
              constraintsByRoster: {
                ...userData.constraintsByRoster,
                [prev.activeRosterId]: newConstraints,
              },
            }
          : userData
      ),
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
    }));
  };

  const removeUsers = (userIds: string[]) => {
    setRecoilState((prev) => ({
      ...prev,
      userShiftData: (prev.userShiftData || []).filter(
        (userData) => !userIds.includes(userData.user.id)
      ),
    }));
  };

  const removeSingleUser = (userId: string) => {
    trackEvent("user-delete-single", {});
    setRecoilState((prev) => ({
      ...prev,
      userShiftData: (prev.userShiftData || []).filter(
        (userData) => userData.user.id !== userId
      ),
    }));
    if (selectedUserId === userId) setSelectedUserId(null);
  };

  const handleUserSelect = (userId: string | null) => {
    console.log("handleUserSelect called with userId:", userId);
    setSelectedUserId(userId);
  };

  const resetAvailabilityForUsers = (userIds: string[]) => {
    setRecoilState((prev) => {
      const idSet = new Set(userIds);
      const activeRoster = getActiveRosterFromState(prev);
      const updatedUserShiftData = (prev.userShiftData || []).map((userData) => {
        if (!idSet.has(userData.user.id)) return userData;
        const newConstraintsByRoster: Record<string, Constraint[][]> = {
          ...(userData.constraintsByRoster || {}),
        };
        for (const roster of prev.rosters) {
          newConstraintsByRoster[roster.id] = getDefaultConstraints(
            roster.posts || [],
            roster.hours || defaultHours
          );
        }
        return {
          ...userData,
          constraints: newConstraintsByRoster[prev.activeRosterId] || getDefaultConstraints(
            activeRoster.posts || [],
            activeRoster.hours || defaultHours
          ),
          constraintsByRoster: newConstraintsByRoster,
        };
      });

      return {
        ...prev,
        userShiftData: updatedUserShiftData,
      };
    });
  };

  return {
    selectedUserId,
    addUser,
    updateUserConstraints,
    updateUserName,
    removeUsers,
    removeSingleUser,
    handleUserSelect,
    resetAvailabilityForUsers,
  };
}
