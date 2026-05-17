import { IconUser, IconChevronUp, IconChevronDown, IconCheck, IconPencil } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRecoilValue } from "recoil";
import { useTranslation } from "react-i18next";
import { User } from "../models";
import { StaffAvatar } from "./StaffAvatar";
import { useContextMenu, renameTargetState } from "../stores/contextMenuStore";
import { staffRowToggleAction } from "../stores/selectionStore";
import { trackEvent } from "../lib/analytics";

export interface WorkerListProps {
  users: User[];
  selectedUserId: string | null;
  onSelectUser: (userId: string | null) => void;
  onUpdateUserName: (userId: string, newName: string) => void;
  checkedUserIds: string[];
  onCheckUser: (userId: string, event?: React.MouseEvent) => void;
  onUncheckUser: (userId: string) => void;
  assignments?: (string | null)[][];
  inStaffMulti: boolean;
}

export function WorkerList({
  users,
  selectedUserId,
  onSelectUser,
  onUpdateUserName,
  checkedUserIds,
  onCheckUser,
  onUncheckUser,
  assignments,
  inStaffMulti,
}: WorkerListProps) {
  const { t } = useTranslation();
  const { open: openContextMenu } = useContextMenu();
  const renameTarget = useRecoilValue(renameTargetState);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingTempValue, setEditingTempValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [users.length, updateScrollState]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState);
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  useEffect(() => {
    if (editingUserId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingUserId]);

  // External rename trigger (from context menu).
  useEffect(() => {
    if (!renameTarget || renameTarget.kind !== "staff") return;
    const u = users.find((x) => x.id === renameTarget.id);
    if (u) {
      setEditingTempValue(u.name);
      setEditingUserId(u.id);
    }
  }, [renameTarget, users]);

  const hasAnyAssignments = () => {
    if (!assignments) return false;
    for (const postAssignments of assignments) {
      for (const assignedUserId of postAssignments) {
        if (assignedUserId !== null) return true;
      }
    }
    return false;
  };

  const getAssignmentCount = (userId: string) => {
    if (!assignments) return 0;
    let count = 0;
    for (const postAssignments of assignments) {
      for (const assignedUserId of postAssignments) {
        if (assignedUserId === userId) count++;
      }
    }
    return count;
  };

  const startEdit = (user: User) => {
    setEditingTempValue(user.name);
    setEditingUserId(user.id);
  };

  const commitEdit = () => {
    if (!editingUserId) return;
    const trimmed = editingTempValue.trim();
    const original = users.find((u) => u.id === editingUserId)?.name;
    if (trimmed && trimmed !== original) onUpdateUserName(editingUserId, trimmed);
    setEditingUserId(null);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
  };

  const applyToggle = (
    userId: string,
    intent: "row" | "checkbox",
    event?: React.MouseEvent
  ) => {
    const action = staffRowToggleAction(
      userId,
      checkedUserIds.includes(userId),
      selectedUserId,
      intent
    );
    if (action.toggle === "uncheck") onUncheckUser(userId);
    else onCheckUser(userId, event);
    if (action.selection.update) onSelectUser(action.selection.to);
  };

  const handleCheckClick = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    applyToggle(userId, "checkbox", e);
  };

  return (
    <div className="flex flex-col h-full rounded-lg bg-background relative">
      {canScrollUp && (
        <button
          type="button"
          data-testid="staff-scroll-up"
          aria-label={t("scrollStaffListToTop")}
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 p-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md shadow-sm transition-colors border border-input"
        >
          <IconChevronUp size={20} strokeWidth={2.5} />
        </button>
      )}
      {canScrollDown && (
        <button
          type="button"
          data-testid="staff-scroll-down"
          aria-label={t("scrollStaffListToBottom")}
          onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-10 p-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md shadow-sm transition-colors border border-input"
        >
          <IconChevronDown size={20} strokeWidth={2.5} />
        </button>
      )}
      <div
        ref={scrollRef}
        data-testid="staff-section-content"
        className="flex-1 overflow-y-auto overflow-x-hidden bg-background"
      >
        <div className="flex flex-col gap-1.5">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-4 h-full">
              <IconUser className="w-12 h-12 text-muted-foreground mb-2" />
              <p className="font-semibold text-foreground">{t("noWorkersAddedYet")}</p>
              <p className="font-semibold text-sm text-muted-foreground">{t("clickToAddWorker")}</p>
            </div>
          ) : (
            users.map((user) => {
              const assignmentCount = getAssignmentCount(user.id);
              const isChecked = checkedUserIds.includes(user.id);
              // `isHighlighted` only gates the per-row trash chip (line ~239) — no longer
              // drives any row/name/pill styling per CEO directive. Kept as an alias for
              // readability at the gate site.
              const isHighlighted = isChecked;
              const isEditingThis = editingUserId === user.id;
              return (
                <div
                  key={user.id}
                  data-testid="staff-member"
                  className="group relative flex items-center gap-3 min-h-[52px] px-3.5 py-2 rounded-md border cursor-pointer bg-background border-border"
                  onClick={(e) => {
                    if (editingUserId !== null) return;
                    applyToggle(user.id, "checkbox", e);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (editingUserId === user.id) return;
                    openContextMenu({
                      kind: "staff",
                      targetId: user.id,
                      anchorEl: null,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.shiftKey && e.key === "F10") {
                      e.preventDefault();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      openContextMenu({
                        kind: "staff",
                        targetId: user.id,
                        anchorEl: null,
                        x: rect.left + 8,
                        y: rect.bottom,
                      });
                    }
                  }}
                  tabIndex={-1}
                >
                  <div className="relative w-8 h-8 flex-shrink-0">
                    <StaffAvatar size="md" id={user.id} name={user.name} />
                    {!isHighlighted && !isEditingThis && !inStaffMulti && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(user);
                          trackEvent("user-rename-start", { surface: "desktop" });
                        }}
                        aria-label={t("editUserName")}
                        title={t("editUserName")}
                        data-testid={`edit-staff-${user.id}`}
                        className="edit-affordance absolute inset-0 hidden group-hover:grid place-items-center rounded-full bg-muted-foreground text-white hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground transition-colors"
                      >
                        <IconPencil size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isEditingThis ? (
                      <input
                        ref={editInputRef}
                        value={editingTempValue}
                        onChange={(e) => setEditingTempValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitEdit();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-0.5 text-sm font-medium bg-background outline-none border-b border-primary"
                      />
                    ) : (
                      <span
                        className="block truncate px-2 py-0.5 rounded-md text-sm font-medium"
                        style={{ direction: "ltr", unicodeBidi: "plaintext" }}
                      >
                        {user.name}
                      </span>
                    )}
                  </div>
                  {assignments && hasAnyAssignments() && assignmentCount > 0 && (
                    <span
                      className="pill text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-full flex-shrink-0 bg-primary-soft text-primary"
                      dir="ltr"
                    >
                      {assignmentCount}
                    </span>
                  )}
                  {inStaffMulti && (
                    <button
                      type="button"
                      onClick={(e) => handleCheckClick(e, user.id)}
                      aria-label={isChecked ? t("deselectAllUsers") : t("selectAllUsers")}
                      className={`check-mark flex-shrink-0 grid place-items-center w-[18px] h-[18px] rounded border-[1.5px] transition-colors ${
                        isChecked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background border-border-strong text-transparent"
                      }`}
                    >
                      <IconCheck size={10} stroke={3} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
