import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { BulkSelectionBar } from "./BulkSelectionBar";

interface StaffSectionHeaderProps {
  staffCount: number;
  avgShifts: number;
  onAdd: () => void;
  allUserIds: string[];
  onBulkDelete: (ids: string[]) => void;
}

export function StaffSectionHeader({
  staffCount,
  avgShifts,
  onAdd,
  allUserIds,
  onBulkDelete,
}: StaffSectionHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-baseline gap-3 mb-2 flex-none">
        <h2 className="text-base font-bold m-0">{t("staff")}</h2>
        <span
          className="text-xs text-muted-foreground inline-flex items-center gap-1.5 tabular-nums"
          dir="ltr"
        >
          <b className="text-foreground font-semibold">
            {t("staffCount", { count: staffCount })}
          </b>
          <span className="text-border-strong">·</span>
          <b className="text-foreground font-semibold">{avgShifts}</b>
          <span>{t("avgShiftsLabel")}</span>
        </span>
      </div>
      <div
        data-testid="staff-controls-row"
        className="flex items-center gap-2 px-1 pb-2 flex-none"
      >
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 h-[26px] px-2.5 rounded-md border border-border bg-background text-foreground text-xs font-medium hover:bg-muted"
        >
          <IconPlus size={13} />
          {t("addUserShort")}
        </button>
        <div className="flex-1 min-w-0">
          <BulkSelectionBar
            kind="staff"
            total={staffCount}
            allIds={allUserIds}
            onBulkDelete={onBulkDelete}
            inline
          />
        </div>
      </div>
    </>
  );
}
