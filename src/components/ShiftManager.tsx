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
import { useMemo, useState, useRef, useEffect } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import tumbleweedIcon from "../../assets/tumbleweed.svg";
import { shiftState, getActiveRosterFromState, shiftScheduleInfoSelector } from "../stores/shiftStore";
import { RosterSwitcher } from "./RosterSwitcher";
import { AvailabilityTableView } from "./AvailabilityTableView";
import { EditButton } from "./EditButton";
import { PostListActions } from "./PostListActions";
import { ShiftInfoSettingsView } from "./ShiftInfoSettingsView";
import { SplitScreen } from "./SplitScreen";
import { SyncStatusIcon } from "./SyncStatusIcon";
import { VerticalActionGroup } from "./VerticalActionGroup";
import { WorkerList } from "./WorkerList";
import { WorkerListActions } from "./WorkerListActions";
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
import { ShareButton } from "./ShareButton";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getSetting, setSetting } from "../lib/settings";
import { enableDebugMode, disableDebugMode } from "../lib/analytics";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { getActionHint } from "../service/actionHint";
import { useLevels } from "../hooks/useLevels";

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
  });

  let message = "";
  if (hint === null) return null;
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
    <div className={`ms-auto px-3 py-1 rounded-md text-xs text-end ${colors[variant]}`}>
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
  const [checkedUserIds, setCheckedUserIds] = useState<string[]>([]);
  const lastCheckedUserRef = useRef<number | null>(null);
  const [showShiftSettings, setShowShiftSettings] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Initialize the component
  useShiftManagerInitialization();

  // Use toast system
  const { toasts, removeToast, showSuccess, showError, showInfo } = useToast();

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
    handleUserSelect,
    resetAllAvailability,
  } = useUserHandlers();

  // Use post handlers
  const {
    checkedPostIds,
    addPost,
    handlePostEdit,
    handlePostCheck,
    handlePostUncheck,
    handlePostCheckAll,
    handleRemovePosts,
  } = usePostHandlers();

  // Use assignment handlers
  const { handleAssignmentNameUpdate, handleClearAllAssignments } =
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

  const selectedUser = useMemo(() => {
    return selectedUserId
      ? recoilState.userShiftData?.find(
          (userData) => userData.user.id === selectedUserId
        )
      : undefined;
  }, [selectedUserId, recoilState.userShiftData]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-full">
      <div
        id="header"
        dir="ltr"
        className="grid grid-cols-[auto_1fr_auto] gap-x-4 items-start mb-4 flex-none"
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
        <Card className="flex flex-row h-full overflow-hidden">
          <div className="flex flex-col p-2">
            <VerticalActionGroup className="flex-none gap-3">
              <SyncStatusIcon status={syncStatus} size={18} />
              <ShareButton
                posts={activeRoster.posts || []}
                hours={activeRoster.hours || defaultHours}
                assignments={assignments}
                userShiftData={recoilState.userShiftData || []}
                endTime={activeRoster.endTime || "18:00"}
                customCellDisplayNames={activeRoster.customCellDisplayNames || {}}
                groupBy="time"
                onCopied={() => showInfo(t("copiedToClipboard"))}
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
          <CardContent className="p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Shift Assignments - 50% */}
            <div
              className="flex flex-col min-h-0 overflow-hidden mb-2"
              style={{ height: "58%" }}
              id="assignments-table"
            >
              <div className="flex items-center gap-2 mb-2 flex-none">
                <h3 className="text-lg font-semibold">{t("shiftAssignments")}</h3>
                <RosterSwitcher />
                <div className="flex items-center gap-3 text-sm bg-muted px-3 py-1 rounded-md whitespace-nowrap">
                  <span className="font-medium">
                    {activeRoster.scheduleMode === "7d" ? t("weeklyRoster") : t("singleDay")}
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span className="font-medium">
                    {t("postsCount", { count: activeRoster.posts?.length || 0 })}
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span className="font-medium">
                    {activeRoster.scheduleMode === "7d"
                      ? t("shiftsPerDay", { count: scheduleInfo.shiftsCount })
                      : t("shiftsCount", { count: scheduleInfo.shiftsCount })}
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span className="font-medium">
                    {t("shiftDurationLabel", { duration: (isNaN(scheduleInfo.shiftDuration) ? 0 : scheduleInfo.shiftDuration).toFixed(1) })}
                  </span>
                </div>
                <PostListActions
                  isEditing={isEditing}
                  onAddPost={handleAddPost}
                  onRemovePosts={handleRemovePosts}
                  checkedPostIds={checkedPostIds}
                  onCheckAll={handlePostCheckAll}
                />
                <ActionHint
                  hasAssignments={assignments.some((post) => post.some((u) => u !== null))}
                  isOptimized={!!recoilState.optimizationSignature}
                />
              </div>
              <div className="flex-1 border-primary-rounded-lg overflow-hidden relative">
                {/* Clear assignments button */}
                {assignments.some((post) => post.some((u) => u !== null)) && (
                  <button
                    onClick={() => setIsClearDialogOpen(true)}
                    className="absolute top-1 end-1 z-20 px-2.5 py-1 rounded-full text-xs text-white bg-gray-900 hover:bg-gray-700 border border-white/30 transition-colors"
                  >
                    {t("clearAssignments")}
                  </button>
                )}
                {/* AvailabilityTableView - positioned at top left */}
                <div className="absolute top-0 start-0 w-full h-full">
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
                    mode="assignments"
                    assignments={assignments}
                    customCellDisplayNames={activeRoster.customCellDisplayNames}
                    selectedUserId={selectedUserId}
                    onConstraintsChange={() => {
                      // Assignment changes handled by table component directly
                    }}
                    isEditing={isEditing}
                    onPostEdit={handlePostEdit}
                    checkedPostIds={checkedPostIds}
                    onPostCheck={handlePostCheck}
                    onPostUncheck={handlePostUncheck}
                    onAssignmentEdit={handleAssignmentNameUpdate}
                  />
                </div>

                {/* Glass overlay for Post column header and content */}
                <div
                  className={`absolute top-0 start-0 w-[8rem] bottom-0 backdrop-blur-sm bg-black/25 transition-all duration-300 ${
                    showShiftSettings
                      ? "visible opacity-100"
                      : "invisible opacity-0 pointer-events-none"
                  }`}
                  onClick={() => handleCloseShiftSettings()}
                ></div>

                {/* Glass overlay for assignment content area */}
                <div
                  className={`absolute top-0 start-[8rem] end-0 bottom-0 backdrop-blur-sm bg-black/25 transition-all duration-300 ${
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
                    className="w-[40rem] max-w-[calc(100%-4rem)] max-h-[calc(100%-1rem)] overflow-auto rounded-lg border-2 border-foreground bg-background/90 backdrop-blur-md shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center px-2 pt-1 pb-1 sticky top-0 bg-background/90 backdrop-blur-md z-10">
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
              className="flex flex-col min-h-0 overflow-hidden"
              style={{ height: "40%" }}
            >
              <div className="flex items-center gap-2 flex-none mb-2">
                <h3 className="text-lg font-semibold">{t("staff")}</h3>
                <div className="flex items-center gap-3 text-sm bg-muted px-3 py-1 rounded-md">
                  <span className="font-medium">
                    {t("staffCount", { count: recoilState.userShiftData?.length || 0 })}
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span className="font-medium">
                    {(() => {
                      const staffCount = recoilState.userShiftData?.length || 0;
                      if (staffCount === 0) return "0";
                      let totalAssignments = 0;
                      for (const postAssignments of assignments) {
                        for (const assignedUserId of postAssignments) {
                          if (assignedUserId !== null) {
                            totalAssignments++;
                          }
                        }
                      }
                      return Math.round(totalAssignments / staffCount);
                    })()}{" "}
                    {t("avgShiftsLabel")}
                  </span>
                </div>
                <WorkerListActions
                  isEditing={isEditing}
                  onAddUser={handleAddUser}
                  onRemoveUsers={removeUsers}
                  onCheckAll={(allWasClicked) => {
                    setCheckedUserIds(
                      allWasClicked
                        ? recoilState.userShiftData?.map(
                            (userData) => userData.user.id
                          ) || []
                        : []
                    );
                  }}
                  checkedUserIds={checkedUserIds}
                  onResetAllAvailability={resetAllAvailability}
                />
              </div>
              <div className="flex-1 min-h-0">
                <SplitScreen
                  id="worker-info"
                  leftWidth="18%"
                  rightWidth="82%"
                  className="h-full overflow-hidden"
                  leftPanel={
                    <WorkerList
                      users={
                        recoilState.userShiftData?.map(
                          (userData) => userData.user
                        ) || []
                      }
                      selectedUserId={selectedUserId}
                      onSelectUser={handleUserSelect}
                      onEditUser={() => {}} // Temporarily disabled
                      onUpdateUserName={updateUserName}
                      isEditing={isEditing}
                      checkedUserIds={checkedUserIds}
                      onCheckUser={(userId, event) => {
                        const allUserIds = (recoilState.userShiftData || []).map((u) => u.user.id);
                        const currentIndex = allUserIds.indexOf(userId);
                        if (event?.shiftKey && lastCheckedUserRef.current !== null) {
                          const start = Math.min(lastCheckedUserRef.current, currentIndex);
                          const end = Math.max(lastCheckedUserRef.current, currentIndex);
                          const rangeIds = allUserIds.slice(start, end + 1);
                          setCheckedUserIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
                        } else {
                          setCheckedUserIds((prev) => [...prev, userId]);
                        }
                        lastCheckedUserRef.current = currentIndex;
                      }}
                      onUncheckUser={(userId) =>
                        setCheckedUserIds(
                          checkedUserIds.filter((id) => id !== userId)
                        )
                      }
                      assignments={assignments}
                    />
                  }
                  rightPanel={
                    <AvailabilityTableView
                      key={`availability-${selectedUserId}-${
                        recoilState.userShiftData
                          ?.map((u) => u.user.name)
                          .join("-") || "no-users"
                      }`}
                      user={
                        selectedUserId
                          ? recoilState.userShiftData?.find(
                              (u) => u.user.id === selectedUserId
                            )?.user
                          : undefined
                      }
                      availabilityConstraints={selectedUser?.constraintsByRoster?.[recoilState.activeRosterId] || selectedUser?.constraints}
                      posts={activeRoster.posts}
                      hours={activeRoster.hours || defaultHours}
                      endTime={activeRoster.endTime}
                      userShiftData={recoilState.userShiftData || []}
                      mode="availability"
                      onConstraintsChange={(newConstraints) => {
                        if (selectedUser) {
                          updateUserConstraints(
                            selectedUser.user.id,
                            newConstraints
                          );
                        }
                      }}
                      isEditing={isEditing}
                      onPostEdit={handlePostEdit}
                      selectedUserId={selectedUserId}
                      users={
                        recoilState.userShiftData?.map(
                          (userData) => userData.user
                        ) || []
                      }
                      onPostCheck={handlePostCheck}
                      onPostUncheck={handlePostUncheck}
                      onShowToast={(message, type) => {
                        if (type === "success") showSuccess(message);
                        else if (type === "error") showError(message);
                        else showInfo(message);
                      }}
                    />
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
      </div>
    </TooltipProvider>
  );
}
