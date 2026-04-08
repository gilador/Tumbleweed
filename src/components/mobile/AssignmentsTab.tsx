import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilValue } from "recoil";
import { UserShiftData } from "../../models";
import { UniqueString } from "../../models/index";
import { IconClock, IconMapPin, IconTrash } from "@tabler/icons-react";
import { FloatingActionButton } from "./FloatingActionButton";
import { ReassignSheet } from "./ReassignSheet";
import { ShareButton } from "../ShareButton";
import { shiftState, getActiveRosterFromState } from "../../stores/shiftStore";
import { RosterSwitcher } from "../RosterSwitcher";
import { DayTabStrip } from "../DayTabStrip";
import { getDaySlice, getDisplayTime } from "../../service/weeklyScheduleUtils";
import { getTodayISO } from "../../service/dayLabelUtils";
import { WeeklyRosterGrid } from "../WeeklyRosterGrid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../elements/dialog";
import { Button } from "../elements/button";

interface AssignmentsTabProps {
  posts: UniqueString[];
  hours: UniqueString[];
  assignments: (string | null)[][];
  userShiftData: UserShiftData[];
  endTime: string;
  customCellDisplayNames: { [slotKey: string]: string };
  isOptimizeDisabled: boolean;
  optimizeButtonTitle: string;
  onOptimize: () => Promise<void>;
  onAssignmentChange: (postIndex: number, hourIndex: number, userId: string | null) => void;
  onClearAll: () => void;
  showInfo: (message: string, duration?: number) => void;
}

type GroupBy = "time" | "post";

interface ReassignTarget {
  postIndex: number;
  hourIndex: number;
}

export function AssignmentsTab({
  posts,
  hours,
  assignments,
  userShiftData,
  endTime,
  customCellDisplayNames,
  isOptimizeDisabled,
  optimizeButtonTitle,
  onOptimize,
  onAssignmentChange,
  onClearAll,
  showInfo,
}: AssignmentsTabProps) {
  const { t } = useTranslation();
  const shiftStateValue = useRecoilValue(shiftState);
  const activeRoster = getActiveRosterFromState(shiftStateValue);
  const scheduleMode = activeRoster.scheduleMode;
  const startDate = activeRoster.startDate;
  const [groupBy, setGroupBy] = useState<GroupBy>("time");
  const [weeklyView, setWeeklyView] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<ReassignTarget | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

  const isWeekly = scheduleMode === "7d";
  const daySlice = isWeekly ? getDaySlice(hours.length, selectedDay) : { start: 0, end: hours.length };
  const displayHours = hours.slice(daySlice.start, daySlice.end);

  // Determine current time slot
  const currentHourIndex = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < hours.length; i++) {
      const [h, m] = hours[i].value.split(":").map(Number);
      const slotStart = h * 60 + m;

      let slotEnd: number;
      if (i + 1 < hours.length) {
        const [nh, nm] = hours[i + 1].value.split(":").map(Number);
        slotEnd = nh * 60 + nm;
      } else {
        const [eh, em] = endTime.split(":").map(Number);
        slotEnd = eh * 60 + em;
      }

      if (currentMinutes >= slotStart && currentMinutes < slotEnd) {
        return i;
      }
    }
    return -1;
  }, [hours, endTime]);

  const hasAnyAssignments = assignments.some((post) =>
    post.some((userId) => userId !== null)
  );

  const formatTimeRange = (hourIndex: number): string => {
    const rawStart = hours[hourIndex]?.value || "";
    const start = isWeekly ? getDisplayTime(rawStart) : rawStart;
    if (hourIndex + 1 < hours.length) {
      const rawEnd = hours[hourIndex + 1].value;
      const end = isWeekly ? getDisplayTime(rawEnd) : rawEnd;
      return `${start} → ${end}`;
    }
    return `${start} → ${endTime}`;
  };

  const getUserName = (userId: string | null, postIndex: number, hourIndex: number): string => {
    const slotKey = `${postIndex}-${hourIndex}`;
    if (customCellDisplayNames[slotKey]) return customCellDisplayNames[slotKey];
    if (!userId) return "";
    const user = userShiftData.find((u) => u.user.id === userId);
    return user?.user.name || "";
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      await onOptimize();
    } finally {
      setIsOptimizing(false);
    }
  };

  // Empty state
  if (!hasAnyAssignments && posts.length > 0) {
    return (
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{t("assignments")}</h1>
        </div>
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">{t("noAssignmentsYet")}</p>
          <p className="text-xs mt-1">{t("tapOptimizeToGenerate")}</p>
        </div>
        <FloatingActionButton
          onClick={handleOptimize}
          onDisabledClick={() => showInfo(t("alreadyOptimised"))}
          disabled={isOptimizeDisabled}
          loading={isOptimizing}
          title={optimizeButtonTitle}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4 pb-24">
      {/* Header with actions and grouping toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">{t("assignments")}</h1>
          <RosterSwitcher />
          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-medium">
            {scheduleMode === "7d" ? t("weeklyRoster") : t("singleDay")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ShareButton
            posts={posts}
            hours={hours}
            assignments={assignments}
            userShiftData={userShiftData}
            endTime={endTime}
            customCellDisplayNames={customCellDisplayNames}
            groupBy={groupBy}
            onCopied={() => showInfo(t("copiedToClipboard"))}
          />
          <button
            onClick={() => setIsClearDialogOpen(true)}
            className="p-2 rounded-md hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={t("clearAllAssignmentsTitle")}
          >
            <IconTrash size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="flex justify-between items-center">
        {isWeekly && (
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setWeeklyView(false)}
              className={`px-2.5 py-1.5 text-xs min-h-[36px] font-medium ${
                !weeklyView ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              {t("dailyView")}
            </button>
            <button
              onClick={() => setWeeklyView(true)}
              className={`px-2.5 py-1.5 text-xs min-h-[36px] font-medium ${
                weeklyView ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              {t("weeklyView")}
            </button>
          </div>
        )}
        {!weeklyView && (
          <div className="flex rounded-md border border-border overflow-hidden ms-auto">
            <button
              onClick={() => setGroupBy("time")}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs min-h-[36px] ${
                groupBy === "time" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              <IconClock size={14} />
              {t("time")}
            </button>
            <button
              onClick={() => setGroupBy("post")}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs min-h-[36px] ${
                groupBy === "post" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              <IconMapPin size={14} />
              {t("post")}
            </button>
          </div>
        )}
      </div>

      {/* Weekly roster grid (mobile read-only) */}
      {weeklyView && isWeekly ? (
        <WeeklyRosterGrid
          posts={posts}
          hours={hours}
          assignments={assignments}
          userShiftData={userShiftData}
          endTime={endTime}
          customCellDisplayNames={customCellDisplayNames}
          startDate={startDate}
          onDayDrillDown={(dayIndex) => {
            setSelectedDay(dayIndex);
            setWeeklyView(false);
          }}
        />
      ) : (
      <>
      {/* Day tabs for weekly mode */}
      {isWeekly && (
        <DayTabStrip
          startDate={startDate || getTodayISO()}
          selectedDay={selectedDay}
          onDayChange={setSelectedDay}
        />
      )}

      {/* Assignment cards */}
      {groupBy === "time" ? (
        // Group by time
        <div className="space-y-3">
          {displayHours.map((hour, localIndex) => {
            const hourIndex = daySlice.start + localIndex;
            const isCurrent = hourIndex === currentHourIndex;
            const isNext = hourIndex === currentHourIndex + 1;
            const defaultExpanded = isCurrent || isNext || currentHourIndex === -1;

            return (
              <TimeCard
                key={hour.id}
                timeRange={formatTimeRange(hourIndex)}
                isCurrent={isCurrent}
                defaultExpanded={defaultExpanded}
                posts={posts}
                getUserName={(postIndex) => getUserName(assignments[postIndex]?.[hourIndex], postIndex, hourIndex)}
                onTapAssignment={(postIndex) => setReassignTarget({ postIndex, hourIndex })}
              />
            );
          })}
        </div>
      ) : (
        // Group by post
        <div className="space-y-3">
          {posts.map((post, postIndex) => (
            <PostCard
              key={post.id}
              postName={post.value}
              hours={displayHours}
              endTime={endTime}
              currentHourIndex={isWeekly ? currentHourIndex - daySlice.start : currentHourIndex}
              getUserName={(localIndex) => {
                const flatIndex = daySlice.start + localIndex;
                return getUserName(assignments[postIndex]?.[flatIndex], postIndex, flatIndex);
              }}
              onTapAssignment={(localIndex) => {
                const flatIndex = daySlice.start + localIndex;
                setReassignTarget({ postIndex, hourIndex: flatIndex });
              }}
              isWeekly={isWeekly}
            />
          ))}
        </div>
      )}
      </>
      )}

      {/* FAB */}
      <FloatingActionButton
        onClick={handleOptimize}
        onDisabledClick={() => showInfo(t("alreadyOptimised"))}
        disabled={isOptimizeDisabled}
        loading={isOptimizing}
        title={optimizeButtonTitle}
      />

      {/* Reassign Sheet */}
      {reassignTarget && (
        <ReassignSheet
          postIndex={reassignTarget.postIndex}
          hourIndex={reassignTarget.hourIndex}
          postName={posts[reassignTarget.postIndex]?.value || ""}
          timeRange={formatTimeRange(reassignTarget.hourIndex)}
          currentUserId={assignments[reassignTarget.postIndex]?.[reassignTarget.hourIndex]}
          userShiftData={userShiftData}
          onAssign={(userId) => {
            onAssignmentChange(reassignTarget.postIndex, reassignTarget.hourIndex, userId);
            setReassignTarget(null);
          }}
          onClose={() => setReassignTarget(null)}
        />
      )}

      {/* Clear dialog */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clearAllAssignmentsTitle")}</DialogTitle>
            <DialogDescription>
              {t("clearAllAssignmentsDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setIsClearDialogOpen(false)} size="sm">
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onClearAll();
                setIsClearDialogOpen(false);
              }}
              size="sm"
            >
              {t("clear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Sub-components ---

function TimeCard({
  timeRange,
  isCurrent,
  defaultExpanded,
  posts,
  getUserName,
  onTapAssignment,
}: {
  timeRange: string;
  isCurrent: boolean;
  defaultExpanded: boolean;
  posts: UniqueString[];
  getUserName: (postIndex: number) => string;
  onTapAssignment: (postIndex: number) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={`rounded-lg border overflow-hidden ${isCurrent ? "border-primary border-2" : "border-border"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 min-h-[48px] bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" dir="ltr">{timeRange}</span>
          {isCurrent && (
            <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              {t("now")}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="divide-y divide-border">
          {posts.map((post, postIndex) => {
            const name = getUserName(postIndex);
            return (
              <button
                key={post.id}
                onClick={() => onTapAssignment(postIndex)}
                className="flex items-center justify-between w-full px-4 min-h-[48px] hover:bg-accent/50"
              >
                <span className="text-xs text-muted-foreground">{post.value}</span>
                <span className={`text-sm ${name ? "font-medium" : "text-muted-foreground italic"}`}>
                  {name || t("unassigned")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PostCard({
  postName,
  hours,
  endTime,
  currentHourIndex,
  getUserName,
  onTapAssignment,
  isWeekly = false,
}: {
  postName: string;
  hours: UniqueString[];
  endTime: string;
  currentHourIndex: number;
  getUserName: (hourIndex: number) => string;
  onTapAssignment: (hourIndex: number) => void;
  isWeekly?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  const formatTimeRange = (hourIndex: number): string => {
    const rawStart = hours[hourIndex]?.value || "";
    const start = isWeekly ? getDisplayTime(rawStart) : rawStart;
    if (hourIndex + 1 < hours.length) {
      const rawEnd = hours[hourIndex + 1].value;
      const end = isWeekly ? getDisplayTime(rawEnd) : rawEnd;
      return `${start} → ${end}`;
    }
    return `${start} → ${endTime}`;
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 min-h-[48px] bg-muted/30"
      >
        <span className="text-sm font-semibold">{postName}</span>
        <span className="text-xs text-muted-foreground">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="divide-y divide-border">
          {hours.map((_, hourIndex) => {
            const name = getUserName(hourIndex);
            const isCurrent = hourIndex === currentHourIndex;
            return (
              <button
                key={hourIndex}
                onClick={() => onTapAssignment(hourIndex)}
                className={`flex items-center justify-between w-full px-4 min-h-[48px] hover:bg-accent/50 ${
                  isCurrent ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground" dir="ltr">{formatTimeRange(hourIndex)}</span>
                  {isCurrent && (
                    <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                      {t("now")}
                    </span>
                  )}
                </div>
                <span className={`text-sm ${name ? "font-medium" : "text-muted-foreground italic"}`}>
                  {name || t("unassigned")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
