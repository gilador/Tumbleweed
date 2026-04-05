import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilState, useRecoilValue } from "recoil";
import { shiftState, getActiveRosterFromState, updateActiveRoster, shiftScheduleInfoSelector } from "../../stores/shiftStore";
import { UniqueString } from "../../models/index";
import { UserShiftData } from "../../models";
import { RosterSwitcher } from "../RosterSwitcher";
import { SyncStatusIcon } from "../SyncStatusIcon";
import { TimeInput } from "../TimeInput";
import { IconPlus, IconTrash, IconPencil, IconCheck, IconX, IconUser, IconLogin, IconLogout, IconBrandGithub, IconSettings } from "@tabler/icons-react";
import { getOptimalShiftDuration } from "../../service/shiftHourHelperService";
import { calculateFeasibleIntensityRange } from "../../service/intensityRangeHelper";
import { useAuth } from "../../lib/auth";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { getSetting, setSetting } from "../../lib/settings";
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

interface SettingsTabProps {
  posts: UniqueString[];
  hours: UniqueString[];
  startTime: string;
  endTime: string;
  restTime: number;
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
  restTime,
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
  const scheduleInfo = useRecoilValue(shiftScheduleInfoSelector);
  const { scheduleMode, startDate, switchTo7D, switchTo24H, updateStartDate } = useScheduleMode();

  const [intensityOptions, setIntensityOptions] = useState([1, 2, 4, 6, 8]);
  const [intensityDurationMap, setIntensityDurationMap] = useState<Record<number, number>>({});

  useEffect(() => {
    const result = calculateFeasibleIntensityRange(startTime, endTime, posts.length, staffCount);
    setIntensityOptions(result.feasibleIntensities);
    const durationAt0 = getOptimalShiftDuration(startTime, endTime, posts.length, staffCount, 0);
    setIntensityDurationMap({ ...result.intensityDurationMap, 0: durationAt0 > 0 ? durationAt0 : 0 });
  }, [startTime, endTime, posts.length, staffCount]);

  const zeroRest = !!recoilState.zeroRest;
  const effectiveOptions = zeroRest && !intensityOptions.includes(0)
    ? [0, ...intensityOptions]
    : intensityOptions;

  const getSliderIndex = (intensity: number) => {
    const opts = effectiveOptions;
    const index = opts.indexOf(intensity);
    if (index === -1) {
      const closestIndex = opts.reduce((closest, option, i) => {
        return Math.abs(option - intensity) < Math.abs(opts[closest] - intensity) ? i : closest;
      }, 0);
      return opts.length - 1 - closestIndex;
    }
    return opts.length - 1 - index;
  };

  const getIntensityFromIndex = (index: number) => {
    const opts = effectiveOptions;
    const invertedIndex = opts.length - 1 - index;
    return opts[invertedIndex];
  };


  const updateShiftStateWithNewHours = useCallback(
    (newStartTime: string, newEndTime: string, newIntensity: number) => {
      const newDuration = getOptimalShiftDuration(
        newStartTime, newEndTime, posts.length, staffCount, newIntensity
      );

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
          restTime: newIntensity,
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
              onChange={(time) => updateShiftStateWithNewHours(time, endTime, restTime)}
            />
          </div>
          <span className="text-muted-foreground mt-5 icon-flip">→</span>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">{t("end")}</label>
            <TimeInput
              value={endTime}
              onChange={(time) => updateShiftStateWithNewHours(startTime, time, restTime)}
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

      {/* Intensity */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-sm font-semibold">{t("shiftIntensity")}</h2>
        {(() => {
          const durations = new Set(effectiveOptions.map((o) => (intensityDurationMap[o] ?? 0).toFixed(2)));
          const allSame = durations.size <= 1 && effectiveOptions.length > 1;

          const zeroRestCheckbox = (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!recoilState.zeroRest}
                onChange={(e) => {
                  setShiftData((prev) => ({ ...prev, zeroRest: e.target.checked }));
                  if (e.target.checked) {
                    updateShiftStateWithNewHours(startTime, endTime, 0);
                  } else if (restTime === 0) {
                    updateShiftStateWithNewHours(startTime, endTime, intensityOptions[0] || 1);
                  }
                }}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <span className="text-xs text-muted-foreground">{t("zeroRest")}</span>
            </label>
          );

          if (allSame) {
            return (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("intensityFixed")}</p>
                {zeroRestCheckbox}
              </div>
            );
          }

          return (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t("relaxed")}</span>
                <div className="flex-1 flex items-center relative h-6">
                  <div className="absolute inset-x-[10px] h-2 bg-border rounded-lg flex items-center justify-between">
                    {effectiveOptions.map((opt: number, i: number) => {
                      const [sH] = startTime.split(":").map(Number);
                      const [eH] = endTime.split(":").map(Number);
                      let opH = eH - sH;
                      if (opH <= 0) opH += 24;
                      const maxW = Math.max(0, opH - Math.min(opt, opH * 0.8));
                      const cap = staffCount * maxW;
                      const dur = intensityDurationMap[opt] ?? 0;
                      const shifts = dur > 0 ? Math.floor(opH / dur) : 0;
                      const need = shifts * posts.length * dur;
                      const overCap = need > cap && cap > 0;
                      return (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${overCap ? "bg-red-500" : "bg-muted-foreground/40"}`}
                        />
                      );
                    })}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(effectiveOptions.length - 1, 1)}
                    step="1"
                    value={getSliderIndex(restTime)}
                    onChange={(e) => {
                      const newIntensity = getIntensityFromIndex(parseInt(e.target.value));
                      updateShiftStateWithNewHours(startTime, endTime, newIntensity);
                    }}
                    className="relative z-10 w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:h-5
                      [&::-webkit-slider-thumb]:w-5
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-primary
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:h-5
                      [&::-moz-range-thumb]:w-5
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-primary
                      [&::-moz-range-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:border-none"
                  />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t("intense")}</span>
              </div>
              {zeroRestCheckbox}
            </div>
          );
        })()}
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>{t("shiftsCount", { count: scheduleInfo.shiftsCount })}</span>
          <span>·</span>
          <span>{t("durationEach", { duration: scheduleInfo.shiftDuration.toFixed(1) })}</span>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
        {(() => {
          const [sh] = startTime.split(":").map(Number);
          const [eh] = endTime.split(":").map(Number);
          let opHours = eh - sh;
          if (opHours <= 0) opHours += 24;
          const maxWorkPerPerson = Math.max(0, opHours - Math.min(restTime, opHours * 0.8));
          const totalCapacity = staffCount * maxWorkPerPerson;
          const totalNeeded = scheduleInfo.shiftsCount * posts.length * scheduleInfo.shiftDuration;
          const params = {
            posts: posts.length,
            staff: staffCount,
            shifts: scheduleInfo.shiftsCount,
            duration: scheduleInfo.shiftDuration.toFixed(1),
            opHours,
            rest: restTime,
            start: startTime,
            end: endTime,
            maxWork: maxWorkPerPerson.toFixed(1),
            totalCapacity: totalCapacity.toFixed(0),
            totalNeeded: totalNeeded.toFixed(0),
          };
          const overCapacity = totalNeeded > totalCapacity && totalCapacity > 0;
          return (
            <div className="text-xs text-foreground space-y-1">
              <p>
                <span className="font-semibold">{t("howItWorks")}:</span>{" "}
                {scheduleMode === "7d"
                  ? t("howItWorksDetail7d", params)
                  : t("howItWorksDetail", params)}
              </p>
              <p className={overCapacity ? "text-red-500 font-medium" : "text-muted-foreground"}>
                {t("constraintsDetail", params)}
                {overCapacity && ` ⚠ ${t("overCapacity")}`}
              </p>
            </div>
          );
        })()}
      </div>

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
