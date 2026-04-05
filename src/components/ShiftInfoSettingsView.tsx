import { useState, useEffect } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { useTranslation } from "react-i18next";
// IconX removed - close button now in parent wrapper
import { getOptimalShiftDuration } from "../service/shiftHourHelperService";
import { UniqueString } from "../models/index";
import { calculateFeasibleIntensityRange } from "../service/intensityRangeHelper";
import { shiftState, getActiveRosterFromState, updateActiveRoster, shiftScheduleInfoSelector } from "../stores/shiftStore";
import { useScheduleMode } from "../hooks/useScheduleMode";
import { encodeFlatHour } from "../service/weeklyScheduleUtils";
import { TimeInput } from "./TimeInput";

export interface ShiftInfoSettingsViewProps {
  restTime: number;
  startHour: string;
  endHour: string;
  className?: string;
  onStartTimeChange?: (startTime: string) => void;
  onEndTimeChange?: (endTime: string) => void;
  onIntensityChange?: (intensity: number) => void;
  posts?: UniqueString[];
  staffCount?: number;
}

export function ShiftInfoSettingsView({
  restTime,
  startHour,
  endHour,
  className = "",
  onStartTimeChange,
  onEndTimeChange,
  onIntensityChange,
  posts = [],
  staffCount = 0,
}: ShiftInfoSettingsViewProps) {
  const { t } = useTranslation();
  const [shiftData, setShiftData] = useRecoilState(shiftState);
  const activeRoster = getActiveRosterFromState(shiftData);
  const scheduleInfo = useRecoilValue(shiftScheduleInfoSelector);

  // ALWAYS use global state values - never fall back to props
  const localStartTime = activeRoster.startTime || startHour;
  const localEndTime = activeRoster.endTime || endHour;
  const intensity = shiftData.restTime ?? restTime;
  // Override prop with actual staff count from state
  staffCount = shiftData.userShiftData?.length || staffCount;

  // Debug current state values
  console.log("🔍 [ShiftInfoSettingsView] Current state values:", {
    localStartTime,
    localEndTime,
    intensity,
    "activeRoster.startTime": activeRoster.startTime,
    "activeRoster.endTime": activeRoster.endTime,
    "shiftData.restTime": shiftData.restTime,
    "activeRoster.hours": activeRoster.hours?.map((h) => h.value) || [],
  });
  const { scheduleMode, startDate, switchTo7D, switchTo24H, updateStartDate } = useScheduleMode();

  // Shift time presets
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

  const handlePresetChange = (preset: PresetKey) => {
    setActivePreset(preset);
    if (preset === "custom") {
      handleStartTimeChange(customTimes.start);
      handleEndTimeChange(customTimes.end);
      updateShiftStateWithNewHours(customTimes.start, customTimes.end, intensity);
    } else {
      const { start, end } = presets[preset];
      updateShiftStateWithNewHours(start, end, intensity);
      onStartTimeChange?.(start);
      onEndTimeChange?.(end);
    }
  };

  const handleManualTimeChange = (type: "start" | "end", time: string) => {
    setActivePreset("custom");
    if (type === "start") {
      setCustomTimes((prev) => ({ ...prev, start: time }));
      handleStartTimeChange(time);
    } else {
      setCustomTimes((prev) => ({ ...prev, end: time }));
      handleEndTimeChange(time);
    }
  };

  const [intensityOptions, setIntensityOptions] = useState([1, 2, 4, 6, 8]);
  const [intensityDurationMap, setIntensityDurationMap] = useState<{
    [intensity: number]: number;
  }>({});
  const zeroRest = !!shiftData.zeroRest;
  const setZeroRest = (val: boolean) => {
    setShiftData((prev) => ({ ...prev, zeroRest: val }));
  };

  // Effective options: prepend 0 if zeroRest is enabled
  const effectiveOptions = zeroRest && !intensityOptions.includes(0)
    ? [0, ...intensityOptions]
    : intensityOptions;

  // Calculate feasible intensity range based on current parameters
  useEffect(() => {
    console.log(
      "🔄 [ShiftInfoSettingsView] Recalculating feasible intensity range for:",
      { localStartTime, localEndTime, postsCount: posts.length, staffCount }
    );
    const result = calculateFeasibleIntensityRange(
      localStartTime,
      localEndTime,
      posts.length,
      staffCount
    );

    setIntensityOptions(result.feasibleIntensities);
    // Add 0-rest duration to the map for the zero-rest checkbox
    const durationAt0 = getOptimalShiftDuration(localStartTime, localEndTime, posts.length, staffCount, 0);
    setIntensityDurationMap({ ...result.intensityDurationMap, 0: durationAt0 > 0 ? durationAt0 : 0 });

    console.log("🎯 [ShiftInfoSettingsView] Intensity options updated:", {
      "current intensity": intensity,
      "new options": result.feasibleIntensities,
      "current options": intensityOptions,
      "intensity in options": result.feasibleIntensities.includes(intensity),
      "slider will show index": getSliderIndex(intensity),
    });

    // NEVER override user's intensity - just log what we found
    if (!result.feasibleIntensities.includes(intensity)) {
      console.log(
        `⚠️ [ShiftInfoSettingsView] Current intensity ${intensity} not in feasible list BUT keeping user's choice`,
        {
          "current intensity": intensity,
          "feasible intensities": result.feasibleIntensities,
          "user's choice preserved": true,
        }
      );
    } else {
      console.log(
        "✅ [ShiftInfoSettingsView] Current intensity is in feasible list:",
        intensity
      );
    }
  }, [localStartTime, localEndTime, posts.length, staffCount, intensity]);

  // Map intensity value to slider index and vice versa
  // Inverted mapping: left (index 0) = highest intensity, right (max index) = lowest intensity
  const getSliderIndex = (intensity: number) => {
    const opts = effectiveOptions;
    const index = opts.indexOf(intensity);
    if (index === -1) {
      const closestIndex = opts.reduce((closest, option, i) => {
        const currentDiff = Math.abs(option - intensity);
        const closestDiff = Math.abs(opts[closest] - intensity);
        return currentDiff < closestDiff ? i : closest;
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

  // Calculate shift starting times for logging
  const calculateShiftStartingTimes = (
    startTime: string,
    endTime: string,
    shiftDuration: number
  ) => {
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    const operationDurationMinutes = endTotalMinutes - startTotalMinutes;

    if (operationDurationMinutes <= 0 || shiftDuration <= 0) {
      return [];
    }

    const shiftDurationMinutes = shiftDuration * 60;
    const shiftStartTimes: string[] = [];

    let currentStartMinutes = startTotalMinutes;

    while (currentStartMinutes < endTotalMinutes) {
      const hours = Math.floor(currentStartMinutes / 60);
      const minutes = currentStartMinutes % 60;
      const timeString = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
      shiftStartTimes.push(timeString);

      currentStartMinutes += shiftDurationMinutes;
    }

    return shiftStartTimes;
  };

  // Calculate optimal shift duration using sophisticated calculation that considers intensity
  const calculateOptimalShiftDuration = (
    start: string,
    end: string,
    intensity: number,
    postCount: number,
    workers: number
  ) => {
    console.log(
      "🔍 [ShiftInfoSettingsView] calculateOptimalShiftDuration called with:",
      {
        start,
        end,
        intensity,
        postCount,
        workers,
      }
    );

    // First, try to use cached duration from intensityDurationMap
    if (intensityDurationMap[intensity] !== undefined) {
      console.log(
        "🚀 [ShiftInfoSettingsView] Using cached duration:",
        intensityDurationMap[intensity]
      );
      return intensityDurationMap[intensity];
    }

    if (postCount === 0 || workers === 0) {
      console.log(
        "⚠️ [ShiftInfoSettingsView] Using fallback calculation - postCount or workers is 0"
      );
      // Fallback to simple calculation if no data available
      const [startHours, startMinutes] = start.split(":").map(Number);
      const [endHours, endMinutes] = end.split(":").map(Number);

      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;

      let durationMinutes = endTotalMinutes - startTotalMinutes;

      // Handle overnight shifts
      if (durationMinutes < 0) {
        durationMinutes += 24 * 60;
      }

      const fallbackDuration = Math.round((durationMinutes / 60) * 10) / 10;
      console.log(
        "📊 [ShiftInfoSettingsView] Fallback duration calculated:",
        fallbackDuration
      );
      return fallbackDuration;
    }

    console.log(
      "⚠️ [ShiftInfoSettingsView] Cache miss, falling back to live calculation"
    );

    const optimizedDuration = getOptimalShiftDuration(
      start,
      end,
      postCount,
      workers,
      intensity
    );
    console.log(
      "🎯 [ShiftInfoSettingsView] Optimized duration from service:",
      optimizedDuration
    );

    if (optimizedDuration === 0) {
      console.warn(
        "❌ [ShiftInfoSettingsView] Optimized duration is 0! Falling back to simple calculation"
      );
      // If optimized calculation fails, use fallback
      const [startHours, startMinutes] = start.split(":").map(Number);
      const [endHours, endMinutes] = end.split(":").map(Number);

      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;

      let durationMinutes = endTotalMinutes - startTotalMinutes;

      // Handle overnight shifts
      if (durationMinutes < 0) {
        durationMinutes += 24 * 60;
      }

      const fallbackDuration = Math.round((durationMinutes / 60) * 10) / 10;
      console.log(
        "📊 [ShiftInfoSettingsView] Using fallback duration due to 0 result:",
        fallbackDuration
      );
      return fallbackDuration;
    }

    return optimizedDuration;
  };

  // Always calculate current values for display
  const shiftDuration = calculateOptimalShiftDuration(
    localStartTime,
    localEndTime,
    intensity,
    posts.length,
    staffCount
  );

  // Calculate shift starting times for display
  const shiftStartTimes = calculateShiftStartingTimes(
    localStartTime,
    localEndTime,
    shiftDuration
  );

  // Log final calculated hours after any parameter change
  console.log(
    "🎯 [ShiftInfoSettingsView] ===== FINAL CALCULATION RESULT ====="
  );
  console.log("📊 [ShiftInfoSettingsView] Input Parameters:", {
    startTime: localStartTime,
    endTime: localEndTime,
    intensity: intensity,
    posts: posts.length,
    staff: staffCount,
  });
  console.log(
    `⏰ [ShiftInfoSettingsView] FINAL HOURS: ${shiftDuration.toFixed(2)}h`
  );
  console.log(
    `📅 [ShiftInfoSettingsView] SHIFT START TIMES: [${shiftStartTimes.join(
      ", "
    )}]`
  );
  console.log(
    `🔢 [ShiftInfoSettingsView] TOTAL SHIFTS: ${shiftStartTimes.length}`
  );
  console.log(
    "🎯 [ShiftInfoSettingsView] ====================================="
  );

  // Helper to update shift state with new parameters
  const updateShiftStateWithNewHours = (
    newStartTime: string,
    newEndTime: string,
    newIntensity: number
  ) => {
    // Use the same calculation as the selector: calculateFeasibleIntensityRange
    const rangeResult = calculateFeasibleIntensityRange(
      newStartTime,
      newEndTime,
      posts.length,
      staffCount
    );
    // For 0 rest, calculate directly since it's not in the standard range
    const newDuration = rangeResult.intensityDurationMap[newIntensity]
      ?? (newIntensity === 0
        ? getOptimalShiftDuration(newStartTime, newEndTime, posts.length, staffCount, 0)
        : 0);

    const newShiftStartTimes = calculateShiftStartingTimes(
      newStartTime,
      newEndTime,
      newDuration
    );

    // Update hours in global state — expand to 7 days if in weekly mode
    let newHours: UniqueString[];
    if (scheduleMode === "7d") {
      newHours = [];
      for (let day = 0; day < 7; day++) {
        for (let i = 0; i < newShiftStartTimes.length; i++) {
          newHours.push({
            id: `d${day}-h${i}`,
            value: encodeFlatHour(day, newShiftStartTimes[i]),
          });
        }
      }
    } else {
      newHours = newShiftStartTimes.map((time, index) => ({
        id: `shift-${index}-${time}`,
        value: time,
      }));
    }

    setShiftData((prev) => {
      const roster = getActiveRosterFromState(prev);
      const activeRosterId = prev.activeRosterId;

      // CRITICAL FIX: Update user constraints to match new hours structure
      const updatedUserShiftData = (prev.userShiftData || []).map(
        (userData) => {
          const updatedConstraints = (roster.posts || []).map((post) => {
            // For each post, ensure we have constraints for all new hours
            return newHours.map((hour, hourIndex) => {
              // Try to preserve existing constraint if it exists, otherwise create new one
              const existingConstraint =
                userData.constraints?.[roster.posts?.indexOf(post) || 0]?.[
                  hourIndex
                ];
              return (
                existingConstraint || {
                  postID: post.id,
                  hourID: hour.id,
                  availability: true, // Default to available
                }
              );
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
        }
      );

      // CRITICAL FIX: Clear assignments when hours structure changes
      const shouldClearAssignments = roster.hours?.length !== newHours.length;
      const clearedAssignments = shouldClearAssignments
        ? (roster.posts || []).map(() => newHours.map(() => null))
        : roster.assignments;

      return {
        ...updateActiveRoster(prev, (r) => ({
          ...r,
          startTime: newStartTime,
          endTime: newEndTime,
          hours: newHours,
          assignments: clearedAssignments,
        })),
        restTime: newIntensity,
        userShiftData: updatedUserShiftData,
      };
    });

    return { newDuration, newShiftStartTimes };
  };

  const handleStartTimeChange = (time: string) => {
    console.log(
      `🕐 [ShiftInfoSettingsView] Start time changed: ${localStartTime} → ${time}`
    );

    const { newDuration, newShiftStartTimes } = updateShiftStateWithNewHours(
      time,
      localEndTime,
      intensity
    );

    onStartTimeChange?.(time);

    console.log(
      `⏰ [ShiftInfoSettingsView] Duration after start time change: ${newDuration.toFixed(
        2
      )}h`
    );
    console.log(
      `📅 [ShiftInfoSettingsView] New shift start times: [${newShiftStartTimes.join(
        ", "
      )}]`
    );
  };

  const handleEndTimeChange = (time: string) => {
    console.log(
      `🕕 [ShiftInfoSettingsView] End time changed: ${localEndTime} → ${time}`
    );

    const { newDuration, newShiftStartTimes } = updateShiftStateWithNewHours(
      localStartTime,
      time,
      intensity
    );

    onEndTimeChange?.(time);

    console.log(
      `⏰ [ShiftInfoSettingsView] Duration after end time change: ${newDuration.toFixed(
        2
      )}h`
    );
    console.log(
      `📅 [ShiftInfoSettingsView] New shift start times: [${newShiftStartTimes.join(
        ", "
      )}]`
    );
  };

  const handleIntensityChange = (newIntensity: number) => {
    console.log(
      `🔄 [ShiftInfoSettingsView] Intensity changed: ${intensity} → ${newIntensity}`
    );

    const { newDuration, newShiftStartTimes } = updateShiftStateWithNewHours(
      localStartTime,
      localEndTime,
      newIntensity
    );

    onIntensityChange?.(newIntensity);

    console.log(
      `⏰ [ShiftInfoSettingsView] Duration after intensity change: ${newDuration.toFixed(
        2
      )}h`
    );
    console.log(
      `📅 [ShiftInfoSettingsView] New shift start times: [${newShiftStartTimes.join(
        ", "
      )}]`
    );
  };

  // NEVER initialize from props - always respect existing global state
  useEffect(() => {
    console.log(
      "✅ [ShiftInfoSettingsView] Component mounted with global state:",
      {
        "global startTime": activeRoster.startTime,
        "global endTime": activeRoster.endTime,
        "global restTime": shiftData.restTime,
        "global hours": activeRoster.hours?.map((h) => h.value) || [],
        "props startHour": startHour,
        "props endHour": endHour,
        "props restTime": restTime,
      }
    );
  }, [
    activeRoster.startTime,
    activeRoster.endTime,
    shiftData.restTime,
    activeRoster.hours,
    startHour,
    endHour,
    restTime,
  ]);

  // NEVER override user's intensity - just ensure options are available
  useEffect(() => {
    if (intensityOptions.length === 0) {
      console.log(
        "⚠️ [ShiftInfoSettingsView] No intensity options available, this might cause issues"
      );
    } else {
      console.log(
        "✅ [ShiftInfoSettingsView] Intensity options available:",
        intensityOptions
      );
    }
  }, [intensityOptions]);

  return (
    <div
      className={`w-full p-1 flex flex-col max-w-full ${className}`}
    >
      {/* Schedule Mode Section */}
      <div className="flex-shrink-0 mb-1">
        <div className="border border-border rounded-lg p-2">
          <div className="text-xs font-medium text-foreground mb-1 text-start">
            {t("scheduleMode")}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => { if (scheduleMode !== "24h") switchTo24H(); }}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  scheduleMode === "24h"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {t("singleDay")}
              </button>
              <button
                onClick={() => { if (scheduleMode !== "7d") switchTo7D(); }}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  scheduleMode === "7d"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {t("weeklyRoster")}
              </button>
            </div>
            {scheduleMode === "7d" && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">{t("startingDate")}</label>
                <input
                  type="date"
                  value={startDate || ""}
                  onChange={(e) => updateStartDate(e.target.value)}
                  className="px-2 py-1 border border-border rounded text-sm bg-background text-foreground"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shift Input — preset dropdown + time inputs */}
      <div className="flex-shrink-0 mb-1">
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
              {(() => {
                const [sH, sM] = localStartTime.split(":").map(Number);
                const [eH, eM] = localEndTime.split(":").map(Number);
                let mins = (eH * 60 + eM) - (sH * 60 + sM);
                if (mins <= 0) mins += 24 * 60;
                return `${Math.round(mins / 60)}hr`;
              })()}
            </span>
          </div>
        </div>
      </div>

      {/* Intensity + Shift Information row */}
      <div className="flex-shrink-0">
        <div className="border border-border rounded-lg p-2 space-y-1">
          <h3 className="text-xs font-semibold text-muted-foreground">{t("shiftIntensity")}</h3>
          {effectiveOptions.length > 0 ? (() => {
            // Check if all options produce the same duration
            const durations = new Set(effectiveOptions.map((o) => (intensityDurationMap[o] ?? 0).toFixed(2)));
            const allSame = durations.size <= 1 && effectiveOptions.length > 1;

            return allSame ? (
              // All options yield the same result — no slider needed
              <div className="space-y-1">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">{t("intensityFixed")}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{t("shiftsLabel", { defaultValue: "Shifts" })}: <span className="font-medium text-foreground">{scheduleInfo.shiftsCount}</span></span>
                  <span className="text-muted-foreground whitespace-nowrap">{t("duration")}: <span className="font-medium text-primary">{scheduleInfo.shiftDuration.toFixed(1)}h</span></span>
                </div>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={zeroRest}
                    onChange={(e) => {
                      setZeroRest(e.target.checked);
                      if (e.target.checked) {
                        handleIntensityChange(0);
                      } else if (intensity === 0) {
                        handleIntensityChange(intensityOptions[0] || 1);
                      }
                    }}
                    className="h-3 w-3 rounded border-border"
                  />
                  <span className="text-[10px] text-muted-foreground">{t("zeroRest")}</span>
                </label>
              </div>
            ) : (
              // Multiple distinct options — show slider
              <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("relaxed")}</span>
                <div className="flex-1 flex items-center relative h-4">
                  <div className="absolute inset-x-[6px] h-1 bg-border rounded-lg flex items-center justify-between">
                    {effectiveOptions.map((opt, i) => {
                      const [sH] = localStartTime.split(":").map(Number);
                      const [eH] = localEndTime.split(":").map(Number);
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
                          className={`w-1.5 h-1.5 rounded-full ${overCap ? "bg-red-500" : "bg-muted-foreground/40"}`}
                          title={overCap ? t("hintOverCapacity", { capacity: cap.toFixed(0), needed: need.toFixed(0) }) : ""}
                        />
                      );
                    })}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={effectiveOptions.length - 1}
                    step="1"
                    value={getSliderIndex(intensity)}
                    onChange={(e) => {
                      const newIntensity = getIntensityFromIndex(
                        parseInt(e.target.value)
                      );
                      handleIntensityChange(newIntensity);
                    }}
                    className="relative z-10 w-full h-1 bg-transparent rounded-lg appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:h-3
                      [&::-webkit-slider-thumb]:w-3
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-primary
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:h-3
                      [&::-moz-range-thumb]:w-3
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-primary
                      [&::-moz-range-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:border-none"
                  />
                </div>
                <span className="text-xs text-muted-foreground">{t("intense")}</span>
                <span className="text-muted-foreground/50 mx-1">|</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t("shiftsLabel", { defaultValue: "Shifts" })}: <span className="font-medium text-foreground">{scheduleInfo.shiftsCount}</span></span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t("rest")}: <span className="font-medium text-foreground">{intensity.toFixed(1)}h</span></span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t("duration")}: <span className="font-medium text-primary">{scheduleInfo.shiftDuration.toFixed(2)}h</span></span>
              </div>
              <label className="flex items-center gap-1 cursor-pointer ps-[3.5rem]">
                <input
                  type="checkbox"
                  checked={zeroRest}
                  onChange={(e) => {
                    setZeroRest(e.target.checked);
                    if (e.target.checked) {
                      handleIntensityChange(0);
                    } else if (intensity === 0) {
                      handleIntensityChange(intensityOptions[0] || 1);
                    }
                  }}
                  className="h-3 w-3 rounded border-border"
                />
                <span className="text-[10px] text-muted-foreground">{t("zeroRest")}</span>
              </label>
              </div>
            );
          })() : (
            <p className="text-xs text-muted-foreground text-center py-1">
              {t("noFeasibleSchedule")}
            </p>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="flex-shrink-0 mt-1">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
          {(() => {
            const [sh] = localStartTime.split(":").map(Number);
            const [eh] = localEndTime.split(":").map(Number);
            let opHours = eh - sh;
            if (opHours <= 0) opHours += 24;
            const maxWorkPerPerson = Math.max(0, opHours - Math.min(intensity, opHours * 0.8));
            const totalCapacity = staffCount * maxWorkPerPerson;
            const totalNeeded = scheduleInfo.shiftsCount * posts.length * scheduleInfo.shiftDuration;
            const params = {
              posts: posts.length,
              staff: staffCount,
              shifts: scheduleInfo.shiftsCount,
              duration: scheduleInfo.shiftDuration.toFixed(1),
              opHours,
              rest: intensity,
              start: localStartTime,
              end: localEndTime,
              maxWork: maxWorkPerPerson.toFixed(1),
              totalCapacity: totalCapacity.toFixed(0),
              totalNeeded: totalNeeded.toFixed(0),
            };
            const overCapacity = totalNeeded > totalCapacity && totalCapacity > 0;
            return (
              <div className="text-xs text-foreground text-start space-y-1">
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
      </div>
    </div>
  );
}
