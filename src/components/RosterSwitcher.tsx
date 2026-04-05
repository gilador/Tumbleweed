import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilState } from "recoil";
import { IconPlus, IconTrash, IconPencil, IconCheck, IconX, IconChevronDown } from "@tabler/icons-react";
import { shiftState, getActiveRosterFromState } from "../stores/shiftStore";
import { createEmptyRoster, MAX_ROSTERS, RosterState } from "../models";
import { defaultHours } from "../constants/shiftManagerConstants";
import { getDefaultConstraints } from "../service/shiftManagerUtils";

const ROSTER_COLORS = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
];

export function getRosterColor(index: number): string {
  return ROSTER_COLORS[index % ROSTER_COLORS.length];
}

function RosterDot({ index }: { index: number }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: getRosterColor(index) }}
    />
  );
}

export function RosterSwitcher() {
  const { t } = useTranslation();
  const [state, setState] = useRecoilState(shiftState);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeRoster = getActiveRosterFromState(state);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setEditingId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const switchRoster = (rosterId: string) => {
    if (rosterId === state.activeRosterId) return;

    setState((prev) => {
      const targetRoster = prev.rosters.find((r) => r.id === rosterId);
      if (!targetRoster) return prev;

      // Save current constraints to constraintsByRoster, load target roster's constraints
      const updatedUsers = prev.userShiftData.map((u) => {
        const savedConstraints = {
          ...u.constraintsByRoster,
          [prev.activeRosterId]: u.constraints,
        };
        const targetConstraints = savedConstraints[rosterId] ||
          getDefaultConstraints(targetRoster.posts || [], targetRoster.hours || defaultHours);
        return {
          ...u,
          constraints: targetConstraints,
          constraintsByRoster: savedConstraints,
        };
      });

      return {
        ...prev,
        activeRosterId: rosterId,
        userShiftData: updatedUsers,
      };
    });

    setIsOpen(false);
  };

  const addRoster = () => {
    if (state.rosters.length >= MAX_ROSTERS) return;

    const newRoster = createEmptyRoster(
      `${t("roster")} ${state.rosters.length + 1}`
    );

    // Copy structure from the active roster
    const source = activeRoster;
    const seededRoster: RosterState = {
      ...newRoster,
      posts: [...source.posts],
      hours: [...source.hours],
      assignments: source.posts.map(() => source.hours.map(() => null)),
      scheduleMode: source.scheduleMode,
      startTime: source.startTime,
      endTime: source.endTime,
      startDate: source.startDate,
    };

    setState((prev) => {
      // Create default constraints for new roster for all users
      const updatedUsers = prev.userShiftData.map((u) => ({
        ...u,
        constraintsByRoster: {
          ...u.constraintsByRoster,
          [prev.activeRosterId]: u.constraints,
          [seededRoster.id]: getDefaultConstraints(
            seededRoster.posts,
            seededRoster.hours || defaultHours
          ),
        },
      }));

      return {
        ...prev,
        rosters: [...prev.rosters, seededRoster],
        userShiftData: updatedUsers,
      };
    });
  };

  const removeRoster = (rosterId: string) => {
    if (state.rosters.length <= 1) return; // Can't remove the last roster

    setState((prev) => {
      const newRosters = prev.rosters.filter((r) => r.id !== rosterId);
      const newActiveId =
        prev.activeRosterId === rosterId ? newRosters[0].id : prev.activeRosterId;

      // Clean up constraintsByRoster
      const updatedUsers = prev.userShiftData.map((u) => {
        const newCBR = { ...u.constraintsByRoster };
        delete newCBR[rosterId];

        // If we're switching active roster, load those constraints
        const newConstraints =
          prev.activeRosterId === rosterId
            ? newCBR[newActiveId] || u.constraints
            : u.constraints;

        return {
          ...u,
          constraints: newConstraints,
          constraintsByRoster: newCBR,
        };
      });

      return {
        ...prev,
        rosters: newRosters,
        activeRosterId: newActiveId,
        userShiftData: updatedUsers,
      };
    });
  };

  const renameRoster = (rosterId: string, newName: string) => {
    setState((prev) => ({
      ...prev,
      rosters: prev.rosters.map((r) =>
        r.id === rosterId ? { ...r, name: newName } : r
      ),
    }));
    setEditingId(null);
  };

  const activeRosterIndex = state.rosters.findIndex((r) => r.id === state.activeRosterId);
  const displayName = activeRoster.name || t("roster");

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-sm bg-muted hover:bg-accent px-3 py-1 rounded-md transition-colors"
      >
        <RosterDot index={activeRosterIndex} />
        <span className="font-medium truncate max-w-[120px]">{displayName}</span>
        {state.rosters.length > 1 && (
          <span className="text-muted-foreground">({state.rosters.length})</span>
        )}
        <IconChevronDown size={16} className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute start-0 top-full mt-1 z-50 bg-popover text-popover-foreground border border-border rounded-md shadow-lg py-1 min-w-[200px]">
          {state.rosters.map((roster, rosterIdx) => (
            <div
              key={roster.id}
              className={`flex items-center gap-1.5 px-2 py-1.5 text-sm hover:bg-accent ${
                roster.id === state.activeRosterId ? "bg-accent/50 font-medium" : ""
              }`}
            >
              <RosterDot index={rosterIdx} />
              {editingId === roster.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameRoster(roster.id, editingName);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 px-1 py-0.5 border rounded text-xs"
                    autoFocus
                  />
                  <button
                    onClick={() => renameRoster(roster.id, editingName)}
                    className="p-0.5 hover:bg-accent rounded"
                  >
                    <IconCheck size={14} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-0.5 hover:bg-accent rounded"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => switchRoster(roster.id)}
                    className="flex-1 text-start truncate"
                  >
                    {roster.name || t("roster")}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(roster.id);
                      setEditingName(roster.name);
                    }}
                    className="p-0.5 hover:bg-accent rounded opacity-0 group-hover:opacity-100"
                    style={{ opacity: 1 }}
                  >
                    <IconPencil size={12} className="text-muted-foreground" />
                  </button>
                  {state.rosters.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRoster(roster.id);
                      }}
                      className="p-0.5 hover:bg-red-100 rounded"
                    >
                      <IconTrash size={12} className="text-red-400" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {state.rosters.length < MAX_ROSTERS && (
            <>
              <div className="border-t border-border my-1" />
              <button
                onClick={addRoster}
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-primary hover:bg-accent w-full"
              >
                <IconPlus size={14} />
                {t("addRoster")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
