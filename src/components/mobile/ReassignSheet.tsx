import { UserShiftData } from "../../models";
import { useTranslation } from "react-i18next";
import { IconCheck, IconX } from "@tabler/icons-react";

interface ReassignSheetProps {
  postIndex: number;
  hourIndex: number;
  postName: string;
  timeRange: string;
  currentUserId: string | null;
  userShiftData: UserShiftData[];
  onAssign: (userId: string | null) => void;
  onClose: () => void;
}

export function ReassignSheet({
  postIndex,
  hourIndex,
  postName,
  timeRange,
  currentUserId,
  userShiftData,
  onAssign,
  onClose,
}: ReassignSheetProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Sheet */}
      <div
        className="relative w-full bg-background rounded-t-2xl max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3 flex-none">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-border flex-none">
          <p className="text-xs font-semibold text-muted-foreground mb-1 text-center">{t("updatePostAssignment")}</p>
          <h3 className="text-sm font-semibold">{postName}</h3>
          <p className="text-xs text-muted-foreground" dir="ltr">{timeRange}</p>
        </div>

        {/* Soldier list */}
        <div className="overflow-y-auto flex-1 px-2">
          {userShiftData.map((userData) => {
            const isAvailable = userData.constraints[postIndex]?.[hourIndex]?.availability ?? false;
            const isCurrent = userData.user.id === currentUserId;

            return (
              <button
                key={userData.user.id}
                onClick={() => {
                  if (isAvailable) onAssign(userData.user.id);
                }}
                disabled={!isAvailable}
                className={`flex items-center justify-between w-full px-4 min-h-[52px] rounded-lg my-0.5 ${
                  !isAvailable
                    ? "opacity-40 cursor-not-allowed"
                    : isCurrent
                    ? "bg-primary/10"
                    : "hover:bg-accent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${isCurrent ? "font-semibold" : ""}`}>
                    {userData.user.name}
                  </span>
                  {!isAvailable && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {t("unavailable")}
                    </span>
                  )}
                </div>
                {isCurrent && <IconCheck size={16} className="text-primary" />}
              </button>
            );
          })}
        </div>

        {/* Unassign action */}
        <div className="px-4 py-3 border-t border-border flex-none">
          <button
            onClick={() => onAssign(null)}
            className="flex items-center justify-center gap-2 w-full min-h-[44px] rounded-md border border-border text-sm hover:bg-accent"
          >
            <IconX size={16} className="text-muted-foreground" />
            {t("unassign")}
          </button>
        </div>
      </div>
    </div>
  );
}
