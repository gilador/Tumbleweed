import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilValue } from "recoil";
import { IconChevronLeft, IconChevronRight, IconPlus } from "@tabler/icons-react";
import { User, UserShiftData } from "../models";
import { UniqueString } from "../models/index";
import {
  shiftState,
  getActiveRosterFromState,
  shiftScheduleInfoSelector,
} from "../stores/shiftStore";
import { DayTabStrip } from "./DayTabStrip";
import { BulkSelectionBar } from "./BulkSelectionBar";
import { useMultiSelectValue } from "../stores/selectionStore";
import { GroupToggle, GroupBy } from "./schedule/GroupToggle";
import { ShiftCard } from "./schedule/ShiftCard";
import { PostCard } from "./schedule/PostCard";
import { ScheduleNav } from "./schedule/ScheduleNav";
import { AssignWorkerPopover } from "./schedule/AssignWorkerPopover";
import { useContextMenu } from "../stores/contextMenuStore";
import { getDisplayTime, getDaySlice } from "../service/weeklyScheduleUtils";
import { getTodayISO } from "../service/dayLabelUtils";
import { trackEvent } from "../lib/analytics";
import { formatTimeRange } from "../lib/formatTimeRange";

export interface AvailabilityTableViewProps {
  assignments?: (string | null)[][];
  posts: UniqueString[];
  hours: UniqueString[];
  endTime?: string;
  isEditing?: boolean;
  onPostEdit?: (postId: string, newName: string) => void;
  onPostDeleteSingle?: (postId: string) => void;
  users?: User[];
  userShiftData?: UserShiftData[];
  selectedUserId?: string | null;
  className?: string;
  onAssignmentEdit?: (
    postIndex: number,
    hourIndex: number,
    newUserName: string
  ) => void;
  customCellDisplayNames?: { [slotKey: string]: string };
  justAddedPostId?: string | null;
  onAddPost?: () => void;
  allPostIds?: string[];
  onBulkDelete?: (ids: string[]) => void;
  hasAssignments?: boolean;
  onClearAssignments?: () => void;
}

const EMPTY_SET: Set<string> = new Set<string>();

export function AvailabilityTableView({
  assignments,
  posts,
  hours,
  endTime,
  isEditing = false,
  onPostEdit,
  onPostDeleteSingle,
  users = [],
  selectedUserId,
  className = "",
  onAssignmentEdit,
  customCellDisplayNames = {},
  justAddedPostId,
  onAddPost,
  allPostIds,
  onBulkDelete,
  hasAssignments = false,
  onClearAssignments,
}: AvailabilityTableViewProps) {
  const { t, i18n } = useTranslation();
  const dir: "ltr" | "rtl" = i18n.language === "he" ? "rtl" : "ltr";
  const { multiSelected, multiSelectKind } = useMultiSelectValue();
  const checkedStaffIds: Set<string> =
    multiSelectKind === "staff" && multiSelected ? multiSelected : EMPTY_SET;
  const state = useRecoilValue(shiftState);
  const scheduleInfo = useRecoilValue(shiftScheduleInfoSelector);
  const activeRoster = getActiveRosterFromState(state);
  const scheduleMode = activeRoster.scheduleMode;
  const startDate = activeRoster.startDate;
  const [selectedDay, setSelectedDay] = useState(0);
  const [postsBarMounted, setPostsBarMounted] = useState(false);

  useEffect(() => {
    if (onBulkDelete && multiSelectKind === "posts") {
      setPostsBarMounted(true);
    }
  }, [onBulkDelete, multiSelectKind]);
  const [groupBy, setGroupBy] = useState<GroupBy>("time");

  // Locked: when not in editing mode, click handlers in cards should be gated.
  // Per architect plan + CTO note, isLocked === !isEditing in the OSS core path
  // (no separate lock signal exists today).
  const isLocked = !isEditing;

  const isWeekly = scheduleMode === "7d";
  const daySlice = isWeekly
    ? getDaySlice(hours.length, selectedDay)
    : { start: 0, end: hours.length };
  const displayHours = hours.slice(daySlice.start, daySlice.end);

  const displayEndTime = isWeekly
    ? selectedDay < 6
      ? getDisplayTime(hours[daySlice.end]?.value || endTime || "??:??")
      : endTime || "??:??"
    : endTime;

  const assignmentHighlightedDays: Set<number> | undefined =
    isWeekly && selectedUserId && assignments
      ? (() => {
          const days = new Set<number>();
          for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
            const slice = getDaySlice(hours.length, dayIdx);
            for (let p = 0; p < (assignments.length || 0); p++) {
              for (let h = slice.start; h < slice.end; h++) {
                if (assignments[p]?.[h] === selectedUserId) {
                  days.add(dayIdx);
                  break;
                }
              }
              if (days.has(dayIdx)) break;
            }
          }
          return days.size > 0 ? days : undefined;
        })()
      : undefined;

  const handleAssignmentNameChange = (
    postIndex: number,
    hourIndex: number,
    newUserName: string
  ) => {
    onAssignmentEdit?.(postIndex, hourIndex, newUserName);
  };

  const handleCellClick = (
    pi: number,
    si: number,
    _anchor: HTMLSpanElement
  ) => {
    if (isLocked) return;
    // Cycle through users: empty -> first -> next -> ... -> empty.
    if (!users.length) return;
    const current = assignments?.[pi]?.[si] ?? null;
    const nextIdx = current === null ? 0 : users.findIndex((u) => u.id === current) + 1;
    if (nextIdx >= users.length) {
      handleAssignmentNameChange(pi, si, "");
    } else {
      handleAssignmentNameChange(pi, si, users[nextIdx].name);
    }
  };

  const handleGroupChange = (next: GroupBy) => {
    if (next === groupBy) return;
    trackEvent("group-toggle-change", { from: groupBy, to: next });
    setGroupBy(next);
  };

  const shifts = displayHours.map((hour, localIndex) => {
    const startTimeStr = isWeekly ? getDisplayTime(hour.value) : hour.value;
    const nextHour = displayHours[localIndex + 1];
    const hourEndTime = nextHour
      ? isWeekly
        ? getDisplayTime(nextHour.value)
        : nextHour.value
      : displayEndTime || "??:??";
    return {
      si: daySlice.start + localIndex,
      from: startTimeStr,
      to: hourEndTime,
    };
  });

  const safeAssignments: (string | null)[][] =
    assignments ?? posts.map(() => hours.map(() => null));

  const durationLabel =
    scheduleInfo.shiftDuration > 0
      ? t("durationEach", { duration: scheduleInfo.shiftDuration })
      : undefined;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const persistKey = `tw-schedule-scroll:${groupBy}:${selectedDay}`;
  const firstScrollFiredRef = useRef(false);
  const { state: ctxState, closeAssignPopover } = useContextMenu();

  // Capture scroll position to sessionStorage; emit horizontal-scroll-start once.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let ticking = false;
    const handler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(persistKey, String(el.scrollLeft));
        } catch {
          /* ignore storage errors */
        }
        if (!firstScrollFiredRef.current && Math.abs(el.scrollLeft) > 0) {
          trackEvent("horizontal-scroll-start", {});
          firstScrollFiredRef.current = true;
        }
        ticking = false;
      });
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [persistKey]);

  // Restore scroll position when the layout key changes.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(persistKey);
    } catch {
      /* ignore */
    }
    el.scrollLeft = stored !== null ? Number(stored) || 0 : 0;
  }, [persistKey, posts.length, displayHours.length]);

  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const updateChevronState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const range = el.scrollWidth - el.clientWidth;
    const abs = Math.abs(el.scrollLeft);
    setCanScrollStart(abs > 0);
    setCanScrollEnd(abs < range - 1);
  }, []);

  useEffect(() => {
    updateChevronState();
  }, [updateChevronState, posts.length, displayHours.length, groupBy]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateChevronState, { passive: true });
    const observer = new ResizeObserver(updateChevronState);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateChevronState);
      observer.disconnect();
    };
  }, [updateChevronState]);

  const scrollByDirection = (direction: "start" | "end") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isRtl = getComputedStyle(el).direction === "rtl";
    const writeSign = isRtl && el.scrollLeft <= 0 ? -1 : 1;
    const directionSign = direction === "end" ? 1 : -1;
    const step = el.clientWidth * 0.8;
    el.scrollBy({ left: writeSign * directionSign * step, behavior: "smooth" });
    trackEvent("schedule-grid-chevron-click", { direction });
  };

  const chips = useMemo(() => {
    if (groupBy === "time") {
      return shifts.map((s) => ({ id: `shift-${s.si}`, label: formatTimeRange(s.from, s.to, dir) }));
    }
    return posts.map((p) => ({ id: `post-${p.id}`, label: p.value }));
  }, [groupBy, shifts, posts]);

  const cardSelector = (id: string) => `[data-card-id="${id}"]`;

  const assignPopoverOpen =
    ctxState !== null &&
    ctxState.assignPopoverOpen &&
    ctxState.kind === "posts";
  const assignPostIndex = ctxState?.postIndex ?? null;
  const assignShiftIndex = ctxState?.shiftIndex ?? null;
  const assignAnchorEl = ctxState?.anchorEl ?? null;

  // Resolve a fallback anchor when right-click landed on the post head (no row).
  const resolvedAssignAnchor = useMemo(() => {
    if (!assignPopoverOpen) return null;
    if (assignAnchorEl) return assignAnchorEl;
    if (ctxState?.kind === "posts") {
      const pid = ctxState.targetId;
      const empty = document.querySelector<HTMLElement>(
        `[data-card-id="post-${pid}"] .who.empty, [data-post-id="${pid}"] .who.empty`
      );
      if (empty) return empty;
      return document.querySelector<HTMLElement>(
        `[data-card-id="post-${pid}"] .who, [data-post-id="${pid}"] .who`
      );
    }
    return null;
  }, [assignPopoverOpen, assignAnchorEl, ctxState]);

  const handleAssignSelect = (userId: string | null) => {
    if (assignPostIndex !== null && assignShiftIndex !== null) {
      const name = userId === null ? "" : users.find((u) => u.id === userId)?.name ?? "";
      handleAssignmentNameChange(assignPostIndex, assignShiftIndex, name);
    } else if (ctxState?.kind === "posts" && resolvedAssignAnchor) {
      // Fallback: derive pi/si from the resolved cell's data attributes.
      const pi = Number(resolvedAssignAnchor.getAttribute("data-pi"));
      const si = Number(resolvedAssignAnchor.getAttribute("data-si"));
      if (!Number.isNaN(pi) && !Number.isNaN(si)) {
        const name = userId === null ? "" : users.find((u) => u.id === userId)?.name ?? "";
        handleAssignmentNameChange(pi, si, name);
      }
    }
    closeAssignPopover();
  };

  return (
    <div className={`w-full h-full flex flex-col min-h-0 ${className}`}>
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          data-testid="schedule-section-content"
          className="py-2 px-1 flex flex-col flex-1 min-h-0"
        >
          <div className="d-strip-row flex items-center gap-3 flex-wrap mb-1">
            <div
              data-testid="schedule-controls-cluster"
              className="flex items-center gap-2"
            >
              <GroupToggle value={groupBy} onChange={handleGroupChange} />
              {onAddPost && (
                <button
                  type="button"
                  data-testid="add-position-button"
                  onClick={onAddPost}
                  className="inline-flex items-center gap-1 h-[26px] px-2.5 rounded-md border border-border bg-background text-foreground text-xs font-medium hover:bg-muted"
                >
                  <IconPlus size={13} />
                  {t("addPosition")}
                </button>
              )}
              {hasAssignments && onClearAssignments && (
                <button
                  type="button"
                  data-testid="clear-assignments-button"
                  onClick={onClearAssignments}
                  className="inline-flex items-center gap-1 h-[26px] px-2.5 rounded-md border border-border bg-background text-foreground text-xs font-medium hover:bg-muted"
                >
                  {t("clearAssignments")}
                </button>
              )}
            </div>
            {isWeekly && (
              <div className="flex-1 min-w-0">
                <DayTabStrip
                  startDate={startDate || getTodayISO()}
                  selectedDay={selectedDay}
                  onDayChange={setSelectedDay}
                  highlightedDays={assignmentHighlightedDays}
                />
              </div>
            )}
            {onBulkDelete && postsBarMounted && (
              <div className="flex-1 min-w-0">
                <BulkSelectionBar
                  kind="posts"
                  total={posts.length}
                  allIds={allPostIds ?? posts.map((p) => p.id)}
                  onBulkDelete={onBulkDelete}
                  inline
                  onExitComplete={() => setPostsBarMounted(false)}
                />
              </div>
            )}
          </div>

          <ScheduleNav
            chips={chips}
            scrollContainerRef={scrollContainerRef}
            cardSelector={cardSelector}
            onChipClick={(chipIndex) =>
              trackEvent("hour-strip-click", { chipIndex })
            }
          />

          <div className="flex flex-col flex-1 min-h-0 relative">
          <div
            ref={scrollContainerRef}
            className="schedule-scroll flex flex-row gap-3 pb-1 overflow-x-auto overflow-y-hidden flex-1 min-h-0 snap-x snap-proximity [&::-webkit-scrollbar]:hidden"
            style={{ scrollBehavior: "smooth", scrollbarWidth: "none" }}
          >
            {groupBy === "time"
              ? shifts.map((s, idx) => (
                  <div
                    key={`shift-${s.si}`}
                    data-card-id={`shift-${s.si}`}
                    className="flex-none w-[17rem] snap-start h-full min-h-0 flex flex-col"
                  >
                    <ShiftCard
                      shiftIndex={s.si}
                      startTime={s.from}
                      endTime={s.to}
                      duration={durationLabel}
                      posts={posts}
                      assignments={safeAssignments}
                      users={users}
                      selectedUserId={selectedUserId ?? null}
                      checkedStaffIds={checkedStaffIds}
                      customCellDisplayNames={customCellDisplayNames}
                      isLocked={isLocked}
                      onPostEdit={(postId, newName) => onPostEdit?.(postId, newName)}
                      onCellClick={handleCellClick}
                      autoFocusPostId={idx === 0 ? justAddedPostId ?? null : null}
                    />
                  </div>
                ))
              : posts.map((post, postIndex) => (
                  <div
                    key={post.id}
                    data-card-id={`post-${post.id}`}
                    className="flex-none w-[17rem] snap-start h-full min-h-0 flex flex-col"
                  >
                    <PostCard
                      postIndex={postIndex}
                      post={post}
                      shifts={shifts}
                      assignments={safeAssignments}
                      users={users}
                      selectedUserId={selectedUserId ?? null}
                      checkedStaffIds={checkedStaffIds}
                      customCellDisplayNames={customCellDisplayNames}
                      isLocked={isLocked}
                      onPostEdit={(postId, newName) => onPostEdit?.(postId, newName)}
                      onPostDeleteSingle={(id) => onPostDeleteSingle?.(id)}
                      onCellClick={handleCellClick}
                      autoFocusEdit={justAddedPostId === post.id}
                    />
                  </div>
                ))}
          </div>
            {canScrollStart && (
              <button
                type="button"
                data-testid="schedule-scroll-start"
                aria-label={t("scrollScheduleToStart")}
                onClick={() => scrollByDirection("start")}
                className="absolute top-1/2 -translate-y-1/2 -start-8 z-10 p-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md shadow-sm transition-colors border border-input"
              >
                <IconChevronLeft size={20} strokeWidth={2.5} />
              </button>
            )}
            {canScrollEnd && (
              <button
                type="button"
                data-testid="schedule-scroll-end"
                aria-label={t("scrollScheduleToEnd")}
                onClick={() => scrollByDirection("end")}
                className="absolute top-1/2 -translate-y-1/2 -end-8 z-10 p-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md shadow-sm transition-colors border border-input"
              >
                <IconChevronRight size={20} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
      <AssignWorkerPopover
        anchorEl={resolvedAssignAnchor}
        users={users}
        open={assignPopoverOpen}
        onSelect={handleAssignSelect}
        onClose={closeAssignPopover}
      />
    </div>
  );
}
