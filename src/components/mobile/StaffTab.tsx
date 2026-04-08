import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserShiftData } from "../../models";
import { IconPlus, IconTrash, IconChevronRight, IconCheck, IconX, IconPencil } from "@tabler/icons-react";

interface StaffTabProps {
  userShiftData: UserShiftData[];
  assignments: (string | null)[][];
  onSelectUser: (userId: string) => void;
  onAddUser: () => void;
  onRemoveUser: (userId: string) => void;
  onUpdateUserName: (userId: string, newName: string) => void;
}

export function StaffTab({
  userShiftData,
  assignments,
  onSelectUser,
  onAddUser,
  onRemoveUser,
  onUpdateUserName,
}: StaffTabProps) {
  const { t } = useTranslation();
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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
            const isDeleting = deleteConfirmUserId === userData.user.id;
            const isEditing = editingUserId === userData.user.id;

            return (
              <div
                key={userData.user.id}
                className="flex items-center min-h-[52px] rounded-lg border border-border"
              >
                {isDeleting ? (
                  <div className="flex-1 flex items-center justify-between px-4 py-2">
                    <span className="text-sm text-destructive">
                      {t("deleteUserConfirm", { name: userData.user.name })}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          onRemoveUser(userData.user.id);
                          setDeleteConfirmUserId(null);
                        }}
                        className="p-2 rounded-md bg-destructive/10 hover:bg-destructive/20 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <IconCheck size={16} className="text-destructive" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmUserId(null)}
                        className="p-2 rounded-md hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <IconX size={16} />
                      </button>
                    </div>
                  </div>
                ) : isEditing ? (
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
                  <>
                    <button
                      onClick={() => onSelectUser(userData.user.id)}
                      className="flex-1 flex items-center justify-between px-4 py-2 min-h-[52px] text-start"
                    >
                      <span className="text-sm font-medium">{userData.user.name}</span>
                      <div className="flex items-center gap-2">
                        {assignmentCount > 0 && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            {assignmentCount}
                          </span>
                        )}
                        <IconChevronRight size={16} className="text-muted-foreground icon-flip" />
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setEditingUserId(userData.user.id);
                        setEditingName(userData.user.name);
                      }}
                      className="p-3 hover:bg-accent min-h-[52px] flex items-center justify-center border-s border-border"
                      data-testid={`edit-staff-${userData.user.id}`}
                    >
                      <IconPencil size={16} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmUserId(userData.user.id)}
                      className="p-3 hover:bg-accent min-h-[52px] flex items-center justify-center border-s border-border"
                    >
                      <IconTrash size={16} className="text-muted-foreground" />
                    </button>
                  </>
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
