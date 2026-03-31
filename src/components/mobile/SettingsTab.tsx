import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilState } from "recoil";
import { shiftState } from "../../stores/shiftStore";
import { UniqueString } from "../../models/index";
import { UserShiftData } from "../../models";
import { IconPlus, IconTrash, IconPencil, IconCheck, IconX, IconUser, IconLogin, IconLogout, IconBrandGithub } from "@tabler/icons-react";
import { getOptimalShiftDuration } from "../../service/shiftHourHelperService";
import { calculateFeasibleIntensityRange } from "../../service/intensityRangeHelper";
import { DEFAULT_STAFF_COUNT } from "../../constants/shiftManagerConstants";
import { useAuth } from "../../lib/auth";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { getSetting, setSetting } from "../../lib/settings";
import { enableDebugMode, disableDebugMode } from "../../lib/analytics";
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
  const [, setShiftData] = useRecoilState(shiftState);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [shareDebugInfo, setShareDebugInfo] = useState(() => getSetting("shareDebugInfo"));
  const [showDebugDialog, setShowDebugDialog] = useState(false);

  const staffCount = userShiftData.length || DEFAULT_STAFF_COUNT;
  const { scheduleMode, startDate, switchTo7D, switchTo24H, updateStartDate } = useScheduleMode();

  const [intensityOptions, setIntensityOptions] = useState([1, 2, 4, 6, 8]);
  const [intensityDurationMap, setIntensityDurationMap] = useState<Record<number, number>>({});

  useEffect(() => {
    const result = calculateFeasibleIntensityRange(startTime, endTime, posts.length, staffCount);
    setIntensityOptions(result.feasibleIntensities);
    setIntensityDurationMap(result.intensityDurationMap);
  }, [startTime, endTime, posts.length, staffCount]);

  const getSliderIndex = (intensity: number) => {
    const index = intensityOptions.indexOf(intensity);
    if (index === -1) {
      const closestIndex = intensityOptions.reduce((closest, option, i) => {
        return Math.abs(option - intensity) < Math.abs(intensityOptions[closest] - intensity) ? i : closest;
      }, 0);
      return intensityOptions.length - 1 - closestIndex;
    }
    return intensityOptions.length - 1 - index;
  };

  const getIntensityFromIndex = (index: number) => {
    const invertedIndex = intensityOptions.length - 1 - index;
    return intensityOptions[invertedIndex];
  };

  const shiftDuration = intensityDurationMap[restTime] !== undefined
    ? intensityDurationMap[restTime]
    : getOptimalShiftDuration(startTime, endTime, posts.length, staffCount, restTime);

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
        const updatedUserShiftData = (prev.userShiftData || []).map((userData) => {
          const updatedConstraints = (prev.posts || []).map((post, postIdx) => {
            return newHours.map((hour, hourIndex) => {
              const existing = userData.constraints?.[postIdx]?.[hourIndex];
              return existing || { postID: post.id, hourID: hour.id, availability: true };
            });
          });
          return { ...userData, constraints: updatedConstraints };
        });

        const shouldClearAssignments = prev.hours?.length !== newHours.length;
        const assignments = shouldClearAssignments
          ? (prev.posts || []).map(() => newHours.map(() => null))
          : prev.assignments;

        return {
          ...prev,
          startTime: newStartTime,
          endTime: newEndTime,
          restTime: newIntensity,
          hours: newHours,
          userShiftData: updatedUserShiftData,
          assignments,
        };
      });
    },
    [posts.length, staffCount, setShiftData, scheduleMode]
  );

  const numberOfShifts = shiftDuration > 0
    ? Math.floor(((parseInt(endTime.split(":")[0]) * 60 + parseInt(endTime.split(":")[1])) -
        (parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]))) / (shiftDuration * 60))
    : 0;

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <img src={tumbleweedIcon} alt="Tumbleweed" className="w-10 h-10" />
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
                className="w-8 h-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <IconUser size={18} className="text-gray-500" />
              </div>
            )}
          </button>
            {shareDebugInfo && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center pointer-events-none z-10">!</span>
            )}
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute ltr:right-0 rtl:left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border p-3 z-50">
                {isAuthenticated && (
                  <>
                    <div className="text-sm font-medium">{user?.name}</div>
                    <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                    <hr className="my-2" />
                  </>
                )}
                <div className="mb-1">
                  <LanguageSwitcher />
                </div>
                <a
                  href="https://github.com/gilador/Tumbleweed"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-black w-full text-start mt-1"
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
                <div className="text-[10px] text-gray-300 text-center mt-2 select-none">v{APP_VERSION}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Operation Hours */}
      <div className="rounded-lg border border-black p-4 space-y-3">
        <h2 className="text-sm font-semibold">{t("operationHours")}</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">{t("start")}</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => updateShiftStateWithNewHours(e.target.value, endTime, restTime)}
              className="w-full px-3 py-2 border border-black rounded-md text-sm min-h-[44px]"
            />
          </div>
          <span className="text-muted-foreground mt-5 icon-flip">→</span>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">{t("end")}</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => updateShiftStateWithNewHours(startTime, e.target.value, restTime)}
              className="w-full px-3 py-2 border border-black rounded-md text-sm min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {/* Schedule Mode */}
      <div className="rounded-lg border border-black p-4 space-y-3">
        <h2 className="text-sm font-semibold">{t("scheduleMode")}</h2>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-black overflow-hidden">
            <button
              onClick={() => { if (scheduleMode !== "24h") switchTo24H(); }}
              className={`px-4 py-2 text-sm font-medium min-h-[44px] transition-colors ${
                scheduleMode === "24h"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-gray-600"
              }`}
            >
              {t("singleDay")}
            </button>
            <button
              onClick={() => { if (scheduleMode !== "7d") switchTo7D(); }}
              className={`px-4 py-2 text-sm font-medium min-h-[44px] transition-colors ${
                scheduleMode === "7d"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-gray-600"
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
              className="w-full px-3 py-2 border border-black rounded-md text-sm min-h-[44px]"
            />
          </div>
        )}
      </div>

      {/* Posts */}
      <div className="rounded-lg border border-black p-4 space-y-3">
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
                    className="flex-1 px-3 py-2 border border-black rounded-md text-sm"
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
      <div className="rounded-lg border border-black p-4 space-y-3">
        <h2 className="text-sm font-semibold">{t("intensity")}</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{t("intense")}</span>
          <input
            type="range"
            min="0"
            max={Math.max(intensityOptions.length - 1, 1)}
            step="1"
            value={getSliderIndex(restTime)}
            onChange={(e) => {
              const newIntensity = getIntensityFromIndex(parseInt(e.target.value));
              updateShiftStateWithNewHours(startTime, endTime, newIntensity);
            }}
            className="flex-1 h-2 bg-border rounded-lg appearance-none cursor-pointer
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
          <span className="text-xs text-muted-foreground whitespace-nowrap">{t("relaxed")}</span>
        </div>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>{t("shiftsCount", { count: numberOfShifts })}</span>
          <span>·</span>
          <span>{t("durationEach", { duration: shiftDuration.toFixed(1) })}</span>
        </div>
      </div>

      {/* Privacy */}
      <div className="rounded-lg border border-black p-4">
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
          <span className="text-sm">{t("shareDebugInfo")}</span>
          {shareDebugInfo && (
            <span className="w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">!</span>
          )}
        </label>
      </div>

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
  );
}
