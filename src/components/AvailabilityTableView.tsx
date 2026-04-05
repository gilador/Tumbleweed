import { Button } from "@/components/elements/button";
import { colors } from "@/constants/colors";
import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilValue } from "recoil";
import { IconCheck, IconX } from "@tabler/icons-react";
import tumbleweedAnimation from "../../assets/tumbleweed-anim.gif";
import { Constraint, User, UserShiftData } from "../models";
import { UniqueString } from "../models/index";
import { EditButton } from "./EditButton";
import { EditableText } from "./EditableText";
import { ActionableText } from "./VerticalActionGroup";
import { ShiftDuration } from "./ShiftDuration";
import { shiftState, getActiveRosterFromState } from "../stores/shiftStore";
import { DayTabStrip, DayIndicator } from "./DayTabStrip";
import { getRosterColor } from "./RosterSwitcher";
import { AvailabilityCopyBar } from "./AvailabilityCopyBar";
import { getDisplayTime, getDaySlice } from "../service/weeklyScheduleUtils";
import { getTodayISO } from "../service/dayLabelUtils";

export interface AvailabilityTableViewProps {
  user?: User;
  availabilityConstraints?: Constraint[][];
  assignments?: (string | null)[][];
  posts: UniqueString[];
  hours: UniqueString[];
  endTime?: string;
  onConstraintsChange?: (newConstraints: Constraint[][]) => void;
  isEditing?: boolean;
  onPostEdit?: (postId: string, newName: string) => void;
  users?: User[];
  userShiftData?: UserShiftData[];
  mode?: "availability" | "assignments";
  selectedUserId?: string | null;
  className?: string;
  checkedPostIds?: string[];
  onPostCheck?: (postId: string, event?: React.MouseEvent) => void;
  onPostUncheck?: (postId: string) => void;
  onAssignmentEdit?: (
    postIndex: number,
    hourIndex: number,
    newUserName: string
  ) => void;
  customCellDisplayNames?: { [slotKey: string]: string };
  onShowToast?: (message: string, type?: "success" | "error" | "info") => void;
}

const AssignmentCell = ({
  name,
  isShiftEditing,
  onSaveName,
}: {
  name: string;
  isShiftEditing: boolean;
  onSaveName: (newName: string) => void;
  isAssigned: boolean;
}) => {
  const [isEditingLocal, setIsEditingLocal] = useState(false);
  const [optimisticName, setOptimisticName] = useState<string | null>(null);
  const previousNameProp = useRef(name);

  useEffect(() => {
    if (previousNameProp.current !== name) {
      previousNameProp.current = name;
    }
  }, [name]);

  const nameValueForEditableText =
    optimisticName !== null ? optimisticName : name;

  const handleSave = (newName: string) => {
    // Always exit edit mode first
    setIsEditingLocal(false);

    // If the new name is the same as the original name, just reset optimistic state
    if (newName === name) {
      setOptimisticName(null);
      return;
    }

    // If there's no actual change from what's currently displayed, reset optimistic state
    if (newName === nameValueForEditableText) {
      setOptimisticName(null);
      return;
    }

    // Set optimistic name and call the save handler
    setOptimisticName(newName);
    onSaveName(newName);
  };

  const handleCancel = () => {
    // Reset to original state when canceling
    setOptimisticName(null);
    setIsEditingLocal(false);
  };

  return (
    <div className={`flex items-center w-full h-[32px] relative`}>
      <EditableText
        value={nameValueForEditableText}
        onSave={handleSave}
        isEditing={isEditingLocal}
        onEditingChange={(editing) => {
          if (!editing) {
            // If editing is being turned off externally (like via Escape key), handle cancel
            handleCancel();
          }
        }}
        className="w-full truncate"
      >
        {(displayName, editing) => (
          <span
            className={`w-full truncate ${
              editing
                ? "cursor-text"
                : isShiftEditing
                ? "cursor-pointer"
                : "cursor-default"
            }`}
            onClick={
              editing
                ? undefined
                : () => {
                    if (isShiftEditing) {
                      setIsEditingLocal(true);
                    }
                  }
            }
          >
            {displayName}
          </span>
        )}
      </EditableText>
      {isShiftEditing && !isEditingLocal && (
        <EditButton
          isEditing={isEditingLocal}
          onToggle={() => setIsEditingLocal(!isEditingLocal)}
          className="absolute end-0 top-1/2 transform -translate-y-1/2"
        />
      )}
    </div>
  );
};

export function AvailabilityTableView({
  user,
  availabilityConstraints,
  assignments,
  posts,
  hours,
  endTime,
  onConstraintsChange,
  isEditing = false,
  onPostEdit,
  users = [],
  userShiftData = [],
  mode = "availability",
  selectedUserId,
  className = "",
  checkedPostIds = [],
  onPostCheck,
  onPostUncheck,
  onAssignmentEdit,
  customCellDisplayNames = {},
  onShowToast,
}: AvailabilityTableViewProps) {
  const { t } = useTranslation();
  const state = useRecoilValue(shiftState);
  const activeRoster = getActiveRosterFromState(state);
  const scheduleMode = activeRoster.scheduleMode;
  const startDate = activeRoster.startDate;
  const [selectedDay, setSelectedDay] = useState(0);
  const [optimisticLocalConstraints, setOptimisticLocalConstraints] = useState<
    Constraint[][] | null
  >(null);

  const isWeekly = scheduleMode === "7d";

  // Compute which hours/assignments/constraints to show for the selected day
  const daySlice = isWeekly ? getDaySlice(hours.length, selectedDay) : { start: 0, end: hours.length };
  const displayHours = hours.slice(daySlice.start, daySlice.end);

  // For the end time of the last visible hour:
  // In weekly mode, the next hour is the first hour of the next day (or endTime for last day)
  const displayEndTime = isWeekly
    ? (selectedDay < 6
      ? getDisplayTime(hours[daySlice.end]?.value || endTime || "??:??")
      : (endTime || "??:??"))
    : endTime;

  // Use effective constraints (which includes optimistic local state)
  const effectiveAvailabilityConstraints =
    optimisticLocalConstraints || availabilityConstraints;

  // Compute day indicators for availability mode
  const dayIndicators: DayIndicator[] | undefined = isWeekly && mode === "availability" && effectiveAvailabilityConstraints
    ? Array.from({ length: 7 }, (_, dayIdx) => {
        const slice = getDaySlice(hours.length, dayIdx);
        const dayConstraints = effectiveAvailabilityConstraints.flatMap(
          (postCons) => postCons.slice(slice.start, slice.end)
        );
        const allAvail = dayConstraints.every((c) => c?.availability !== false);
        const noneAvail = dayConstraints.every((c) => !c?.availability);
        return allAvail ? "full" as const : noneAvail ? "empty" as const : "partial" as const;
      })
    : undefined;

  // Compute highlighted days for assignments mode (days where selected user has shifts)
  const assignmentHighlightedDays: Set<number> | undefined =
    isWeekly && mode === "assignments" && selectedUserId && assignments
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

  // Copy availability from selected day to target days
  const handleCopyAvailability = (targetDayIndices: number[]) => {
    if (!availabilityConstraints) return;
    const sourceSlice = getDaySlice(hours.length, selectedDay);
    const updatedConstraints = availabilityConstraints.map((postCons) => {
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
    onConstraintsChange?.(updatedConstraints);
  };

  const handlePostNameChange = (postId: string, newName: string) => {
    onPostEdit?.(postId, newName);
  };

  const handleAssignmentNameChange = (
    postIndex: number,
    hourIndex: number,
    newUserName: string
  ) => {
    onAssignmentEdit?.(postIndex, hourIndex, newUserName);
  };

  // Helper function to check if making a user unavailable would create an infeasible slot
  const wouldCreateInfeasibleSlot = (
    postIndex: number,
    hourIndex: number
  ): boolean => {
    if (!userShiftData || !availabilityConstraints) return false;

    // Check if this user is currently available for this slot
    const currentConstraint = availabilityConstraints[postIndex]?.[hourIndex];
    const isCurrentlyAvailable = currentConstraint?.availability ?? true;

    // If they're already unavailable, toggling won't create infeasibility
    if (!isCurrentlyAvailable) return false;

    // Count how many users are currently available for this slot
    const availableUsersCount = userShiftData.filter((userData) => {
      const userConstraints = userData.constraints;
      if (!userConstraints || !userConstraints[postIndex]) return true; // Default to available
      const slotConstraint = userConstraints[postIndex][hourIndex];
      return slotConstraint?.availability ?? true;
    }).length;

    // If only 1 user is available and we're about to make them unavailable, it's infeasible
    if (availableUsersCount <= 1) {
      return availableUsersCount <= 1;
    }

    return false;
  };

  const toggleAvailability = (postIndex: number, hourIndex: number) => {
    if (
      mode !== "availability" ||
      !onConstraintsChange ||
      !availabilityConstraints
    )
      return;

    // Check if this would create an infeasible situation
    if (wouldCreateInfeasibleSlot(postIndex, hourIndex)) {
      alert(
        t("cannotMakeUnavailable")
      );
      return;
    }

    // Base the toggle on the most current view (optimistic or prop)
    // Ensure that we only proceed if actual availabilityConstraints prop is present (meaning data is loaded for a user)
    const baseConstraints =
      optimisticLocalConstraints || availabilityConstraints;
    if (!baseConstraints || !availabilityConstraints) return;

    const currentConstraints = baseConstraints; // currentConstraints is now effectively baseConstraints
    if (postIndex < 0 || postIndex >= currentConstraints.length) return;
    if (hourIndex < 0 || hourIndex >= hours.length) return;

    const newConstraints = currentConstraints.map((postCons, pIndex) => {
      if (pIndex === postIndex) {
        const updatedPostCons = [...postCons];
        while (updatedPostCons.length < hours.length) {
          updatedPostCons.push({
            availability: true,
            postID: posts[pIndex]?.id || "",
            hourID: hours[updatedPostCons.length]?.id || "",
          });
        }
        return updatedPostCons.map((constraint, hIndex) => {
          if (hIndex === hourIndex) {
            return {
              ...constraint,
              availability: !constraint.availability,
            };
          }
          return constraint;
        });
      }
      return postCons;
    });

    setOptimisticLocalConstraints(newConstraints); // Optimistically update UI
    onConstraintsChange(newConstraints); // Notify parent
  };

  const togglePostRowAvailability = (postIndex: number) => {
    if (
      mode !== "availability" ||
      !onConstraintsChange ||
      !availabilityConstraints
    )
      return;

    const baseConstraints =
      optimisticLocalConstraints || availabilityConstraints;
    if (!baseConstraints || !availabilityConstraints) return;

    if (postIndex < 0 || postIndex >= baseConstraints.length) return;

    // Check if all slots in this post row are currently available
    const postConstraints = baseConstraints[postIndex] || [];
    const allAvailable = postConstraints.every(
      (constraint) => constraint.availability !== false
    );

    const newConstraints = baseConstraints.map((postCons, pIndex) => {
      if (pIndex === postIndex) {
        const updatedPostCons = [...postCons];
        while (updatedPostCons.length < hours.length) {
          updatedPostCons.push({
            availability: true,
            postID: posts[pIndex]?.id || "",
            hourID: hours[updatedPostCons.length]?.id || "",
          });
        }
        // Toggle: if all are available, make all unavailable; otherwise make all available
        return updatedPostCons.map((constraint) => ({
          ...constraint,
          availability: !allAvailable,
        }));
      }
      return postCons;
    });

    setOptimisticLocalConstraints(newConstraints);
    onConstraintsChange(newConstraints);
  };

  const toggleHourColumnAvailability = (hourIndex: number) => {
    if (
      mode !== "availability" ||
      !onConstraintsChange ||
      !availabilityConstraints
    )
      return;

    const baseConstraints =
      optimisticLocalConstraints || availabilityConstraints;
    if (!baseConstraints || !availabilityConstraints) return;

    if (hourIndex < 0 || hourIndex >= hours.length) return;

    // Check if all slots in this hour column are currently available
    const allAvailable = baseConstraints.every((postCons) => {
      const constraint = postCons[hourIndex];
      return constraint?.availability !== false;
    });

    const newConstraints = baseConstraints.map((postCons) => {
      const updatedPostCons = [...postCons];
      while (updatedPostCons.length < hours.length) {
        const pIndex = baseConstraints.indexOf(postCons);
        updatedPostCons.push({
          availability: true,
          postID: posts[pIndex]?.id || "",
          hourID: hours[updatedPostCons.length]?.id || "",
        });
      }
      // Toggle the specific hour in this post
      return updatedPostCons.map((constraint, hIndex) => {
        if (hIndex === hourIndex) {
          return {
            ...constraint,
            availability: !allAvailable,
          };
        }
        return constraint;
      });
    });

    setOptimisticLocalConstraints(newConstraints);
    onConstraintsChange(newConstraints);
  };

  const handleReset = () => {
    if (
      mode !== "availability" ||
      !onConstraintsChange ||
      !availabilityConstraints
    )
      return;

    const baseConstraints =
      optimisticLocalConstraints || availabilityConstraints;
    if (!baseConstraints) return;

    const newConstraints = baseConstraints.map((postCons) =>
      postCons.map((constraint) => ({
        ...constraint,
        availability: true,
      }))
    );

    setOptimisticLocalConstraints(newConstraints);
    onConstraintsChange(newConstraints);
    onShowToast?.(t("availabilityResetToAllAvailable"), "success");
    onShowToast?.(t("availabilityResetToAllAvailable"), "success");
  };

  const handleSetAllUnavailable = () => {
    if (
      mode !== "availability" ||
      !onConstraintsChange ||
      !availabilityConstraints
    )
      return;

    const baseConstraints =
      optimisticLocalConstraints || availabilityConstraints;
    if (!baseConstraints) return;

    const newConstraints = baseConstraints.map((postCons) =>
      postCons.map((constraint) => ({
        ...constraint,
        availability: false,
      }))
    );

    setOptimisticLocalConstraints(newConstraints);
    onConstraintsChange(newConstraints);
    onShowToast?.(t("availabilitySetToAllUnavailable"), "success");
  };

  // Reset optimistic state when props change
  useEffect(() => {
    setOptimisticLocalConstraints(null);
  }, [availabilityConstraints, user?.id]);

  // Determine if we should show border - only for availability mode
  const shouldShowBorder = mode === "availability";

  return (
    <div
      className={`w-full h-full flex flex-col ${
        shouldShowBorder ? "border-primary-rounded-lg" : ""
      } overflow-hidden ${className}`}
    >
      {mode === "availability" && (
        <div className="h-10 flex items-center justify-between px-2 flex-none">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {/* Show user name if user and availabilityConstraints are present, else show generic or nothing */}
            {user && availabilityConstraints
              ? t("userAvailability", { name: user.name })
              : availabilityConstraints
              ? t("availability")
              : "\b"}
            {state.rosters.length > 1 && activeRoster.name && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getRosterColor(state.rosters.findIndex((r) => r.id === state.activeRosterId)) }}
                />
                {activeRoster.name}
              </span>
            )}
          </h3>
          {availabilityConstraints && (
            <div className="flex gap-2">
              <Button
                onClick={handleReset}
                variant="outline"
                className="bg-background border-border text-foreground hover:bg-accent rounded-lg h-8 text-xs px-3"
              >
                {t("allAvailable")}
              </Button>
              <Button
                onClick={handleSetAllUnavailable}
                variant="outline"
                className="bg-background border-border text-foreground hover:bg-accent rounded-lg h-8 text-xs px-3"
              >
                {t("unavailable")}
              </Button>
            </div>
          )}
        </div>
      )}
      {/* Show empty state with GIF only if mode is availability AND no availabilityConstraints are passed (i.e., no user selected) */}
      {mode === "availability" && !availabilityConstraints ? (
        <div className="h-full flex-1 justify-center flex flex-col items-center">
          <div className="font-semibold text-center self-center ">
            {t("emptyStateTitle")}
          </div>
          <img
            src={tumbleweedAnimation}
            alt="Tumbleweed"
            className="h-12 mb-2 m-2 rounded-[10px] dark-invert"
          />
          <div className="font-semibold text-center self-center ">
            {t("pickStaffMember")}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Normal availability table - modify with CSS for edit mode */}
          {mode === "availability" && (
            <div className="p-2 relative">
              {isWeekly && (
                <div className="mb-2 space-y-2">
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
              <div
                className="grid gap-1 w-full grid-cols-[max-content_repeat(var(--hours),1fr)]"
                style={{ "--hours": displayHours.length } as React.CSSProperties}
              >
                {/* Header Row */}
                <div className="py-2 ps-3 pe-2 flex justify-start items-center">
                  <div className={colors.text.default}>{t("post")}</div>
                </div>
                {displayHours.map((hour, localIndex) => {
                  const flatIndex = daySlice.start + localIndex;
                  // Check if all slots in this hour column are currently available
                  const columnConstraints = effectiveAvailabilityConstraints?.map(
                    (postCons) => postCons[flatIndex]
                  ) || [];
                  const allAvailable = columnConstraints.every(
                    (constraint) => constraint?.availability !== false
                  );

                  return (
                    <div
                      key={hour.id}
                      className={`font-semibold p-2 text-center relative group ${colors.text.default}`}
                    >
                      {isWeekly ? getDisplayTime(hour.value) : hour.value}
                      {/* Hover button to toggle entire hour column availability */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleHourColumnAvailability(flatIndex);
                        }}
                        className={`absolute end-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border-2 ${
                          allAvailable
                            ? 'bg-foreground border-background hover:bg-foreground/80'
                            : 'bg-background border-foreground hover:bg-accent'
                        }`}
                        title={t("toggleHourColumnAvailability")}
                      >
                        {allAvailable ? (
                          <IconX
                            className="w-3 h-3 text-background"
                            stroke={3}
                          />
                        ) : (
                          <IconCheck
                            className="w-3 h-3 text-foreground"
                            stroke={3}
                          />
                        )}
                      </button>
                    </div>
                  );
                })}

                {/* Data Rows */}
                {posts.map((post, postIndex) => {
                  // Check if all slots in this post row (for selected day) are currently available
                  const postConstraints = effectiveAvailabilityConstraints?.[postIndex] || [];
                  const dayPostConstraints = postConstraints.slice(daySlice.start, daySlice.end);
                  const allAvailable = dayPostConstraints.every(
                    (constraint) => constraint.availability !== false
                  );

                  return (
                    <React.Fragment key={post.id}>
                      <div className="py-2 px-1 pe-2 flex items-center justify-start relative group overflow-hidden max-w-[10rem]">
                        <span className="truncate px-1 font-medium text-start">{post.value}</span>
                        {/* Hover button to toggle entire post row availability */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePostRowAvailability(postIndex);
                          }}
                          className={`absolute end-4 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border-2 ${
                            allAvailable
                              ? 'bg-foreground border-background hover:bg-foreground/80'
                              : 'bg-background border-foreground hover:bg-accent'
                          }`}
                          title={t("togglePostAvailability")}
                        >
                          {allAvailable ? (
                            <IconX
                              className="w-4 h-4 text-background"
                              stroke={3}
                            />
                          ) : (
                            <IconCheck
                              className="w-4 h-4 text-foreground"
                              stroke={3}
                            />
                          )}
                        </button>
                      </div>
                    {displayHours.map((hour, localIndex) => {
                      if (!effectiveAvailabilityConstraints) return null;
                      const flatIndex = daySlice.start + localIndex;
                      const currentCellConstraint =
                        effectiveAvailabilityConstraints[postIndex]?.[
                          flatIndex
                        ];
                      const isAvailable =
                        currentCellConstraint?.availability ?? true;
                      return (
                        <div
                          key={`${post.id}-${hour.id}`}
                          className={`p-2 cursor-pointer flex items-center justify-center ${
                            isAvailable
                              ? `${colors.available.default} ${colors.available.hover}`
                              : `${colors.unavailable.default} ${colors.unavailable.hover}`
                          } rounded-md transition-opacity duration-200`}
                          style={{
                            opacity: isEditing ? 0.2 : 1,
                            pointerEvents: isEditing ? "none" : "auto",
                          }}
                          onClick={() =>
                            toggleAvailability(postIndex, flatIndex)
                          }
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {isAvailable ? (
                              <div className="w-4 h-4 bg-foreground rounded-full flex items-center justify-center">
                                <IconCheck className="w-3 h-3 text-background" stroke={3} />
                              </div>
                            ) : (
                              <div className="w-4 h-4 bg-background rounded-full flex items-center justify-center">
                                <IconX className="w-3 h-3 text-foreground" stroke={3} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
          {/* Show assignment table - always present in DOM */}
          {mode === "assignments" && (
            <div className="py-2 pe-2 ps-6 relative">
              {isWeekly && (
                <div className="mb-2">
                  <DayTabStrip
                    startDate={startDate || getTodayISO()}
                    selectedDay={selectedDay}
                    onDayChange={setSelectedDay}
                    highlightedDays={assignmentHighlightedDays}
                  />
                </div>
              )}
              <div
                className="grid gap-1 w-full grid-cols-[max-content_repeat(var(--hours),1fr)]"
                style={{ "--hours": displayHours.length } as React.CSSProperties}
              >
                {/* Header Row */}
                <div className="py-2 ps-3 pe-2 flex justify-start items-center">
                  <div className={colors.text.default}>{t("post")}</div>
                </div>
                {displayHours.map((hour, localIndex) => {
                  const startTimeStr = isWeekly ? getDisplayTime(hour.value) : hour.value;
                  const nextHour = displayHours[localIndex + 1];
                  const hourEndTime = nextHour
                    ? (isWeekly ? getDisplayTime(nextHour.value) : nextHour.value)
                    : (displayEndTime || "??:??");
                  return (
                    <div
                      key={hour.id}
                      className={`font-semibold py-2 px-3 text-center min-w-[7rem] flex justify-center items-center ${colors.text.default}`}
                    >
                      <ShiftDuration
                        startTime={startTimeStr}
                        endTime={hourEndTime}
                      />
                    </div>
                  );
                })}

                {/* Data Rows */}
                {posts.map((post, postIndex) => (
                  <React.Fragment key={post.id}>
                    <div className="py-2 px-2 flex items-center max-w-[10rem]">
                      <ActionableText
                        id={post.id}
                        value={post.value}
                        isEditing={isEditing}
                        isChecked={checkedPostIds.includes(post.id)}
                        onCheck={(e) => onPostCheck?.(post.id, e)}
                        onUncheck={() => onPostUncheck?.(post.id)}
                        onUpdate={(id, newValue) =>
                          handlePostNameChange(id, newValue)
                        }
                        className="text-start"
                      />
                    </div>
                    {displayHours.map((hour, localIndex) => {
                      if (!assignments) return null;
                      const flatIndex = daySlice.start + localIndex;
                      const slotKey = `${postIndex}-${flatIndex}`;
                      const customDisplayName = customCellDisplayNames[slotKey];
                      const officialAssignedUserId =
                        assignments[postIndex]?.[flatIndex] || null;
                      const assignedWorker = officialAssignedUserId
                        ? users.find((u) => u.id === officialAssignedUserId)
                        : null;
                      let finalDisplayNameForCell = "-";
                      if (customDisplayName !== undefined) {
                        finalDisplayNameForCell = customDisplayName;
                      } else if (assignedWorker) {
                        finalDisplayNameForCell = assignedWorker.name;
                      }
                      const isCellSelected =
                        selectedUserId === officialAssignedUserId &&
                        officialAssignedUserId !== null;
                      return (
                        <div
                          key={`${post.id}-${hour.id}`}
                          className={`p-2 text-center rounded-md flex items-center justify-center ${
                            isCellSelected ? colors.cell.selected : colors.cell.dim
                          }`}
                        >
                          <AssignmentCell
                            name={finalDisplayNameForCell}
                            isAssigned={officialAssignedUserId !== null}
                            isShiftEditing={isEditing}
                            onSaveName={(newName) =>
                              handleAssignmentNameChange(
                                postIndex,
                                flatIndex,
                                newName
                              )
                            }
                          />
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
