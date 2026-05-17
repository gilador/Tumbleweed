import { Button } from "@/components/elements/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/elements/dialog";
import { colors } from "@/constants/colors";
import { trackEvent } from "@/lib/analytics";
import tumbleweedIcon from "../../assets/tumbleweed.svg";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilValue } from "recoil";
import { IconCheck, IconX } from "@tabler/icons-react";
import { Constraint, UserShiftData } from "../models";
import { UniqueString } from "../models/index";
import { shiftState, getActiveRosterFromState } from "../stores/shiftStore";
import { useMultiSelectValue, selectedStaffIdState } from "../stores/selectionStore";
import { getActiveStaffIds } from "./availabilityHeatmapHelpers";
import { DayTabStrip, DayIndicator } from "./DayTabStrip";
import { getRosterColor } from "./RosterSwitcher";
import { AvailabilityCopyBar } from "./AvailabilityCopyBar";
import { getDisplayTime, getDaySlice } from "../service/weeklyScheduleUtils";
import { getTodayISO } from "../service/dayLabelUtils";

interface AvailabilityHeatmapProps {
  posts: UniqueString[];
  hours: UniqueString[];
  endTime?: string; // currently unused; reserved for future hour-end label rendering
  userShiftData: UserShiftData[];
  onConstraintsChange: (userId: string, newConstraints: Constraint[][]) => void;
  onShowToast?: (message: string, type?: "success" | "error" | "info") => void;
  onResetAvailability?: (userIds: string[]) => void;
  className?: string;
}

export function AvailabilityHeatmap({
  posts,
  hours,
  userShiftData,
  onConstraintsChange,
  onShowToast,
  onResetAvailability,
  className = "",
}: AvailabilityHeatmapProps) {
  const { t } = useTranslation();
  const state = useRecoilValue(shiftState);
  const activeRoster = getActiveRosterFromState(state);
  const scheduleMode = activeRoster.scheduleMode;
  const startDate = activeRoster.startDate;
  const isWeekly = scheduleMode === "7d";
  const { multiSelected, multiSelectKind } = useMultiSelectValue();
  const selectedStaffId = useRecoilValue(selectedStaffIdState);
  const [selectedDay, setSelectedDay] = useState(0);
  const [view, setView] = useState<"heatmap" | "actions">("heatmap");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const activeStaffIds = getActiveStaffIds(
    multiSelected,
    multiSelectKind,
    selectedStaffId
  );

  const totalStaff = userShiftData.length;
  const activeCount = activeStaffIds.length;

  const activeStaffKey = activeStaffIds.join(",");
  useEffect(() => {
    setView("heatmap");
  }, [activeStaffKey]);

  // Build per-active-user constraint arrays (effective view)
  const perUserConstraints = useMemo(() => {
    const map: Record<string, Constraint[][]> = {};
    for (const id of activeStaffIds) {
      const data = userShiftData.find((u) => u.user.id === id);
      const cons =
        data?.constraintsByRoster?.[activeRoster.id] ||
        data?.constraints ||
        [];
      map[id] = cons;
    }
    return map;
  }, [activeStaffIds, userShiftData, activeRoster.id]);

  const daySlice = isWeekly
    ? getDaySlice(hours.length, selectedDay)
    : { start: 0, end: hours.length };
  const displayHours = hours.slice(daySlice.start, daySlice.end);

  const dayIndicators: DayIndicator[] | undefined = isWeekly && activeCount > 0
    ? Array.from({ length: 7 }, (_, dayIdx) => {
        const slice = getDaySlice(hours.length, dayIdx);
        let allFull = true;
        let allEmpty = true;
        for (let p = 0; p < posts.length; p++) {
          for (let h = slice.start; h < slice.end; h++) {
            // count availables across active staff
            let avail = 0;
            for (const id of activeStaffIds) {
              const c = perUserConstraints[id]?.[p]?.[h];
              if (c?.availability !== false) avail++;
            }
            if (avail < activeCount) allFull = false;
            if (avail > 0) allEmpty = false;
          }
        }
        return allFull ? ("full" as const) : allEmpty ? ("empty" as const) : ("partial" as const);
      })
    : undefined;

  // helper: ensure a constraint exists for [postIndex][hourIndex] in a constraints array
  const ensureCellConstraint = (
    cons: Constraint[][],
    postIndex: number,
    hourIndex: number
  ): Constraint => {
    const row = cons[postIndex] || [];
    const cell = row[hourIndex];
    if (cell) return cell;
    return {
      availability: true,
      postID: posts[postIndex]?.id || "",
      hourID: hours[hourIndex]?.id || "",
    };
  };

  const writeForEachActive = (
    transform: (cons: Constraint[][]) => Constraint[][]
  ) => {
    for (const id of activeStaffIds) {
      const cons = perUserConstraints[id] || [];
      onConstraintsChange(id, transform(cons));
    }
  };

  const padToHours = (cons: Constraint[][]): Constraint[][] => {
    return cons.map((postCons, pIdx) => {
      const updated = [...postCons];
      while (updated.length < hours.length) {
        updated.push({
          availability: true,
          postID: posts[pIdx]?.id || "",
          hourID: hours[updated.length]?.id || "",
        });
      }
      return updated;
    });
  };

  const toggleAvailabilityCell = (postIndex: number, hourIndex: number) => {
    if (activeCount === 0) return;
    if (postIndex < 0 || postIndex >= posts.length) return;
    if (hourIndex < 0 || hourIndex >= hours.length) return;

    // Count current availables to compute target state
    let currentAvail = 0;
    for (const id of activeStaffIds) {
      const c = perUserConstraints[id]?.[postIndex]?.[hourIndex];
      if (c?.availability !== false) currentAvail++;
    }
    // If all available, set all unavailable; otherwise, set all available
    const targetAvailability = currentAvail < activeCount;

    writeForEachActive((cons) => {
      const padded = padToHours(cons);
      return padded.map((postCons, pIdx) => {
        if (pIdx !== postIndex) return postCons;
        return postCons.map((c, hIdx) => {
          if (hIdx !== hourIndex) return c;
          return { ...ensureCellConstraint(cons, pIdx, hIdx), availability: targetAvailability };
        });
      });
    });
  };

  const togglePostRowAvailability = (postIndex: number) => {
    if (activeCount === 0) return;
    let allFull = true;
    for (let h = daySlice.start; h < daySlice.end; h++) {
      for (const id of activeStaffIds) {
        const c = perUserConstraints[id]?.[postIndex]?.[h];
        if (c?.availability === false) {
          allFull = false;
          break;
        }
      }
      if (!allFull) break;
    }
    const target = !allFull;
    writeForEachActive((cons) => {
      const padded = padToHours(cons);
      return padded.map((postCons, pIdx) => {
        if (pIdx !== postIndex) return postCons;
        return postCons.map((c, hIdx) => {
          if (hIdx < daySlice.start || hIdx >= daySlice.end) return c;
          return { ...c, availability: target };
        });
      });
    });
  };

  const toggleHourColumnAvailability = (hourIndex: number) => {
    if (activeCount === 0) return;
    let allFull = true;
    for (let p = 0; p < posts.length; p++) {
      for (const id of activeStaffIds) {
        const c = perUserConstraints[id]?.[p]?.[hourIndex];
        if (c?.availability === false) {
          allFull = false;
          break;
        }
      }
      if (!allFull) break;
    }
    const target = !allFull;
    writeForEachActive((cons) => {
      const padded = padToHours(cons);
      return padded.map((postCons) =>
        postCons.map((c, hIdx) => {
          if (hIdx !== hourIndex) return c;
          return { ...c, availability: target };
        })
      );
    });
  };

  const handleSetAllAvailable = (available: boolean) => {
    if (activeCount === 0) return;
    writeForEachActive((cons) => {
      const padded = padToHours(cons);
      return padded.map((postCons) =>
        postCons.map((c) => ({ ...c, availability: available }))
      );
    });
    onShowToast?.(
      available
        ? t("availabilityResetToAllAvailable")
        : t("availabilitySetToAllUnavailable"),
      "success"
    );
  };

  const handleSetDaysOnly = (availableDays: number[]) => {
    if (!isWeekly || activeCount === 0) return;
    const daySlices = Array.from({ length: 7 }, (_, dayIdx) =>
      getDaySlice(hours.length, dayIdx)
    );
    const dayForHour = (hIdx: number): number => {
      for (let d = 0; d < daySlices.length; d++) {
        if (hIdx >= daySlices[d].start && hIdx < daySlices[d].end) return d;
      }
      return -1;
    };
    writeForEachActive((cons) => {
      const padded = padToHours(cons);
      return padded.map((postCons) =>
        postCons.map((c, hIdx) => {
          const dayIdx = dayForHour(hIdx);
          return { ...c, availability: availableDays.includes(dayIdx) };
        })
      );
    });
    onShowToast?.(t("availabilityUpdated"), "success");
  };

  const handleSetWeekdaysOnly = () => handleSetDaysOnly([0, 1, 2, 3, 4]);
  const handleSetWeekendsOnly = () => handleSetDaysOnly([5, 6]);

  const toggleDayAvailability = (dayIndex: number, setAvailable: boolean) => {
    if (activeCount === 0) return;
    const slice = getDaySlice(hours.length, dayIndex);
    writeForEachActive((cons) => {
      const padded = padToHours(cons);
      return padded.map((postCons) =>
        postCons.map((c, hIdx) => {
          if (hIdx < slice.start || hIdx >= slice.end) return c;
          return { ...c, availability: setAvailable };
        })
      );
    });
  };

  const handleCopyAvailability = (targetDayIndices: number[]) => {
    if (activeCount === 0) return;
    const sourceSlice = getDaySlice(hours.length, selectedDay);
    writeForEachActive((cons) => {
      const padded = padToHours(cons);
      return padded.map((postCons) => {
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
    });
  };

  // Empty state
  if (activeCount === 0) {
    return (
      <div
        data-testid="availability-heatmap"
        className={`w-full flex-1 min-h-0 flex flex-col border border-border rounded-lg p-4 overflow-hidden ${className}`}
      >
        <div className="flex items-baseline gap-3 flex-none">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {t("availability")}
            {state.rosters.length > 1 && activeRoster.name && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: getRosterColor(
                      state.rosters.findIndex((r) => r.id === state.activeRosterId)
                    ),
                  }}
                />
                {activeRoster.name}
              </span>
            )}
          </h3>
          <span className="text-sm text-muted-foreground">{t("pickTeammate")}</span>
        </div>
        <div className="h-full flex-1 flex flex-col items-center justify-center gap-2">
          <img
            src={tumbleweedIcon}
            alt=""
            className="h-8 w-8 opacity-55"
          />
          <h4 className="font-semibold text-base">{t("pickTeammate")}</h4>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            {t("pickTeammateDescription")}
          </p>
        </div>
      </div>
    );
  }

  const isSingle = activeCount === 1;
  const singleStaff = isSingle
    ? userShiftData.find((u) => u.user.id === activeStaffIds[0])?.user
    : null;

  return (
    <div
      data-testid="availability-heatmap"
      className={`w-full flex-1 min-h-0 flex flex-col border border-border rounded-lg p-4 overflow-hidden ${className}`}
    >
      <div className="h-10 flex items-center justify-between px-2 flex-none">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {isSingle && singleStaff
            ? t("userAvailability", { name: singleStaff.name })
            : t("availabilityCountHeader", {
                count: activeCount,
                total: totalStaff,
              })}
          {state.rosters.length > 1 && activeRoster.name && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded inline-flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: getRosterColor(
                    state.rosters.findIndex((r) => r.id === state.activeRosterId)
                  ),
                }}
              />
              {activeRoster.name}
            </span>
          )}
          {!isSingle && (
            <span className="text-xs font-semibold bg-primary-soft text-primary px-2 py-0.5 rounded-full tabular-nums">
              {activeCount} / {totalStaff}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setView("heatmap")}
              className={`h-7 text-xs px-3 rounded-md transition-colors ${
                view === "heatmap"
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {t("heatmapToggle")}
            </button>
            <button
              type="button"
              onClick={() => setView("actions")}
              className={`h-7 text-xs px-3 rounded-md transition-colors ${
                view === "actions"
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {t("actionsToggle")}
            </button>
          </div>
        </div>
      </div>

      {view === "actions" ? (
        <div className="flex-1 overflow-auto p-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                handleSetAllAvailable(true);
                setView("heatmap");
              }}
              variant="outline"
              className="bg-background border-border text-foreground hover:bg-accent rounded-lg h-12 text-sm"
            >
              {t("allAvailable")}
            </Button>
            <Button
              onClick={() => {
                handleSetAllAvailable(false);
                setView("heatmap");
              }}
              variant="outline"
              className="bg-background border-border text-foreground hover:bg-accent rounded-lg h-12 text-sm"
            >
              {t("allUnavailable")}
            </Button>
            {isWeekly && (
              <>
                <Button
                  onClick={() => {
                    handleSetWeekdaysOnly();
                    setView("heatmap");
                  }}
                  variant="outline"
                  className="bg-background border-border text-foreground hover:bg-accent rounded-lg h-12 text-sm"
                >
                  {t("weekdaysOnly")}
                </Button>
                <Button
                  onClick={() => {
                    handleSetWeekendsOnly();
                    setView("heatmap");
                  }}
                  variant="outline"
                  className="bg-background border-border text-foreground hover:bg-accent rounded-lg h-12 text-sm"
                >
                  {t("weekendsOnly")}
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
      <div className="flex-1 min-w-0 overflow-x-auto overflow-y-auto">
        <div className="p-2 relative w-max min-w-full">
          <div
            className="grid gap-1 grid-cols-[max-content_repeat(var(--hours),minmax(var(--hour-min),1fr))]"
            style={{
              "--hours": displayHours.length,
              "--hour-min": "3.5rem",
            } as React.CSSProperties}
          >
            {isWeekly && (
              <>
                <div />
                <div className="mb-1 space-y-2" style={{ gridColumn: "2 / -1" }}>
                  <DayTabStrip
                    startDate={startDate || getTodayISO()}
                    selectedDay={selectedDay}
                    onDayChange={setSelectedDay}
                    dayIndicators={dayIndicators}
                  />
                  <div className="flex items-center gap-2">
                    <AvailabilityCopyBar
                      startDate={startDate || getTodayISO()}
                      sourceDayIndex={selectedDay}
                      onCopy={handleCopyAvailability}
                    />
                    <div className="flex gap-1">
                      <Button
                        onClick={() => toggleDayAvailability(selectedDay, true)}
                        variant="outline"
                        className="h-7 text-[11px] px-2 rounded-md bg-background border-border hover:bg-accent"
                      >
                        {t("allDayAvailable")}
                      </Button>
                      <Button
                        onClick={() => toggleDayAvailability(selectedDay, false)}
                        variant="outline"
                        className="h-7 text-[11px] px-2 rounded-md bg-background border-border hover:bg-accent"
                      >
                        {t("allDayUnavailable")}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
            {/* Header row */}
            <div className="py-2 ps-3 pe-2 flex justify-start items-center">
              <div className={colors.text.default}>{t("post")}</div>
            </div>
            {displayHours.map((hour, localIndex) => {
              const flatIndex = daySlice.start + localIndex;
              let allFull = true;
              for (let p = 0; p < posts.length; p++) {
                for (const id of activeStaffIds) {
                  const c = perUserConstraints[id]?.[p]?.[flatIndex];
                  if (c?.availability === false) {
                    allFull = false;
                    break;
                  }
                }
                if (!allFull) break;
              }
              return (
                <div
                  key={hour.id}
                  className={`font-semibold p-2 text-center relative group ${colors.text.default}`}
                >
                  <span dir="ltr">{isWeekly ? getDisplayTime(hour.value) : hour.value}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHourColumnAvailability(flatIndex);
                    }}
                    className={`absolute end-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border-2 ${
                      allFull
                        ? "bg-foreground border-background hover:bg-foreground/80"
                        : "bg-background border-border hover:bg-accent"
                    }`}
                    title={t("toggleHourColumnAvailability")}
                  >
                    {allFull ? (
                      <IconX className="w-3 h-3 text-background" stroke={3} />
                    ) : (
                      <IconCheck className="w-3 h-3 text-foreground" stroke={3} />
                    )}
                  </button>
                </div>
              );
            })}

            {/* Data rows */}
            {posts.map((post, postIndex) => {
              let postAllFull = true;
              for (let h = daySlice.start; h < daySlice.end; h++) {
                for (const id of activeStaffIds) {
                  const c = perUserConstraints[id]?.[postIndex]?.[h];
                  if (c?.availability === false) {
                    postAllFull = false;
                    break;
                  }
                }
                if (!postAllFull) break;
              }
              return (
                <React.Fragment key={post.id}>
                  <div className="py-2 px-1 pe-2 flex items-center justify-start relative group overflow-hidden max-w-[10rem]">
                    <span className="truncate px-1 font-medium text-start">
                      {post.value}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePostRowAvailability(postIndex);
                      }}
                      className={`absolute end-4 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border-2 ${
                        postAllFull
                          ? "bg-foreground border-background hover:bg-foreground/80"
                          : "bg-background border-border hover:bg-accent"
                      }`}
                      title={t("togglePostAvailability")}
                    >
                      {postAllFull ? (
                        <IconX className="w-4 h-4 text-background" stroke={3} />
                      ) : (
                        <IconCheck className="w-4 h-4 text-foreground" stroke={3} />
                      )}
                    </button>
                  </div>
                  {displayHours.map((hour, localIndex) => {
                    const flatIndex = daySlice.start + localIndex;
                    let nAvail = 0;
                    for (const id of activeStaffIds) {
                      const c = perUserConstraints[id]?.[postIndex]?.[flatIndex];
                      if (c?.availability !== false) nAvail++;
                    }
                    const allAvail = nAvail === activeCount;
                    return (
                      <div
                        key={`${post.id}-${hour.id}`}
                        className={`p-2 min-h-9 cursor-pointer flex items-center justify-center rounded-md transition-opacity duration-200 ${
                          allAvail
                            ? `${colors.available.default} ${colors.available.hover}`
                            : nAvail === 0
                            ? `${colors.unavailable.default} ${colors.unavailable.hover}`
                            : "bg-primary-soft text-primary border border-primary"
                        }`}
                        onClick={() => toggleAvailabilityCell(postIndex, flatIndex)}
                      >
                        {isSingle ? (
                          allAvail ? (
                            <IconCheck className="w-4 h-4 text-background" stroke={3} />
                          ) : (
                            <IconX className="w-4 h-4 text-destructive" stroke={3} />
                          )
                        ) : (
                          <span className="text-xs font-semibold tabular-nums" dir="ltr">
                            {nAvail}/{activeCount}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
          {!isSingle && (
            <div className="flex flex-wrap items-center gap-3 px-1 pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className={`inline-block w-3 h-3 rounded ${colors.available.default}`} />
                {t("legendFull")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-primary-soft border border-primary" />
                {t("legendPartial")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={`inline-block w-3 h-3 rounded ${colors.unavailable.default}`} />
                {t("legendEmpty")}
              </span>
            </div>
          )}
        </div>
      </div>
      )}
      {onResetAvailability && (
        <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("resetAllAvailabilityTitle")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <p>{t("resetAllAvailabilityDescription")}</p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsResetDialogOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    onResetAvailability(activeStaffIds);
                    trackEvent("reset-availability", { userCount: activeStaffIds.length });
                    setIsResetDialogOpen(false);
                  }}
                >
                  {t("resetAllAvailabilityTitle")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
