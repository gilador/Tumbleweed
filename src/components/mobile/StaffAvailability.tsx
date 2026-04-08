import { useMemo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilValue } from "recoil";
import { UserShiftData, Constraint } from "../../models";
import { UniqueString } from "../../models/index";
import { IconArrowLeft, IconCheck, IconX } from "@tabler/icons-react";
import { shiftState, getActiveRosterFromState } from "../../stores/shiftStore";
import { RosterSwitcher } from "../RosterSwitcher";
import { DayTabStrip, DayIndicator } from "../DayTabStrip";
import { AvailabilityCopyBar } from "../AvailabilityCopyBar";
import { getDaySlice, getDisplayTime } from "../../service/weeklyScheduleUtils";
import { getTodayISO } from "../../service/dayLabelUtils";

interface StaffAvailabilityProps {
  userId: string;
  userShiftData: UserShiftData[];
  posts: UniqueString[];
  hours: UniqueString[];
  onBack: () => void;
  onUpdateConstraints: (userId: string, newConstraints: Constraint[][]) => void;
}

export function StaffAvailability({
  userId,
  userShiftData,
  posts,
  hours,
  onBack,
  onUpdateConstraints,
}: StaffAvailabilityProps) {
  const { t } = useTranslation();
  const shiftStateValue = useRecoilValue(shiftState);
  const activeRoster = getActiveRosterFromState(shiftStateValue);
  const scheduleMode = activeRoster.scheduleMode;
  const startDate = activeRoster.startDate;
  const [selectedDay, setSelectedDay] = useState(0);
  const isWeekly = scheduleMode === "7d";
  const daySlice = isWeekly ? getDaySlice(hours.length, selectedDay) : { start: 0, end: hours.length };

  const userData = useMemo(
    () => userShiftData.find((u) => u.user.id === userId),
    [userShiftData, userId]
  );

  const toggleSlot = useCallback(
    (postIndex: number, hourIndex: number) => {
      if (!userData) return;
      const newConstraints = userData.constraints.map((postConstraints, pi) =>
        postConstraints.map((c, hi) =>
          pi === postIndex && hi === hourIndex
            ? { ...c, availability: !c.availability }
            : c
        )
      );
      onUpdateConstraints(userId, newConstraints);
    },
    [userData, userId, onUpdateConstraints]
  );

  const togglePost = useCallback(
    (postIndex: number) => {
      if (!userData) return;
      const postConstraints = userData.constraints[postIndex];
      const allAvailable = postConstraints.every((c) => c.availability);
      const newConstraints = userData.constraints.map((pc, pi) =>
        pi === postIndex
          ? pc.map((c) => ({ ...c, availability: !allAvailable }))
          : pc
      );
      onUpdateConstraints(userId, newConstraints);
    },
    [userData, userId, onUpdateConstraints]
  );

  const setAll = useCallback(
    (available: boolean) => {
      if (!userData) return;
      const newConstraints = userData.constraints.map((postConstraints) =>
        postConstraints.map((c) => ({ ...c, availability: available }))
      );
      onUpdateConstraints(userId, newConstraints);
    },
    [userData, userId, onUpdateConstraints]
  );

  if (!userData) {
    return (
      <div className="px-4 py-4">
        <button onClick={onBack} className="flex items-center gap-2 min-h-[44px]">
          <IconArrowLeft size={20} className="icon-flip" />
          <span>{t("back")}</span>
        </button>
        <p className="text-center text-muted-foreground mt-8">{t("staffNotFound")}</p>
      </div>
    );
  }

  const formatTimeRange = (hourIndex: number): string => {
    const rawStart = hours[hourIndex]?.value || "";
    const startTime = isWeekly ? getDisplayTime(rawStart) : rawStart;
    const nextHour = hours[hourIndex + 1];
    if (nextHour) {
      const end = isWeekly ? getDisplayTime(nextHour.value) : nextHour.value;
      return `${startTime} → ${end}`;
    }
    return `${startTime} →`;
  };

  const handleCopyAvailability = (targetDayIndices: number[]) => {
    if (!userData) return;
    const sourceSlice = getDaySlice(hours.length, selectedDay);
    const newConstraints = userData.constraints.map((postCons) => {
      const newPostCons = [...postCons];
      const sourcePattern = newPostCons.slice(sourceSlice.start, sourceSlice.end);
      for (const targetDay of targetDayIndices) {
        const targetSlice = getDaySlice(hours.length, targetDay);
        for (let i = 0; i < sourcePattern.length; i++) {
          if (newPostCons[targetSlice.start + i]) {
            newPostCons[targetSlice.start + i] = {
              ...newPostCons[targetSlice.start + i],
              availability: sourcePattern[i].availability,
            };
          }
        }
      }
      return newPostCons;
    });
    onUpdateConstraints(userId, newConstraints);
  };

  // Compute day indicators from this user's constraints
  const dayIndicators: DayIndicator[] | undefined = isWeekly && userData
    ? Array.from({ length: 7 }, (_, dayIdx) => {
        const slice = getDaySlice(hours.length, dayIdx);
        const dayConstraints = userData.constraints.flatMap(
          (postCons) => postCons.slice(slice.start, slice.end)
        );
        const allAvail = dayConstraints.every((c) => c?.availability !== false);
        const noneAvail = dayConstraints.every((c) => !c?.availability);
        return allAvail ? "full" as const : noneAvail ? "empty" as const : "partial" as const;
      })
    : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-none">
        <button
          onClick={onBack}
          className="p-2 -ms-2 rounded-md hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <IconArrowLeft size={20} className="icon-flip" />
        </button>
        <h1 className="text-lg font-bold">{userData.user.name} <span className="text-muted-foreground font-normal text-sm">– {t("availability")}</span></h1>
        <div className="flex-1" />
        <RosterSwitcher />
      </div>

      {/* Day tabs for weekly mode */}
      {isWeekly && (
        <div className="px-4 py-2 flex-none space-y-2">
          <DayTabStrip
            startDate={startDate || getTodayISO()}
            selectedDay={selectedDay}
            onDayChange={setSelectedDay}
            dayIndicators={dayIndicators}
          />
          <AvailabilityCopyBar
            startDate={startDate || getTodayISO()}
            sourceDayIndex={selectedDay}
            onCopy={handleCopyAvailability}
          />
        </div>
      )}

      {/* Bulk actions */}
      <div className="flex gap-2 px-4 py-3 flex-none">
        <button
          onClick={() => setAll(true)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-border text-sm min-h-[44px] hover:bg-accent"
        >
          <IconCheck size={16} className="text-green-600" />
          {t("allAvailable")}
        </button>
        <button
          onClick={() => setAll(false)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-border text-sm min-h-[44px] hover:bg-accent"
        >
          <IconX size={16} className="text-red-500" />
          {t("allUnavailable")}
        </button>
      </div>

      {/* Post sections */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {posts.map((post, postIndex) => {
          const allPostConstraints = userData.constraints[postIndex] || [];
          const dayConstraints = allPostConstraints.slice(daySlice.start, daySlice.end);
          const availableCount = dayConstraints.filter((c) => c.availability).length;
          const allAvailable = availableCount === dayConstraints.length;

          return (
            <div key={post.id} className="rounded-lg border border-border overflow-hidden">
              {/* Post header — tap to toggle all */}
              <button
                onClick={() => togglePost(postIndex)}
                className="flex items-center justify-between w-full px-4 py-3 bg-muted/50 min-h-[44px]"
              >
                <span className="text-sm font-semibold">{post.value}</span>
                <span className="text-xs text-muted-foreground">
                  {availableCount}/{dayConstraints.length}
                  {allAvailable && " \u2713"}
                </span>
              </button>

              {/* Time slot rows */}
              <div className="divide-y divide-border">
                {dayConstraints.map((constraint, localIndex) => {
                  const flatIndex = daySlice.start + localIndex;
                  return (
                    <button
                      key={`${post.id}-${flatIndex}`}
                      onClick={() => toggleSlot(postIndex, flatIndex)}
                      className="flex items-center justify-between w-full px-4 min-h-[48px] hover:bg-accent/50 transition-colors"
                    >
                      <span className="text-sm" dir="ltr">{formatTimeRange(flatIndex)}</span>
                      <span
                        className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          constraint.availability
                            ? "bg-green-100 text-green-700"
                            : "bg-red-50 text-red-400"
                        }`}
                      >
                        {constraint.availability ? (
                          <IconCheck size={16} />
                        ) : (
                          <IconX size={16} />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
