import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UniqueString, UserShiftData } from "../models";
import { generateBadges } from "../service/badgeUtils";
import {
  getDaySlice,
  getDisplayTime,
  getShiftsPerDay,
} from "../service/weeklyScheduleUtils";
import { getDayLabel } from "../service/dayLabelUtils";
import { getTodayISO } from "../service/dayLabelUtils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useIsMobile } from "../hooks/useIsMobile";
import { colors } from "@/constants/colors";

interface WeeklyRosterGridProps {
  posts: UniqueString[];
  hours: UniqueString[];
  assignments: (string | null)[][];
  userShiftData: UserShiftData[];
  endTime: string;
  customCellDisplayNames: { [slotKey: string]: string };
  startDate: string | null;
  selectedUserId?: string | null;
  onAssignmentChange?: (
    postIndex: number,
    hourIndex: number,
    userId: string | null
  ) => void;
  onDayDrillDown?: (dayIndex: number) => void;
}

export function WeeklyRosterGrid({
  posts,
  hours,
  assignments,
  userShiftData,
  endTime: _endTime,
  customCellDisplayNames,
  startDate,
  selectedUserId,
  onAssignmentChange,
  onDayDrillDown,
}: WeeklyRosterGridProps) {
  const { i18n } = useTranslation();
  const isMobile = useIsMobile();
  const locale = i18n.language === "he" ? "he-IL" : "en-US";
  const effectiveStartDate = startDate || getTodayISO();

  const shiftsPerDay = getShiftsPerDay(hours);

  // Generate badges from all users
  const badgeMap = useMemo(
    () =>
      generateBadges(
        userShiftData.map((u) => ({ id: u.user.id, name: u.user.name }))
      ),
    [userShiftData]
  );

  // Build user lookup
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of userShiftData) {
      map.set(u.user.id, u.user.name);
    }
    return map;
  }, [userShiftData]);

  // Build day structure
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, dayIndex) => {
      const slice = getDaySlice(hours.length, dayIndex);
      const dayHours = hours.slice(slice.start, slice.end);
      const label = getDayLabel(effectiveStartDate, dayIndex, locale);
      // Extract just the day name (first word)
      const shortLabel = label.split(" ")[0];
      return {
        dayIndex,
        label: shortLabel,
        fullLabel: label,
        hours: dayHours,
        sliceStart: slice.start,
        sliceEnd: slice.end,
      };
    });
  }, [hours, effectiveStartDate, locale]);

  const totalColumns = shiftsPerDay * 7;

  // Track which cell is being reassigned (desktop only)
  const [reassignCell, setReassignCell] = useState<{
    postIndex: number;
    hourIndex: number;
  } | null>(null);

  // Track which cell's name is revealed (mobile only)
  const [revealCell, setRevealCell] = useState<{
    postIndex: number;
    hourIndex: number;
  } | null>(null);

  function getCellDisplay(
    postIndex: number,
    hourIndex: number
  ): { badge: string; fullName: string } {
    const slotKey = `${postIndex}-${hourIndex}`;
    const customName = customCellDisplayNames[slotKey];
    if (customName) {
      return { badge: customName.slice(0, 3), fullName: customName };
    }
    const userId = assignments[postIndex]?.[hourIndex];
    if (!userId) return { badge: "–", fullName: "" };
    const badge = badgeMap.get(userId) || "??";
    const fullName = userMap.get(userId) || "";
    return { badge, fullName };
  }

  function handleCellClick(postIndex: number, hourIndex: number) {
    if (isMobile) {
      const { fullName } = getCellDisplay(postIndex, hourIndex);
      if (fullName === "") {
        setRevealCell(null);
        return;
      }
      if (revealCell?.postIndex === postIndex && revealCell?.hourIndex === hourIndex) {
        setRevealCell(null);
      } else {
        setRevealCell({ postIndex, hourIndex });
      }
      return;
    }
    if (reassignCell?.postIndex === postIndex && reassignCell?.hourIndex === hourIndex) {
      setReassignCell(null);
    } else {
      setReassignCell({ postIndex, hourIndex });
    }
  }

  function handleReassign(userId: string | null) {
    if (!reassignCell || !onAssignmentChange) return;
    onAssignmentChange(reassignCell.postIndex, reassignCell.hourIndex, userId);
    setReassignCell(null);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div
          className="grid gap-1 min-w-max"
          style={{
            gridTemplateColumns: `max-content repeat(${totalColumns}, minmax(40px, 1fr))`,
          }}
          role="grid"
          data-testid="weekly-roster-grid"
        >
          {/* Row 1: Day headers */}
          <div className="sticky start-0 z-20 bg-background" />
          {days.map((day) => (
            <div
              key={`day-header-${day.dayIndex}`}
              className={`text-start text-xs font-semibold py-1.5 ps-1 ${colors.text.default} ${isMobile ? "cursor-pointer hover:bg-accent/50" : ""}`}
              style={{ gridColumn: `span ${shiftsPerDay}` }}
              onClick={() => isMobile && onDayDrillDown?.(day.dayIndex)}
              data-testid={`day-header-${day.dayIndex}`}
            >
              {day.label}
            </div>
          ))}

          {/* Row 2: Shift time sub-headers */}
          <div className="sticky start-0 z-20 bg-background" />
          {days.map((day) =>
            day.hours.map((hour, shiftIndex) => {
              const time = getDisplayTime(hour.value);
              return (
                <div
                  key={`shift-header-${day.dayIndex}-${shiftIndex}`}
                  className="text-center text-[10px] text-muted-foreground py-1"
                  dir="ltr"
                >
                  {time}
                </div>
              );
            })
          )}

          {/* Data rows: one per post */}
          {posts.map((post, postIndex) => (
            <>
              {/* Post name (sticky) */}
              <div
                key={`post-${post.id}`}
                className="sticky start-0 z-10 bg-background px-2 py-2 text-xs font-medium flex items-center whitespace-nowrap"
                style={{ minWidth: "5rem" }}
              >
                {post.value}
              </div>

              {/* Assignment cells */}
              {days.map((day) =>
                day.hours.map((_, shiftIndex) => {
                  const hourIndex = day.sliceStart + shiftIndex;
                  const { badge, fullName } = getCellDisplay(
                    postIndex,
                    hourIndex
                  );
                  const assignedUserId = assignments[postIndex]?.[hourIndex];
                  const isAssigned = assignedUserId !== null;
                  const isSelectedUser = selectedUserId != null && assignedUserId === selectedUserId;
                  const isReassigning =
                    reassignCell?.postIndex === postIndex &&
                    reassignCell?.hourIndex === hourIndex;
                  const isRevealing =
                    isMobile &&
                    revealCell?.postIndex === postIndex &&
                    revealCell?.hourIndex === hourIndex;

                  const cellKey = `cell-${postIndex}-${hourIndex}`;
                  const cellDiv = (
                    <div
                      key={cellKey}
                      className={`relative rounded-md text-center py-2 text-xs cursor-default select-none transition-colors ${
                        isSelectedUser
                          ? `${colors.cell.selected} font-bold`
                          : colors.cell.dim
                      } ${
                        isAssigned && !isSelectedUser
                          ? "font-medium"
                          : !isAssigned
                            ? "text-muted-foreground/40"
                            : ""
                      } ${
                        !isMobile
                          ? "cursor-pointer hover:bg-accent/50"
                          : ""
                      } ${isReassigning || isRevealing ? "ring-2 ring-primary ring-inset" : ""}`}
                      onClick={() => handleCellClick(postIndex, hourIndex)}
                      data-testid={`cell-${postIndex}-${hourIndex}`}
                      role="gridcell"
                    >
                      {badge}

                      {/* Name reveal label (mobile only) */}
                      {isRevealing && (
                        <div
                          className="absolute top-full start-0 z-30 mt-0.5 bg-popover border rounded px-2 py-1 text-xs shadow-sm whitespace-nowrap"
                          data-testid={`reveal-name-${postIndex}-${hourIndex}`}
                        >
                          {fullName}
                        </div>
                      )}

                      {/* Reassignment dropdown (desktop only) */}
                      {isReassigning && !isMobile && (
                        <div
                          className="absolute top-full start-0 z-30 mt-1 bg-popover border rounded-md shadow-lg py-1 min-w-[120px] max-h-48 overflow-y-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="w-full text-start px-3 py-1.5 text-xs hover:bg-accent text-muted-foreground italic"
                            onClick={() => handleReassign(null)}
                          >
                            –
                          </button>
                          {userShiftData.map((u) => (
                            <button
                              key={u.user.id}
                              className={`w-full text-start px-3 py-1.5 text-xs hover:bg-accent ${
                                assignments[postIndex]?.[hourIndex] ===
                                u.user.id
                                  ? "bg-primary/10 font-medium"
                                  : ""
                              }`}
                              onClick={() => handleReassign(u.user.id)}
                            >
                              {u.user.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );

                  return isMobile ? cellDiv : (
                    <Tooltip key={cellKey}>
                      <TooltipTrigger asChild>
                        {cellDiv}
                      </TooltipTrigger>
                      {fullName && (
                        <TooltipContent>
                          <p>{fullName}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })
              )}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
