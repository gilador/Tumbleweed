import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilState } from "recoil";
import { shiftState, getActiveRosterFromState } from "../../stores/shiftStore";
import { useShiftManagerInitialization } from "../../hooks/useShiftManagerInitialization";
import { useShiftOptimization } from "../../hooks/useShiftOptimization";
import { useUserHandlers } from "../../hooks/useUserHandlers";
import { usePostHandlers } from "../../hooks/usePostHandlers";
import { useAssignmentHandlers } from "../../hooks/useAssignmentHandlers";
import { useToast } from "../../hooks/useToast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastManager } from "../Toast";
import { MobileTabBar, TabId } from "./MobileTabBar";
import { SettingsTab } from "./SettingsTab";
import { StaffTab } from "./StaffTab";
import { StaffAvailability } from "./StaffAvailability";
import { AssignmentsTab } from "./AssignmentsTab";

export type MobileRoute =
  | { screen: "settings" }
  | { screen: "staff" }
  | { screen: "staff-availability"; userId: string }
  | { screen: "assignments" };

export function MobileShell() {
  const { t } = useTranslation();
  const [route, setRoute] = useState<MobileRoute>({ screen: "settings" });
  const [recoilState] = useRecoilState(shiftState);
  const activeRoster = getActiveRosterFromState(recoilState);

  useShiftManagerInitialization();
  const { toasts, removeToast, showSuccess, showError, showInfo } = useToast();

  const {
    isOptimizeDisabled,
    optimizeButtonTitle,
    handleOptimize,
  } = useShiftOptimization(
    false, // never in global edit mode on mobile
    showSuccess,
    showError,
    showInfo
  );

  const {
    addUser,
    updateUserConstraints,
    removeUsers,
    handleUserSelect,
  } = useUserHandlers();

  const {
    addPost,
    handlePostEdit,
    savePostEdit,
    handleRemovePosts,
    editingPostId,
    setEditingPostId,
    editingPostName,
    setEditingPostName,
  } = usePostHandlers();

  const { handleAssignmentChange, handleClearAllAssignments } =
    useAssignmentHandlers();

  const handleAddPost = useCallback(() => {
    const postName = addPost();
    showSuccess(t("postWasAdded", { name: postName }), 3000, postName);
  }, [addPost, showSuccess, t]);

  const handleAddUser = useCallback(() => {
    const userName = addUser();
    showSuccess(t("userWasAddedToStaff", { name: userName }), 3000, userName);
  }, [addUser, showSuccess, t]);

  const activeTab: TabId =
    route.screen === "settings"
      ? "settings"
      : route.screen === "staff" || route.screen === "staff-availability"
      ? "staff"
      : "assignments";

  const isDrillDown = route.screen === "staff-availability";

  const handleTabChange = (tab: TabId) => {
    if (tab === "settings") setRoute({ screen: "settings" });
    else if (tab === "staff") setRoute({ screen: "staff" });
    else if (tab === "assignments") setRoute({ screen: "assignments" });
  };

  const handleNavigateToAvailability = (userId: string) => {
    handleUserSelect(userId);
    setRoute({ screen: "staff-availability", userId });
  };

  const handleBack = () => {
    if (route.screen === "staff-availability") {
      setRoute({ screen: "staff" });
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {route.screen === "settings" && (
          <SettingsTab
            posts={activeRoster.posts || []}
            hours={activeRoster.hours || []}
            startTime={activeRoster.startTime || "08:00"}
            endTime={activeRoster.endTime || "18:00"}
            restTime={recoilState.restTime ?? 2}
            userShiftData={recoilState.userShiftData || []}
            onAddPost={handleAddPost}
            onRemovePost={(postId) => handleRemovePosts([postId])}
            onEditPost={handlePostEdit}
            editingPostId={editingPostId}
            setEditingPostId={setEditingPostId}
            editingPostName={editingPostName}
            setEditingPostName={setEditingPostName}
            savePostEdit={savePostEdit}
          />
        )}
        {route.screen === "staff" && (
          <StaffTab
            userShiftData={recoilState.userShiftData || []}
            assignments={activeRoster.assignments || []}
            onSelectUser={handleNavigateToAvailability}
            onAddUser={handleAddUser}
            onRemoveUser={(userId) => removeUsers([userId])}
          />
        )}
        {route.screen === "staff-availability" && (
          <StaffAvailability
            userId={route.userId}
            userShiftData={recoilState.userShiftData || []}
            posts={activeRoster.posts || []}
            hours={activeRoster.hours || []}
            onBack={handleBack}
            onUpdateConstraints={updateUserConstraints}
          />
        )}
        {route.screen === "assignments" && (
          <AssignmentsTab
            posts={activeRoster.posts || []}
            hours={activeRoster.hours || []}
            assignments={activeRoster.assignments || []}
            userShiftData={recoilState.userShiftData || []}
            endTime={activeRoster.endTime || "18:00"}
            customCellDisplayNames={activeRoster.customCellDisplayNames || {}}
            isOptimizeDisabled={isOptimizeDisabled}
            optimizeButtonTitle={optimizeButtonTitle}
            onOptimize={handleOptimize}
            onAssignmentChange={handleAssignmentChange}
            onClearAll={handleClearAllAssignments}
            showInfo={showInfo}
          />
        )}
      </div>

      {/* Tab bar -- hidden during drill-down */}
      {!isDrillDown && (
        <MobileTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* Toasts -- positioned above tab bar */}
      <ToastManager toasts={toasts} onRemoveToast={removeToast} />
    </div>
    </TooltipProvider>
  );
}
