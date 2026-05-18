import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserShiftData } from "../../models";
import { IconPlus, IconChevronRight, IconCheck, IconX } from "@tabler/icons-react";
import { useMultiSelect } from "../../stores/selectionStore";
import { useLongPress } from "../../hooks/useLongPress";
import { trackEvent } from "../../lib/analytics";

interface StaffTabProps {
  userShiftData: UserShiftData[];
  assignments: (string | null)[][];
  onSelectUser: (userId: string) => void;
  onAddUser: () => void;
  onUpdateUserName: (userId: string, newName: string) => void;
}

export function StaffTab({
  userShiftData,
  assignments,
  onSelectUser,
  onAddUser,
  onUpdateUserName,
}: StaffTabProps) {
  const { t } = useTranslation();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const {
    inMulti,
    isMultiChecked,
    enterMulti,
    toggleInMulti,
  } = useMultiSelect();
  const inStaffMulti = inMulti("staff");

  const longPress = useLongPress({
    onLongPress: (target) => {
      const el = target as HTMLElement;
      const row = el.closest("[data-staff-row-id]") as HTMLElement | null;
      if (row === null) return;
      const userId = row.getAttribute("data-staff-row-id");
      if (userId === null) return;
      const userData = userShiftData.find((u) => u.user.id === userId);
      if (userData === undefined) return;
      const zone = el
        .closest("[data-longpress-zone]")
        ?.getAttribute("data-longpress-zone");
      if (zone === "name") {
        if (inStaffMulti) return;
        setEditingUserId(userId);
        setEditingName(userData.user.name);
        return;
      }
      if (editingUserId !== null) return;
      enterMulti([userId], "staff");
      trackEvent("staff-multi-select-entered", { source: "mobile-long-press" });
    },
  });

  const getAssignmentCount = (userId: string): number => {
    let count = 0;
    for (const postAssignments of assignments) {
      for (const assignedUserId of postAssignments) {
        if (assignedUserId === userId) count++;
      }
    }
    return count;
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{t("staff")}</h1>
        <span className="text-sm text-muted-foreground">
          {t("membersCount", { count: userShiftData.length })}
        </span>
      </div>

      {/* Staff List */}
      {userShiftData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">{t("noStaffYet")}</p>
          <p className="text-xs mt-1">{t("tapToAddFirstStaff")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {userShiftData.map((userData) => {
            const assignmentCount = getAssignmentCount(userData.user.id);
            const isEditing = editingUserId === userData.user.id;
            const isChecked = isMultiChecked(userData.user.id, "staff");
            const containerCls = [
              "flex items-center min-h-[52px] rounded-lg border no-touch-callout select-none",
              isChecked ? "bg-primary/10 border-primary" : "border-border",
            ].join(" ");

            return (
              <div
                key={userData.user.id}
                data-staff-row-id={userData.user.id}
                className={containerCls}
                onPointerDown={isEditing ? undefined : longPress.onPointerDown}
                onPointerMove={isEditing ? undefined : longPress.onPointerMove}
                onPointerUp={isEditing ? undefined : longPress.onPointerUp}
                onPointerCancel={isEditing ? undefined : longPress.onPointerCancel}
                onContextMenu={isEditing ? undefined : longPress.onContextMenu}
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2 px-4 py-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
                      autoFocus
                      data-testid="edit-staff-name-input"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const trimmed = editingName.trim();
                          if (trimmed && trimmed !== userData.user.name) {
                            onUpdateUserName(userData.user.id, trimmed);
                          }
                          setEditingUserId(null);
                        }
                        if (e.key === "Escape") {
                          setEditingUserId(null);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const trimmed = editingName.trim();
                        if (trimmed && trimmed !== userData.user.name) {
                          onUpdateUserName(userData.user.id, trimmed);
                        }
                        setEditingUserId(null);
                      }}
                      className="p-2 rounded-md hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <IconCheck size={18} className="text-primary" />
                    </button>
                    <button
                      onClick={() => setEditingUserId(null)}
                      className="p-2 rounded-md hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <IconX size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      if (longPress.justLongPressed()) {
                        e.preventDefault();
                        return;
                      }
                      if (inStaffMulti) {
                        toggleInMulti(userData.user.id);
                        return;
                      }
                      onSelectUser(userData.user.id);
                    }}
                    className="flex-1 flex items-center justify-between px-4 py-2 min-h-[52px] text-start"
                  >
                    <span data-longpress-zone="name" className="text-sm font-medium">
                      {userData.user.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {assignmentCount > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          {assignmentCount}
                        </span>
                      )}
                      {inStaffMulti ? (
                        isChecked ? (
                          <IconCheck size={16} className="text-primary" />
                        ) : (
                          <span className="size-4 rounded-full border border-border" />
                        )
                      ) : (
                        <IconChevronRight size={16} className="text-muted-foreground icon-flip" />
                      )}
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add soldier FAB */}
      <button
        onClick={onAddUser}
        className="fixed bottom-20 end-4 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
      >
        <IconPlus size={24} />
      </button>
    </div>
  );
}
