import { useState } from "react";
import { useRecoilState } from "recoil";
import { useTranslation } from "react-i18next";
import { UniqueString } from "../models/index";
import { shiftState, getActiveRosterFromState, updateActiveRoster } from "../stores/shiftStore";
import { useScheduleMode } from "../hooks/useScheduleMode";
// encodeFlatHour used in weekly mode via generateDynamicHours
import { TimeInput } from "./TimeInput";
import { useLevels } from "../hooks/useLevels";
import { ShiftLevel } from "../service/shiftLevels";
import { generateDynamicHours } from "../service/shiftManagerUtils";

export interface ShiftInfoSettingsViewProps {
  startHour: string;
  endHour: string;
  className?: string;
  onStartTimeChange?: (startTime: string) => void;
  onEndTimeChange?: (endTime: string) => void;
  posts?: UniqueString[];
}

export function ShiftInfoSettingsView({
  startHour,
  endHour,
  className = "",
  onStartTimeChange,
  onEndTimeChange,
  posts = [],
}: ShiftInfoSettingsViewProps) {
  const { t } = useTranslation();
  const [shiftData, setShiftData] = useRecoilState(shiftState);
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

  // --- Level selection → update hours in state ---
  const applyLevel = (level: ShiftLevel, newStartTime?: string, newEndTime?: string) => {
    const startT = newStartTime || localStartTime;
    const endT = newEndTime || localEndTime;

    const newHours = generateDynamicHours(startT, endT, posts.length, staffCount, level.shifts);

    setShiftData((prev) => {
      const roster = getActiveRosterFromState(prev);
      const activeRosterId = prev.activeRosterId;

      // Update user constraints to match new hours structure
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
          startTime: startT,
          endTime: endT,
          hours: newHours,
          assignments: clearedAssignments,
        })),
        selectedShiftCount: level.shifts,
        userShiftData: updatedUserShiftData,
      };
    });
  };

  const handleLevelChange = (level: ShiftLevel) => {
    if (!level || !level.feasible) return;
    setLevel(level.shifts);
    applyLevel(level);
  };

  // --- Time changes ---
  const applyTimeChange = (newStart: string, newEnd: string) => {
    // Recompute with current selected level
    const currentShiftCount = shiftData.selectedShiftCount;
    const newHours = generateDynamicHours(newStart, newEnd, posts.length, staffCount, currentShiftCount);

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

  // --- Slider helpers ---
  const feasibleLevels = levels.filter((l) => l.feasible);
  const selectedSliderIndex = selectedLevel
    ? levels.indexOf(selectedLevel)
    : feasibleLevels.length > 0 ? levels.indexOf(feasibleLevels[Math.floor(feasibleLevels.length / 2)]) : -1;

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
            <span className="text-xs font-medium text-primary whitespace-nowrap">
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
          <h3 className="text-xs font-semibold text-muted-foreground">{t("shiftIntensity")}</h3>

          {levels.length === 0 ? (
            // No levels at all
            <p className="text-xs text-muted-foreground text-center py-1">
              {t("noFeasibleSchedule")}
            </p>
          ) : levels.length === 1 && feasibleLevels.length <= 1 ? (
            // Single level — centered dot with stats
            <div className="flex flex-col items-center gap-1 py-1">
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-3 h-3 rounded-full ${feasibleLevels.length === 1 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                <span className="text-muted-foreground whitespace-nowrap">{t("shiftsLabel", { defaultValue: "Shifts" })}: <span className="font-medium text-foreground">{levels[0].shifts}</span></span>
                <span className="text-muted-foreground whitespace-nowrap">{t("minRest", { defaultValue: "Min. rest" })}: <span className="font-medium text-foreground">{levels[0].restBetween.toFixed(1)}h</span></span>
                <span className="text-muted-foreground whitespace-nowrap">{t("duration")}: <span className="font-medium text-primary">{levels[0].duration.toFixed(2)}h</span></span>
              </div>
              {feasibleLevels.length === 0 && levels[0].staffGap && (
                <span className="text-[10px] text-red-500">
                  {t("needMoreStaff", { count: levels[0].staffGap, defaultValue: `Need ${levels[0].staffGap} more staff` })}
                </span>
              )}
            </div>
          ) : (
            // Multiple levels — show slider
            <div className="space-y-1">
              <div className="flex items-center gap-2 min-h-[1.5rem]">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t("intense", { defaultValue: "Few" })}</span>
                <div className="flex-1 flex items-center relative h-4">
                  <div className="absolute inset-x-[7px] h-0.5 bg-border rounded-full" />
                  <div className="relative w-full flex items-center justify-between">
                    {levels.map((level, i) => {
                      const tooltipText = level.feasible
                        ? `${level.shifts}×${level.duration.toFixed(1)}h · ${t("rest")}: ${level.restBetween.toFixed(1)}h`
                        : level.staffGap
                          ? `${level.shifts}×${level.duration.toFixed(1)}h — ${t("needMoreStaffOrLessPosts", {
                              staffGap: level.staffGap,
                              postGap: level.postGap,
                              defaultValue: `Need ${level.staffGap} more staff or ${level.postGap} fewer posts`,
                            })}`
                          : "";
                      return (
                        <div key={i} className="relative group flex items-center justify-center w-3.5 h-3.5">
                          <button
                            type="button"
                            className={`rounded-full transition-all ${
                              level.feasible
                                ? i === selectedSliderIndex
                                  ? "w-3.5 h-3.5 bg-primary shadow-sm"
                                  : "w-2 h-2 bg-muted-foreground/60 hover:bg-muted-foreground hover:scale-125"
                                : "w-2 h-2 bg-muted-foreground/20 cursor-default"
                            }`}
                            onClick={() => {
                              if (level.feasible) handleLevelChange(level);

                            }}
                            disabled={!level.feasible}
                          />
                          {tooltipText && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-foreground text-background text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none z-20">
                              {tooltipText}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t("relaxed", { defaultValue: "Many" })}</span>
                {selectedLevel && (
                  <>
                    <span className="text-muted-foreground/50 mx-1">|</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{t("shiftsLabel", { defaultValue: "Shifts" })}: <span className="font-medium text-foreground">{selectedLevel.shifts}</span></span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{t("minRest", { defaultValue: "Min. rest" })}: <span className="font-medium text-foreground">{selectedLevel.restBetween.toFixed(1)}h</span></span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{t("duration")}: <span className="font-medium text-primary">{selectedLevel.duration.toFixed(2)}h</span></span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      {selectedLevel && (
        <div className="flex-shrink-0 mt-1">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
            <div className="text-xs text-foreground text-start space-y-1">
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
        </div>
      )}
    </div>
  );
}
