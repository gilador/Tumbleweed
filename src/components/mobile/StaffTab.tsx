import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserShiftData } from "../../models";
import { IconPlus, IconTrash, IconChevronRight, IconCheck, IconX } from "@tabler/icons-react";

interface StaffTabProps {
  userShiftData: UserShiftData[];
  assignments: (string | null)[][];
  onSelectUser: (userId: string) => void;
  onAddUser: () => void;
  onRemoveUser: (userId: string) => void;
}

export function StaffTab({
  userShiftData,
  assignments,
  onSelectUser,
  onAddUser,
  onRemoveUser,
}: StaffTabProps) {
  const { t } = useTranslation();
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);

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
