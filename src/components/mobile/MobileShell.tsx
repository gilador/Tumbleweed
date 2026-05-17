import { useState, useCallback, useEffect, useRef } from "react";
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
import { trackEvent } from "../../lib/analytics";

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
  const { toasts, removeToast, showSuccess, showError, showInfo, showActionable } = useToast();

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
    updateUserName,
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

  const staffListRef = useRef<HTMLDivElement | null>(null);
  const staffScrollTopRef = useRef(0);

  // Restore staff-list scroll on round-trip back from drill-down. Chromium
  // auto-scrolls a focused descendant into view when its ancestor toggles
  // display:none → block, which clobbers native scrollTop preservation. The
  // ref is updated by the staff list's onScroll listener; the rAF re-applies
  // the saved value after the browser's auto-scroll has run.
  useEffect(() => {
    if (route.screen === "staff" && staffListRef.current) {
      const el = staffListRef.current;
      const target = staffScrollTopRef.current;
      el.scrollTop = target;
      const raf = requestAnimationFrame(() => {
        el.scrollTop = target;
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [route.screen]);

  const handleTabChange = (tab: TabId) => {
    if (tab === "settings") setRoute({ screen: "settings" });
    else if (tab === "staff") setRoute({ screen: "staff" });
    else if (tab === "assignments") setRoute({ screen: "assignments" });
  };

  const handleNavigateToAvailability = (userId: string) => {
    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }
    handleUserSelect(userId);
    trackEvent("staff-detail-open", { staffId: userId });
    setRoute({ screen: "staff-availability", userId });
  };

  const handleBack = () => {
    if (route.screen === "staff-availability") {
      if (
        typeof document !== "undefined" &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur();
      }
      trackEvent("staff-detail-back", {});
      setRoute({ screen: "staff" });
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* Main content */}
      <div className="flex-1 min-h-0 relative">
        {route.screen === "settings" && (
          <div className="absolute inset-0 overflow-y-auto">
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
              showToastWithAction={showActionable}
              dismissToast={removeToast}
            />
          </div>
        )}
        {/* Staff list — kept mounted while drill-down is open to preserve scroll position. */}
        {(route.screen === "staff" || route.screen === "staff-availability") && (
          <div
            ref={staffListRef}
            className="absolute inset-0 overflow-y-auto"
            style={{ display: route.screen === "staff" ? "block" : "none" }}
            onScroll={(e) => {
              if (route.screen === "staff") {
                staffScrollTopRef.current = e.currentTarget.scrollTop;
              }
            }}
          >
            <StaffTab
              userShiftData={recoilState.userShiftData || []}
              assignments={activeRoster.assignments || []}
              onSelectUser={handleNavigateToAvailability}
              onAddUser={handleAddUser}
              onRemoveUser={(userId) => removeUsers([userId])}
              onUpdateUserName={updateUserName}
            />
          </div>
        )}
        {route.screen === "staff-availability" && (
          <div className="absolute inset-0">
            <StaffAvailability
              userId={route.userId}
              userShiftData={recoilState.userShiftData || []}
              posts={activeRoster.posts || []}
              hours={activeRoster.hours || []}
              onBack={handleBack}
              onUpdateConstraints={updateUserConstraints}
            />
          </div>
        )}
        {route.screen === "assignments" && (
          <div className="absolute inset-0 overflow-y-auto">
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
          </div>
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
