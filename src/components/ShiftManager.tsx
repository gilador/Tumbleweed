import { Button } from "@/components/elements/button";
import { useTranslation } from "react-i18next";
import { IconBrandGithub, IconWand, IconLoader2, IconSettings, IconUser, IconLogin, IconLogout, IconAdjustments, IconAdjustmentsFilled, IconX } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/elements/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/elements/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useRef, useEffect } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import tumbleweedIcon from "../../assets/tumbleweed.svg";
import { shiftState, getActiveRosterFromState, shiftScheduleInfoSelector } from "../stores/shiftStore";
import { useMultiSelect } from "../stores/selectionStore";
import { AvailabilityTableView } from "./AvailabilityTableView";
import { AvailabilityHeatmap } from "./AvailabilityHeatmap";
import { EditButton } from "./EditButton";
import { ScheduleSectionHeader } from "./ScheduleSectionHeader";
import { StaffSectionHeader } from "./StaffSectionHeader";
import { ShiftInfoSettingsView } from "./ShiftInfoSettingsView";
import { SplitScreen } from "./SplitScreen";
import { SyncStatusIcon } from "./SyncStatusIcon";
import { VerticalActionGroup } from "./VerticalActionGroup";
import { WorkerList } from "./WorkerList";
import { ContextMenuRoot } from "./schedule/ContextMenu";
import { useShiftManagerInitialization } from "../hooks/useShiftManagerInitialization";
import { useShiftOptimization } from "../hooks/useShiftOptimization";
import { useUserHandlers } from "../hooks/useUserHandlers";
import { usePostHandlers } from "../hooks/usePostHandlers";
import { useAssignmentHandlers } from "../hooks/useAssignmentHandlers";
import { useToast } from "../hooks/useToast";
import { ToastManager } from "./Toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { defaultHours } from "../constants/shiftManagerConstants";

import { useAuth } from "../lib/auth";
import { SharePopup } from "./SharePopup";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getSetting, setSetting } from "../lib/settings";
import { enableDebugMode, disableDebugMode, trackEvent } from "../lib/analytics";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { getActionHint } from "../service/actionHint";
import { useLevels } from "../hooks/useLevels";
import { WeeklyRosterGrid } from "./WeeklyRosterGrid";

function ActionHint({ hasAssignments, isOptimized }: {
  hasAssignments: boolean;
  isOptimized: boolean;
}) {
  const { t } = useTranslation();
  const [recoilStateForHint] = useRecoilState(shiftState);
  const { opHours, staff, posts } = useLevels();

  const { hint, variant } = getActionHint({
    posts, staff, opHours, hasAssignments, isOptimized,
    selectedShiftCount: recoilStateForHint.selectedShiftCount,
    optimizationFailed: recoilStateForHint.optimizationFailed,
  });

  let message = "";
  if (hint === null || hint.key === "hintOptimized") return null;
  if (hint.key === "hintOverCapacity") {
    message = t(hint.key, { capacity: hint.capacity, needed: hint.needed });
  } else {
    message = t(hint.key);
  }

  if (!message) return null;

  const colors = {
    info: "text-muted-foreground bg-muted/50",
    warning: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30",
    success: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30",
  };

  return (
    <div className={`px-3 py-1 rounded-md text-xs text-end whitespace-nowrap ${colors[variant]}`}>
      {message}
    </div>
  );
}

export function ShiftManager() {
  const { t } = useTranslation();
  const { isAuthenticated, user, signInWithGoogle, signOut } = useAuth();
  const [recoilState] = useRecoilState(shiftState);
  const activeRoster = getActiveRosterFromState(recoilState);
  const scheduleInfo = useRecoilValue(shiftScheduleInfoSelector);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [shareDebugInfo, setShareDebugInfo] = useState(() => getSetting("shareDebugInfo"));
  const [showDebugDialog, setShowDebugDialog] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showUserMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showUserMenu]);

  const [isEditing, setIsEditing] = useState(false);
  const lastCheckedUserRef = useRef<number | null>(null);
  const {
    multiSelected,
    multiSelectKind,
    inMulti,
    isMultiChecked,
    enterMulti,
    exitMulti,
    toggleInMulti,
    handleStaffRowClick,
  } = useMultiSelect();
  const checkedUserIds: string[] =
    multiSelectKind === "staff" && multiSelected ? Array.from(multiSelected) : [];
  const [showShiftSettings, setShowShiftSettings] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [pendingDeletePostId, setPendingDeletePostId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [weeklyView, setWeeklyView] = useState(false);

  // Initialize the component
  useShiftManagerInitialization();

  // Use toast system
  const { toasts, removeToast, showSuccess, showError, showInfo, showActionable } = useToast();

  // Use optimization hook
  const { isOptimizeDisabled, optimizeButtonTitle, handleOptimize } =
    useShiftOptimization(
      isEditing,
      showSuccess,
      showError,
      showInfo
    );

  // Use user handlers
  const {
    selectedUserId,
    addUser,
    updateUserConstraints,
    updateUserName,
    removeUsers,
    removeSingleUser,
    handleUserSelect,
    resetAvailabilityForUsers,
  } = useUserHandlers();

  // Use post handlers
  const {
    checkedPostIds,
    addPost,
    handlePostEdit,
    handlePostCheck,
    handlePostUncheck,
    handleRemovePosts,
    removeSinglePost,
    justAddedPostId,
    consumeJustAddedPostId,
  } = usePostHandlers();
  void checkedPostIds;
  void handlePostCheck;
  void handlePostUncheck;

  // Use assignment handlers
  const { handleAssignmentChange, handleAssignmentNameUpdate, handleClearAllAssignments } =
    useAssignmentHandlers();

  // Handle shift settings toggle
  const handleToggleShiftSettings = () => {
    setShowShiftSettings(!showShiftSettings);
  };

  const handleCloseShiftSettings = () => {
    setShowShiftSettings(false);
  };

  // Close shift settings on Esc key
  useEffect(() => {
    if (!showShiftSettings) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseShiftSettings();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showShiftSettings]);

  // Enhanced addPost with toast notification
  const handleAddPost = () => {
    const postName = addPost();
    showSuccess(t("postWasAdded", { name: postName }), 3000, postName);
  };

  // Cmd/Ctrl+A inside schedule grid → select all visible posts; inside staff list → select all staff.
  const scheduleGridRef = useRef<HTMLDivElement>(null);
  const staffListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.key === "a" || e.key === "A")) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (target && target.isContentEditable) return;

      const inSchedule =
        scheduleGridRef.current && target && scheduleGridRef.current.contains(target);
      const inStaff =
        staffListRef.current && target && staffListRef.current.contains(target);

      if (inSchedule) {
        const allPostIds =
          getActiveRosterFromState(recoilState).posts?.map((p) => p.id) || [];
        if (allPostIds.length === 0) return;
        e.preventDefault();
        enterMulti(allPostIds, "posts");
        trackEvent("multi-select-start", { kind: "posts", entry: "cmd-a" });
        trackEvent("cmd-a-select-all", { kind: "posts", count: allPostIds.length });
      } else if (inStaff) {
        const allUserIds =
          (recoilState.userShiftData || []).map((u) => u.user.id);
        if (allUserIds.length === 0) return;
        e.preventDefault();
        enterMulti(allUserIds, "staff");
        trackEvent("multi-select-start", { kind: "staff", entry: "cmd-a" });
        trackEvent("cmd-a-select-all", { kind: "staff", count: allUserIds.length });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [recoilState, enterMulti]);

  // Clear justAddedPostId after a tick so PostHeadRow only auto-focuses once
  useEffect(() => {
    if (justAddedPostId) {
      const id = window.setTimeout(() => consumeJustAddedPostId(), 0);
      return () => window.clearTimeout(id);
    }
  }, [justAddedPostId, consumeJustAddedPostId]);

  // Enhanced addUser with toast notification
  const handleAddUser = () => {
    const userName = addUser();
    showSuccess(t("userWasAddedToStaff", { name: userName }), 3000, userName);
  };

  const assignments =
    activeRoster.assignments ||
    (activeRoster.posts || []).map(() =>
      (activeRoster.hours || defaultHours).map(() => null)
    );

  const syncStatus = recoilState.syncStatus;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-full">
      <div
        id="header"
        dir="ltr"
        className="grid grid-cols-[auto_1fr_auto] gap-x-4 items-start mb-2 flex-none"
      >
        <img
          src={tumbleweedIcon}
          alt="Tumbleweed Icon"
          className="w-16 h-full dark-invert"
        />
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">{t("tumbleweed")}</h1>
          <h2 className="text-md text-muted-foreground">{t("shiftManager")}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-2 rounded-full hover:opacity-80 transition-opacity"
            >
              {isAuthenticated && user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-10 h-10 rounded-full border border-gray-700 dark:border-gray-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <IconUser size={18} className="text-muted-foreground" />
                </div>
              )}
            </button>
              {shareDebugInfo && (
                <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center pointer-events-none z-10">!</span>
              )}
            {showUserMenu && (
              <div className="absolute end-0 mt-2 w-48 bg-popover text-popover-foreground rounded-lg shadow-lg border p-3 z-50 text-start">
                {isAuthenticated && (
                  <>
                    <div className="text-sm font-medium">{user?.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                    <hr className="my-2" />
                  </>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <LanguageSwitcher />
                  <ThemeSwitcher />
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); setIsSettingsOpen(true); }}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full text-start"
                >
                  <IconSettings size={16} />
                  {t("Settings")}
                  {shareDebugInfo && (
                    <span className="w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">!</span>
                  )}
                </button>
                <a
                  href="https://github.com/gilador/Tumbleweed"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full text-start mt-1"
                >
                  <IconBrandGithub size={16} />
                  {t("sourceCode")}
                </a>
                <hr className="my-2" />
                {isAuthenticated ? (
                  <button
                    onClick={() => { signOut(); setShowUserMenu(false); }}
                    className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 w-full text-start"
                  >
                    <IconLogout size={16} />
                    {t("signOut")}
                  </button>
                ) : (
                  <button
                    onClick={() => { signInWithGoogle(); setShowUserMenu(false); }}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 w-full text-start"
                  >
                    <IconLogin size={16} />
                    {t("signInWithGoogle")}
                  </button>
                )}
                <div className="text-[10px] text-muted-foreground/50 text-center mt-2 select-none">v{APP_VERSION}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div id="content" className="flex-1 min-h-0">
        <Card className="flex flex-row h-full">
          <div className="flex flex-col pt-5 px-2 pb-2">
            <VerticalActionGroup className="flex-none gap-3">
              <SyncStatusIcon status={syncStatus} size={18} />
              <SharePopup
                onCopied={() => showInfo(t("exportedToDrive"))}
                disabled={!assignments.some((post) => post.some((u) => u !== null))}
              />
              <EditButton
                isEditing={isEditing}
                onToggle={() => {
                  const newIsEditing = !isEditing;
                  setIsEditing(newIsEditing);
                  if (newIsEditing) {
                    handleUserSelect(null);
                  }
                }}
              />
              <button
                onClick={handleToggleShiftSettings}
                aria-label={showShiftSettings ? t("hideShiftAdjustment") : t("showShiftAdjustment")}
                title={showShiftSettings ? t("hideShiftAdjustment") : t("showShiftAdjustment")}
                className="p-2 rounded-md hover:bg-accent"
              >
                {showShiftSettings ? (
                  <IconAdjustmentsFilled size={18} />
                ) : (
                  <IconAdjustments size={18} />
                )}
              </button>
            </VerticalActionGroup>
          </div>
          <CardContent className="flex flex-col flex-1 min-w-0 min-h-0 p-0 pb-8">
            {/* Shift Assignments - 50% */}
            <div
              className="flex flex-col min-w-0 min-h-0 mb-2 focus:outline-none"
              style={{ height: "58%" }}
              id="assignments-table"
              data-testid="schedule-section"
              ref={scheduleGridRef}
              tabIndex={-1}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget)
                  (e.currentTarget as HTMLElement).focus();
              }}
            >
              <ScheduleSectionHeader
                postsCount={activeRoster.posts?.length || 0}
                shiftsPerDay={scheduleInfo.shiftsCount}
                shiftDuration={scheduleInfo.shiftDuration}
                scheduleMode={activeRoster.scheduleMode === "7d" ? "7d" : "24h"}
                weeklyView={weeklyView}
                onWeeklyViewChange={setWeeklyView}
                endSlot={
                  <ActionHint
                    hasAssignments={assignments.some((post) => post.some((u) => u !== null))}
                    isOptimized={!!recoilState.optimizationSignature}
                  />
                }
              />
              <div className="flex-1 border-primary-rounded-lg relative">
                {/* Assignment view - either weekly grid or daily table */}
                <div className="absolute top-0 start-0 w-full h-full">
                  {weeklyView && activeRoster.scheduleMode === "7d" ? (
                    <WeeklyRosterGrid
                      posts={activeRoster.posts}
                      hours={activeRoster.hours || defaultHours}
                      assignments={assignments}
                      userShiftData={recoilState.userShiftData || []}
                      endTime={activeRoster.endTime}
                      customCellDisplayNames={activeRoster.customCellDisplayNames}
                      startDate={activeRoster.startDate}
                      selectedUserId={selectedUserId}
                      onAssignmentChange={handleAssignmentChange}
                    />
                  ) : (
                    <AvailabilityTableView
                      key={`assignments-${
                        recoilState.userShiftData
                          ?.map((u) => u.user.name)
                          .join("-") || "no-users"
                      }-${
                        activeRoster.posts?.map((p) => p.id).join("-") ||
                        "no-posts"
                      }`}
                      className="h-full"
                      posts={activeRoster.posts}
                      hours={activeRoster.hours || defaultHours}
                      endTime={activeRoster.endTime}
                      users={
                        recoilState.userShiftData?.map(
                          (userData) => userData.user
                        ) || []
                      }
                      userShiftData={recoilState.userShiftData || []}
                      assignments={assignments}
                      customCellDisplayNames={activeRoster.customCellDisplayNames}
                      selectedUserId={selectedUserId}
                      isEditing={isEditing}
                      onPostEdit={handlePostEdit}
                      onPostDeleteSingle={setPendingDeletePostId}
                      onAssignmentEdit={handleAssignmentNameUpdate}
                      justAddedPostId={justAddedPostId}
                      onAddPost={handleAddPost}
                      allPostIds={activeRoster.posts?.map((p) => p.id) || []}
                      onBulkDelete={handleRemovePosts}
                      hasAssignments={assignments.some((post) => post.some((u) => u !== null))}
                      onClearAssignments={() => setIsClearDialogOpen(true)}
                    />
                  )}
                </div>

                {/* Glass overlay covering the full schedule area */}
                <div
                  className={`absolute inset-0 rounded-[inherit] backdrop-blur-sm bg-black/25 transition-all duration-300 ${
                    showShiftSettings
                      ? "visible opacity-100"
                      : "invisible opacity-0 pointer-events-none"
                  }`}
                  onClick={() => handleCloseShiftSettings()}
                ></div>

                {/* Shift Adjustment - positioned below hours headers */}
                <div
                  className={`flex justify-center items-start w-full h-full transition-all duration-300 relative z-10 ${
                    showShiftSettings
                      ? "visible opacity-100"
                      : "invisible opacity-0 pointer-events-none"
                  }`}
                  onClick={() => handleCloseShiftSettings()}
                  style={{ paddingTop: "0.5rem" }}
                >
                  <div
                    className="w-[40rem] max-w-[calc(100%-4rem)] rounded-lg border-2 border-border bg-background/90 backdrop-blur-md shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center px-2 pt-1 pb-1 bg-background/90 backdrop-blur-md">
                      <h4 className="text-base font-semibold text-start">{t("shiftAdjustment")}</h4>
                      <button
                        onClick={handleCloseShiftSettings}
                        aria-label={t("closeShiftAdjustment")}
                        title={t("closeShiftAdjustment")}
                        className="p-1 rounded-md hover:bg-accent transition-colors"
                      >
                        <IconX size={16} />
                      </button>
                    </div>
                    <ShiftInfoSettingsView
                      startHour={activeRoster.startTime ?? "08:00"}
                      endHour={activeRoster.endTime ?? "16:00"}
                      posts={activeRoster.posts || []}
                      showToastWithAction={showActionable}
                      dismissToast={removeToast}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Clear Dialog */}
            <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("clearAllAssignmentsTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("clearAllAssignmentsDescription")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:space-x-0">
                  <Button
                    variant="outline"
                    onClick={() => setIsClearDialogOpen(false)}
                    size="sm"
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleClearAllAssignments();
                      setIsClearDialogOpen(false);
                    }}
                    size="sm"
                  >
                    {t("clear")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={pendingDeletePostId !== null}
              onOpenChange={(open) => !open && setPendingDeletePostId(null)}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("deletePostConfirmSingle")}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <p className="text-muted-foreground">{t("onceDeletedNoUndo")}</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPendingDeletePostId(null)}>
                      {t("no")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (pendingDeletePostId) removeSinglePost(pendingDeletePostId);
                        setPendingDeletePostId(null);
                      }}
                    >
                      {t("yesPlease")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("settings")}</DialogTitle>
                  <DialogDescription>
                    {t("settingsDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shareDebugInfo}
                      onChange={() => {
                        if (!shareDebugInfo) {
                          setShowDebugDialog(true);
                        } else {
                          setSetting("shareDebugInfo", false);
                          setShareDebugInfo(false);
                          disableDebugMode();
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{t("shareDebugInfo")}</span>
                    {shareDebugInfo && (
                      <span className="w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">!</span>
                    )}
                  </label>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsSettingsOpen(false)}
                    size="sm"
                  >
                    {t("close")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Staff Section - 40% */}
            <div
              id="staff_section"
              data-testid="staff-section"
              ref={staffListRef}
              className="flex flex-col min-w-0 min-h-0 focus:outline-none pt-1"
              style={{ height: "40%" }}
              tabIndex={-1}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget)
                  (e.currentTarget as HTMLElement).focus();
              }}
            >
              {(() => {
                const staffCount = recoilState.userShiftData?.length || 0;
                let totalAssignments = 0;
                if (staffCount > 0) {
                  for (const postAssignments of assignments) {
                    for (const assignedUserId of postAssignments) {
                      if (assignedUserId !== null) totalAssignments++;
                    }
                  }
                }
                const avg = staffCount === 0 ? 0 : Math.round(totalAssignments / staffCount);
                const allUserIds = (recoilState.userShiftData || []).map(
                  (u) => u.user.id
                );
                return (
                  <StaffSectionHeader
                    staffCount={staffCount}
                    avgShifts={avg}
                    onAdd={handleAddUser}
                    allUserIds={allUserIds}
                    onBulkDelete={(ids) => {
                      removeUsers(ids);
                      exitMulti();
                    }}
                  />
                );
              })()}
              <div className="flex-1 min-h-0 px-1">
                <SplitScreen
                  id="worker-info"
                  leftWidth="18%"
                  rightWidth="82%"
                  className="h-full"
                  leftPanel={
                  <div className="h-full flex flex-col min-h-0">
                      <WorkerList
                        users={
                          recoilState.userShiftData?.map(
                            (userData) => userData.user
                          ) || []
                        }
                        selectedUserId={selectedUserId}
                        onSelectUser={(id) => {
                          if (id === null) {
                            // Clear viewing-selection only. We deliberately do
                            // NOT exitMulti here — WorkerList sends null when
                            // unchecking the currently-selected row, and other
                            // rows may still be checked. toggleInMultiPure
                            // already auto-exits when the set reaches empty.
                            handleUserSelect(null);
                          } else {
                            if (multiSelectKind !== "staff" && selectedUserId === null) {
                              trackEvent("multi-select-start", {
                                kind: "staff",
                                entry: "row-click",
                              });
                            }
                            handleStaffRowClick(id);
                          }
                        }}
                        onUpdateUserName={updateUserName}
                        checkedUserIds={checkedUserIds}
                        inStaffMulti={inMulti("staff")}
                        onCheckUser={(userId, event) => {
                          const allUserIds = (recoilState.userShiftData || []).map((u) => u.user.id);
                          const currentIndex = allUserIds.indexOf(userId);
                          if (event?.shiftKey && lastCheckedUserRef.current !== null) {
                            const start = Math.min(lastCheckedUserRef.current, currentIndex);
                            const end = Math.max(lastCheckedUserRef.current, currentIndex);
                            const rangeIds = allUserIds.slice(start, end + 1);
                            const existing = isMultiChecked(userId, "staff") || multiSelectKind === "staff"
                              ? Array.from(multiSelected ?? [])
                              : [];
                            enterMulti(Array.from(new Set([...existing, ...rangeIds])), "staff");
                            trackEvent("multi-select-start", { kind: "staff", entry: "checkbox" });
                          } else if (multiSelectKind === "staff") {
                            if (!multiSelected?.has(userId)) toggleInMulti(userId);
                          } else {
                            enterMulti([userId], "staff");
                            trackEvent("multi-select-start", { kind: "staff", entry: "checkbox" });
                          }
                          lastCheckedUserRef.current = currentIndex;
                        }}
                        onUncheckUser={(userId) => {
                          if (multiSelectKind === "staff" && multiSelected?.has(userId)) {
                            toggleInMulti(userId);
                          }
                        }}
                        assignments={assignments}
                      />
                    </div>
                  }
                  rightPanel={
                    <div className="h-full flex flex-col min-h-0">
                      <AvailabilityHeatmap
                        posts={activeRoster.posts}
                        hours={activeRoster.hours || defaultHours}
                        endTime={activeRoster.endTime}
                        userShiftData={recoilState.userShiftData || []}
                        onConstraintsChange={(userId, newConstraints) =>
                          updateUserConstraints(userId, newConstraints)
                        }
                        onShowToast={(message, type) => {
                          if (type === "success") showSuccess(message);
                          else if (type === "error") showError(message);
                          else showInfo(message);
                        }}
                        onResetAvailability={resetAvailabilityForUsers}
                      />
                    </div>
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Optimize FAB */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            id="optimize-button"
            onClick={async () => {
              if (isOptimizing) return;
              if (isOptimizeDisabled) {
                showInfo(t("alreadyOptimised"));
                return;
              }
              setIsOptimizing(true);
              try {
                await handleOptimize();
              } finally {
                setIsOptimizing(false);
              }
            }}
            className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all z-10 ${
              isOptimizeDisabled || isOptimizing
                ? "bg-gray-500 text-gray-300 cursor-default"
                : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
            }`}
          >
            {isOptimizing ? (
              <IconLoader2 size={24} className="animate-spin" />
            ) : (
              <IconWand size={24} className={isOptimizeDisabled ? "wand-icon-disabled" : "wand-icon"} />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{optimizeButtonTitle}</p>
        </TooltipContent>
      </Tooltip>

      {/* Toast Notifications */}
      <ToastManager toasts={toasts} onRemoveToast={removeToast} />

      {/* Debug Info Confirmation Dialog */}
      <Dialog open={showDebugDialog} onOpenChange={setShowDebugDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("shareDebugInfoDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("shareDebugInfoDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 px-2">
            <li>{t("shareDebugInfoRisk1")}</li>
            <li>{t("shareDebugInfoRisk2")}</li>
            <li>{t("shareDebugInfoRisk3")}</li>
            <li>{t("shareDebugInfoRisk4")}</li>
          </ul>
          <p className="text-xs text-gray-500 px-2">
            {t("shareDebugInfoNote")}
          </p>
          <DialogFooter className="sm:space-x-0 gap-6 mt-4">
            <Button variant="outline" className="px-8" onClick={() => setShowDebugDialog(false)}>
              {t("shareDebugInfoCancel")}
            </Button>
            <Button
              className="px-8"
              variant="destructive"
              onClick={() => {
                setSetting("shareDebugInfo", true);
                setShareDebugInfo(true);
                if (user?.email) {
                  enableDebugMode(user.email, user.email);
                }
                setShowDebugDialog(false);
              }}
            >
              {t("shareDebugInfoEnable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ContextMenuRoot
        handlers={{
          onCopyName: (kind, targetId) => {
            const text =
              kind === "posts"
                ? activeRoster.posts?.find((p) => p.id === targetId)?.value ?? ""
                : recoilState.userShiftData?.find((u) => u.user.id === targetId)?.user.name ?? "";
            if (text && navigator.clipboard) {
              void navigator.clipboard.writeText(text);
            }
          },
          onDelete: (kind, targetId) => {
            if (kind === "posts") setPendingDeletePostId(targetId);
            else removeSingleUser(targetId);
          },
        }}
      />
      </div>
    </TooltipProvider>
  );
}
