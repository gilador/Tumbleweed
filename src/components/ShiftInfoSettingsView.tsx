import { useState } from "react";
import { useRecoilValue } from "recoil";
import { useTranslation } from "react-i18next";
import { UniqueString } from "../models/index";
import { shiftState, getActiveRosterFromState } from "../stores/shiftStore";
import { useScheduleMode } from "../hooks/useScheduleMode";
import { TimeInput } from "./TimeInput";
import { useLevels } from "../hooks/useLevels";
import { useIntensityChange } from "../hooks/useIntensityChange";
import { IntensityPanel } from "./IntensityPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./elements/dialog";
import { Button } from "./elements/button";
import { useRecoilState } from "recoil";
import { updateActiveRoster } from "../stores/shiftStore";
import { generateDynamicHours, generateWeeklyDynamicHours } from "../service/shiftManagerUtils";

export interface ShiftInfoSettingsViewProps {
  startHour: string;
  endHour: string;
  className?: string;
  onStartTimeChange?: (startTime: string) => void;
  onEndTimeChange?: (endTime: string) => void;
  posts?: UniqueString[];
  showToastWithAction: (
    message: string,
    actionLabel: string,
    onAction: () => void,
    duration?: number,
    onClose?: () => void
  ) => string;
  dismissToast: (id: string) => void;
}

export function ShiftInfoSettingsView({
  startHour,
  endHour,
  className = "",
  onStartTimeChange,
  onEndTimeChange,
  posts = [],
  showToastWithAction,
  dismissToast,
}: ShiftInfoSettingsViewProps) {
  const { t } = useTranslation();
  const shiftData = useRecoilValue(shiftState);
  const [, setShiftData] = useRecoilState(shiftState);
  const activeRoster = getActiveRosterFromState(shiftData);
  const { levels, selectedLevel, setLevel, opHours } = useLevels();
  const { scheduleMode, startDate, switchTo7D, switchTo24H, updateStartDate } = useScheduleMode();

  const localStartTime = activeRoster.startTime || startHour;
  const localEndTime = activeRoster.endTime || endHour;
  const staffCount = shiftData.userShiftData?.length || 0;

  // --- Presets ---
  type PresetKey = "9to5" | "morning" | "noon" | "evening" | "24h" | "custom";
  const presets: Record<Exclude<PresetKey, "custom">, { start: string; end: string }> = {
    "9to5":    { start: "09:00", end: "17:00" },
    "morning": { start: "06:00", end: "14:00" },
    "noon":    { start: "12:00", end: "20:00" },
    "evening": { start: "16:00", end: "00:00" },
    "24h":     { start: "00:00", end: "00:00" },
  };

  const detectPreset = (start: string, end: string): PresetKey => {
    for (const [key, val] of Object.entries(presets)) {
      if (val.start === start && val.end === end) return key as PresetKey;
    }
    return "custom";
  };

  const [activePreset, setActivePreset] = useState<PresetKey>(() => detectPreset(localStartTime, localEndTime));
  const [customTimes, setCustomTimes] = useState<{ start: string; end: string }>({ start: localStartTime, end: localEndTime });

  // --- Intensity change (confirm + undo) ---
  const intensity = useIntensityChange({
    showToastWithAction,
    dismissToast,
    posts,
    startTime: localStartTime,
    endTime: localEndTime,
    scheduleMode,
    surface: "desktop",
    setLevel,
    toastMessage: (n) => t("intensityChanged", { count: n }),
    undoLabel: t("undo"),
  });

  // --- Time changes (unchanged path) ---
  const applyTimeChange = (newStart: string, newEnd: string) => {
    const currentShiftCount = shiftData.selectedShiftCount;
    const newHours = scheduleMode === "7d"
      ? generateWeeklyDynamicHours(newStart, newEnd, posts.length, staffCount, currentShiftCount)
      : generateDynamicHours(newStart, newEnd, posts.length, staffCount, currentShiftCount);

    setShiftData((prev) => {
      const roster = getActiveRosterFromState(prev);
      const activeRosterId = prev.activeRosterId;

      const updatedUserShiftData = (prev.userShiftData || []).map((userData) => {
        const updatedConstraints = (roster.posts || []).map((post) => {
          return newHours.map((hour, hourIndex) => {
            const existingConstraint = userData.constraints?.[roster.posts?.indexOf(post) || 0]?.[hourIndex];
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
          startTime: newStart,
          endTime: newEnd,
          hours: newHours,
          assignments: clearedAssignments,
        })),
        userShiftData: updatedUserShiftData,
      };
    });
  };

  const handlePresetChange = (preset: PresetKey) => {
    setActivePreset(preset);
    if (preset === "custom") {
      applyTimeChange(customTimes.start, customTimes.end);
    } else {
      const { start, end } = presets[preset];
      applyTimeChange(start, end);
      onStartTimeChange?.(start);
      onEndTimeChange?.(end);
    }
  };

  const handleManualTimeChange = (type: "start" | "end", time: string) => {
    setActivePreset("custom");
    if (type === "start") {
      setCustomTimes((prev) => ({ ...prev, start: time }));
      applyTimeChange(time, localEndTime);
      onStartTimeChange?.(time);
    } else {
      setCustomTimes((prev) => ({ ...prev, end: time }));
      applyTimeChange(localStartTime, time);
      onEndTimeChange?.(time);
    }
  };

  return (
    <div className={`flex flex-col gap-1 p-2 ${className}`}>
      {/* Schedule Mode toggle */}
      <div className="flex-shrink-0">
        <div className="border border-border rounded-lg px-2 py-1.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground">{t("scheduleMode", { defaultValue: "Schedule Mode" })}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-md overflow-hidden">
              <button
                className={`px-3 py-1 text-xs font-medium transition-colors ${scheduleMode === "24h" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => switchTo24H()}
              >
                24H
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium transition-colors ${scheduleMode === "7d" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => switchTo7D()}
              >
                7D
              </button>
            </div>
            {scheduleMode === "7d" && (
              <input
                type="date"
                value={startDate || ""}
                onChange={(e) => updateStartDate(e.target.value)}
                className="text-xs border border-border rounded px-1.5 py-0.5 bg-background"
              />
            )}
          </div>
        </div>
      </div>

      {/* Time range input */}
      <div className="flex-shrink-0">
        <div className="border border-border rounded-lg px-2 py-1.5">
          <div className="flex items-center gap-2">
            <select
              value={activePreset}
              onChange={(e) => handlePresetChange(e.target.value as PresetKey)}
              className="px-1.5 py-0.5 border border-border rounded text-sm bg-background text-foreground cursor-pointer"
            >
              <option value="9to5">{t("preset9to5", { defaultValue: "9-to-5" })}</option>
              <option value="morning">{t("presetMorning", { defaultValue: "Morning" })}</option>
              <option value="noon">{t("presetNoon", { defaultValue: "Noon" })}</option>
              <option value="evening">{t("presetEvening", { defaultValue: "Evening" })}</option>
              <option value="24h">{t("preset24h", { defaultValue: "24H" })}</option>
              <option value="custom">{t("presetCustom", { defaultValue: "Custom" })}</option>
            </select>
            <TimeInput
              value={localStartTime}
              onChange={(time) => handleManualTimeChange("start", time)}
              className="flex-1"
            />
            <span className="text-muted-foreground font-medium icon-flip">→</span>
            <TimeInput
              value={localEndTime}
              onChange={(time) => handleManualTimeChange("end", time)}
              className="flex-1"
            />
            <span className="text-xs font-medium text-primary whitespace-nowrap" dir="ltr">
              {opHours}hr
            </span>
          </div>
          {/* Capacity indicator */}
          {selectedLevel && (
            <div className={`flex items-center gap-2 text-[10px] mt-1 ${selectedLevel.feasible ? "text-muted-foreground" : "text-red-500"}`}>
              <span>{staffCount} {t("staff").toLowerCase()} {t("canCover", { defaultValue: "can cover" })} <span className="font-medium">{selectedLevel.availableSlots}</span> {t("assignments", { defaultValue: "assignments" }).toLowerCase()}</span>
              <span className="text-muted-foreground/50">|</span>
              <span>{posts.length} {t("posts").toLowerCase()} × {selectedLevel.shifts} {t("shifts").toLowerCase()} = <span className="font-medium">{selectedLevel.neededSlots}</span> {t("assignmentsNeeded", { defaultValue: "assignments needed" })}</span>
              {!selectedLevel.feasible && <span>⚠</span>}
            </div>
          )}
        </div>
      </div>

      {/* Shift Intensity (Level Slider) */}
      <div className="flex-shrink-0">
        <div className="border border-border rounded-lg p-2 space-y-1">
          <IntensityPanel
            levels={levels}
            selectedLevel={selectedLevel}
            postsCount={posts.length}
            staffCount={staffCount}
            onLevelChange={intensity.requestLevelChange}
            variant="desktop"
          />
        </div>
      </div>

      {/* Confirm dialog for shift count change */}
      <Dialog
        open={intensity.confirmState.open}
        onOpenChange={(open) => {
          if (!open) intensity.cancelConfirm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("intensityConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("intensityConfirmBody", {
                count: intensity.confirmState.pending?.shifts ?? 0,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={intensity.cancelConfirm}>
              {t("intensityConfirmCancel")}
            </Button>
            <Button onClick={intensity.acceptConfirm}>
              {t("intensityConfirmAccept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
