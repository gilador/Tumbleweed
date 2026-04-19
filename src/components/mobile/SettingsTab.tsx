import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilState } from "recoil";
import { shiftState, getActiveRosterFromState, updateActiveRoster } from "../../stores/shiftStore";
import { UniqueString } from "../../models/index";
import { UserShiftData } from "../../models";
import { RosterSwitcher } from "../RosterSwitcher";
import { SyncStatusIcon } from "../SyncStatusIcon";
import { TimeInput } from "../TimeInput";
import { IconPlus, IconTrash, IconPencil, IconCheck, IconX, IconUser, IconLogin, IconLogout, IconBrandGithub, IconSettings } from "@tabler/icons-react";
import { useLevels } from "../../hooks/useLevels";
import { useAuth } from "../../lib/auth";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { getSetting, setSetting } from "../../lib/settings";
// computeCapacity removed — using useLevels instead
import { enableDebugMode, disableDebugMode } from "../../lib/analytics";
import { ThemeSwitcher } from "../ThemeSwitcher";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../elements/dialog";
import { Button } from "../elements/button";
import tumbleweedIcon from "../../../assets/tumbleweed.svg";
import { useScheduleMode } from "../../hooks/useScheduleMode";
import { encodeFlatHour } from "../../service/weeklyScheduleUtils";
import { ShiftLevel } from "../../service/shiftLevels";
import { generateDynamicHours, generateWeeklyDynamicHours } from "../../service/shiftManagerUtils";

interface SettingsTabProps {
  posts: UniqueString[];
  hours: UniqueString[];
  startTime: string;
  endTime: string;
  restTime?: number; // legacy, unused
  userShiftData: UserShiftData[];
  onAddPost: () => void;
  onRemovePost: (postId: string) => void;
  onEditPost: (postId: string, newName: string) => void;
  editingPostId: string | null;
  setEditingPostId: (id: string | null) => void;
  editingPostName: string;
  setEditingPostName: (name: string) => void;
  savePostEdit: () => void;
}

export function SettingsTab({
  posts,
  startTime,
  endTime,
  restTime: _restTime,
  userShiftData,
  onAddPost,
  onRemovePost,
  editingPostId,
  setEditingPostId,
  editingPostName,
  setEditingPostName,
  savePostEdit,
}: SettingsTabProps) {
  const { t } = useTranslation();
  const { isAuthenticated, user, signInWithGoogle, signOut } = useAuth();
  const [recoilState, setShiftData] = useRecoilState(shiftState);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [shareDebugInfo, setShareDebugInfo] = useState(() => getSetting("shareDebugInfo"));
  const [showDebugDialog, setShowDebugDialog] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const staffCount = recoilState.userShiftData?.length || userShiftData.length;
  // scheduleInfo removed — using levels for shift info
  const { scheduleMode, startDate, switchTo7D, switchTo24H, updateStartDate } = useScheduleMode();

  const { levels, selectedLevel, setLevel: setLevelHook } = useLevels();

  const applyLevel = (level: ShiftLevel) => {
    const newHours = scheduleMode === "7d"
      ? generateWeeklyDynamicHours(startTime, endTime, posts.length, staffCount, level.shifts)
      : generateDynamicHours(startTime, endTime, posts.length, staffCount, level.shifts);

    setShiftData((prev) => {
      const roster = getActiveRosterFromState(prev);
      const activeRosterId = prev.activeRosterId;

      const updatedUserShiftData = (prev.userShiftData || []).map((userData) => {
        const updatedConstraints = (roster.posts || []).map((post, postIdx) => {
          return newHours.map((hour, hourIndex) => {
            const existingConstraint = userData.constraints?.[postIdx]?.[hourIndex];
            return existingConstraint || { postID: post.id, hourID: hour.id, availability: true };
          });
        });
        return {
          ...userData,
          constraints: updatedConstraints,
          constraintsByRoster: { ...userData.constraintsByRoster, [activeRosterId]: updatedConstraints },
        };
      });

      const shouldClearAssignments = roster.hours?.length !== newHours.length;
      const clearedAssignments = shouldClearAssignments
        ? (roster.posts || []).map(() => newHours.map(() => null))
        : roster.assignments;

      return {
        ...updateActiveRoster(prev, (r) => ({
          ...r,
          startTime,
          endTime,
          hours: newHours,
          assignments: clearedAssignments,
        })),
        selectedShiftCount: level.shifts,
        userShiftData: updatedUserShiftData,
      };
    });
  };

  const updateShiftStateWithNewHours = useCallback(
    (newStartTime: string, newEndTime: string, _newIntensity: number) => {
      const newDuration = selectedLevel?.duration ?? 0;

      // Calculate shift starting times
      const [startH, startM] = newStartTime.split(":").map(Number);
      const [endH, endM] = newEndTime.split(":").map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;
      const durationMin = newDuration * 60;

      const newShiftTimes: string[] = [];
      if (durationMin > 0 && endMin > startMin) {
        let curr = startMin;
        while (curr < endMin) {
          const h = Math.floor(curr / 60);
          const m = curr % 60;
          newShiftTimes.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
          curr += durationMin;
        }
      }

      let newHours: UniqueString[];
      if (scheduleMode === "7d") {
        newHours = [];
        for (let day = 0; day < 7; day++) {
          for (let i = 0; i < newShiftTimes.length; i++) {
            newHours.push({
              id: `d${day}-h${i}`,
              value: encodeFlatHour(day, newShiftTimes[i]),
            });
          }
        }
      } else {
        newHours = newShiftTimes.map((time, i) => ({
          id: `shift-${i}-${time}`,
          value: time,
        }));
      }

      setShiftData((prev) => {
        const roster = getActiveRosterFromState(prev);
        const activeRosterId = prev.activeRosterId;

        const updatedUserShiftData = (prev.userShiftData || []).map((userData) => {
          const updatedConstraints = (roster.posts || []).map((post, postIdx) => {
            return newHours.map((hour, hourIndex) => {
              const existing = userData.constraints?.[postIdx]?.[hourIndex];
              return existing || { postID: post.id, hourID: hour.id, availability: true };
            });
          });
          return {
            ...userData,
            constraints: updatedConstraints,
            constraintsByRoster: {
              ...userData.constraintsByRoster,
              [activeRosterId]: updatedConstraints,
            },
          };
        });

        const shouldClearAssignments = roster.hours?.length !== newHours.length;
        const assignments = shouldClearAssignments
          ? (roster.posts || []).map(() => newHours.map(() => null))
          : roster.assignments;

        return {
          ...updateActiveRoster(prev, (r) => ({
            ...r,
            startTime: newStartTime,
            endTime: newEndTime,
            hours: newHours,
            assignments,
          })),
          selectedShiftCount: recoilState.selectedShiftCount,
          userShiftData: updatedUserShiftData,
        };
      });
    },
    [posts.length, staffCount, setShiftData, scheduleMode]
  );


  return (
    <div className="px-4 py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <img src={tumbleweedIcon} alt="Tumbleweed" className="w-10 h-10 dark-invert" />
        <div className="flex-1">
          <h1 className="text-lg font-bold">{t("tumbleweed")}</h1>
          <p className="text-xs text-muted-foreground">{t("shiftManager")}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            className="rounded-full hover:opacity-80 transition-opacity"
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
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute ltr:right-0 rtl:left-0 mt-2 w-48 bg-popover text-popover-foreground rounded-lg shadow-lg border p-3 z-50">
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
            </>
          )}
        </div>
      </div>

      {/* Roster Switcher + Sync Status */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <RosterSwitcher />
        </div>
        <SyncStatusIcon status={recoilState.syncStatus} size={16} />
      </div>

      {/* Operation Hours */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-sm font-semibold">{t("operationHours")}</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">{t("start")}</label>
            <TimeInput
              value={startTime}
              onChange={(time) => updateShiftStateWithNewHours(time, endTime, 0)}
            />
          </div>
          <span className="text-muted-foreground mt-5 icon-flip">→</span>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">{t("end")}</label>
            <TimeInput
              value={endTime}
              onChange={(time) => updateShiftStateWithNewHours(startTime, time, 0)}
            />
          </div>
        </div>
      </div>

      {/* Schedule Mode */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-sm font-semibold">{t("scheduleMode")}</h2>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => { if (scheduleMode !== "24h") switchTo24H(); }}
              className={`px-4 py-2 text-sm font-medium min-h-[44px] transition-colors ${
                scheduleMode === "24h"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {t("singleDay")}
            </button>
            <button
              onClick={() => { if (scheduleMode !== "7d") switchTo7D(); }}
              className={`px-4 py-2 text-sm font-medium min-h-[44px] transition-colors ${
                scheduleMode === "7d"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {t("weeklyRoster")}
            </button>
          </div>
        </div>
        {scheduleMode === "7d" && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">{t("startingDate")}</label>
            <input
              type="date"
              value={startDate || ""}
              onChange={(e) => updateStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md text-sm min-h-[44px] bg-background text-foreground"
            />
          </div>
        )}
      </div>

      {/* Posts */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-sm font-semibold">{t("posts")}</h2>
        <div className="space-y-2">
          {posts.map((post) => (
            <div key={post.id} className="flex items-center gap-2 min-h-[44px]">
              {editingPostId === post.id ? (
                <>
                  <input
                    type="text"
                    value={editingPostName}
                    onChange={(e) => setEditingPostName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") savePostEdit();
                      if (e.key === "Escape") setEditingPostId(null);
                    }}
                  />
                  <button
                    onClick={savePostEdit}
                    className="p-2 rounded-md hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <IconCheck size={18} className="text-primary" />
                  </button>
                  <button
                    onClick={() => setEditingPostId(null)}
                    className="p-2 rounded-md hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <IconX size={18} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm py-2">{post.value}</span>
                  <button
                    onClick={() => {
                      setEditingPostId(post.id);
                      setEditingPostName(post.value);
                    }}
                    className="p-2 rounded-md hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <IconPencil size={16} className="text-muted-foreground" />
                  </button>
                  {deleteConfirmPostId === post.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          onRemovePost(post.id);
                          setDeleteConfirmPostId(null);
                        }}
                        className="p-2 rounded-md bg-destructive/10 hover:bg-destructive/20 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <IconCheck size={16} className="text-destructive" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmPostId(null)}
                        className="p-2 rounded-md hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <IconX size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmPostId(post.id)}
                      className="p-2 rounded-md hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <IconTrash size={16} className="text-muted-foreground" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={onAddPost}
          className="flex items-center gap-2 text-sm text-primary hover:bg-accent rounded-md px-3 py-2 w-full min-h-[44px]"
        >
          <IconPlus size={16} />
          {t("addPost")}
        </button>
      </div>

      {/* Intensity (Level Slider) */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-sm font-semibold">{t("shiftIntensity")}</h2>
        {(() => {
          const feasibleLevels = levels.filter((l) => l.feasible);
          const selectedIdx = selectedLevel ? levels.indexOf(selectedLevel) : -1;

          if (levels.length === 0) {
            return <p className="text-xs text-muted-foreground text-center">{t("noFeasibleSchedule")}</p>;
          }

          if (levels.length === 1 && feasibleLevels.length <= 1) {
            return (
              <div className="flex flex-col items-center gap-2 py-2">
                <div className={`w-1.5 h-5 rounded-sm ${feasibleLevels.length === 1 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                <span className="text-sm font-medium">{levels[0].shifts}×{levels[0].duration.toFixed(1)}h</span>
                {feasibleLevels.length === 0 && levels[0].staffGap && (
                  <span className="text-xs text-red-500">
                    {t("needMoreStaff", { count: levels[0].staffGap, defaultValue: `Need ${levels[0].staffGap} more staff` })}
                  </span>
                )}
              </div>
            );
          }

          return (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t("intense", { defaultValue: "Few" })}</span>
                <div className="flex-1 flex items-center relative h-6">
                  <div className="absolute inset-x-[10px] h-0.5 bg-border rounded-full" />
                  <div className="relative w-full flex items-center justify-between">
                    {levels.map((level, i) => {
                      const tooltipText = !level.feasible && level.staffGap
                        ? `${level.shifts}×${level.duration.toFixed(1)}h — ${t("needMoreStaffOrLessPosts", {
                            staffGap: level.staffGap,
                            postGap: level.postGap,
                            defaultValue: `Need ${level.staffGap} more staff or ${level.postGap} fewer posts`,
                          })}`
                        : "";
                      return (
                      <div
                        key={i}
                        className={`relative group flex items-center justify-center w-5 h-5 ${level.feasible ? "cursor-pointer" : "cursor-default"}`}
                        onClick={() => {
                          if (level.feasible) {
                            setLevelHook(level.shifts);
                            applyLevel(level);
                          }
                        }}
                      >
                      <div
                        className={`transition-all pointer-events-none ${
                          level.feasible
                            ? i === selectedIdx
                              ? "w-1.5 h-5 rounded-sm bg-primary shadow-sm"
                              : "w-0.5 h-4 rounded-sm bg-muted-foreground/40 group-hover:bg-muted-foreground/70 group-hover:h-[1.125rem]"
                            : "w-0.5 h-4 rounded-sm bg-muted-foreground/20"
                        }`}
                      />
                      {tooltipText && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-foreground text-background text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none z-20">
                          {tooltipText}
                        </div>
                      )}
                      </div>
                      );
                    })}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t("relaxed", { defaultValue: "Many" })}</span>
              </div>
            </div>
          );
        })()}
        {selectedLevel && (
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>{t("shiftsLabel", { defaultValue: "Shifts" })}: <span className="font-medium text-foreground">{selectedLevel.shifts}</span></span>
            <span>{t("minRest", { defaultValue: "Min. rest" })}: <span className="font-medium text-foreground">{selectedLevel.restBetween.toFixed(1)}h</span></span>
            <span>{t("duration")}: <span className="font-medium text-primary">{selectedLevel.duration.toFixed(2)}h</span></span>
          </div>
        )}
      </div>

      {/* How it works */}
      {selectedLevel && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <div className="text-xs text-foreground space-y-1">
            <p>
              <span className="font-semibold">{t("howItWorks")}:</span>{" "}
              {selectedLevel.shifts}×{selectedLevel.duration.toFixed(1)}h {t("shifts").toLowerCase()} · {posts.length} {t("posts").toLowerCase()} · {staffCount} {t("staff").toLowerCase()}
            </p>
            <p className="text-muted-foreground">
              {t("eachWorker", { defaultValue: "Each worker" })}: {selectedLevel.shiftsPerWorker} {t("shifts").toLowerCase()}, {selectedLevel.workHours.toFixed(1)}h {t("work", { defaultValue: "work" })}
              {selectedLevel.restBetween > 0 && ` · ${selectedLevel.restBetween.toFixed(1)}h ${t("rest").toLowerCase()} ${t("betweenShifts", { defaultValue: "between shifts" })}`}
            </p>
          </div>
        </div>
      )}

      {/* Pro tip */}
      <p className="text-xs text-muted-foreground/60 text-center">
        {t("proTipDesktop")}
      </p>

      {/* Settings Dialog */}
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
                className="rounded border-border"
              />
              <span className="text-sm">{t("shareDebugInfo")}</span>
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

      {/* Debug Info Confirmation Dialog */}
      <Dialog open={showDebugDialog} onOpenChange={setShowDebugDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("shareDebugInfoDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("shareDebugInfoDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground px-2">
            <li>{t("shareDebugInfoRisk1")}</li>
            <li>{t("shareDebugInfoRisk2")}</li>
            <li>{t("shareDebugInfoRisk3")}</li>
            <li>{t("shareDebugInfoRisk4")}</li>
          </ul>
          <p className="text-xs text-muted-foreground px-2">
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
  );
}
