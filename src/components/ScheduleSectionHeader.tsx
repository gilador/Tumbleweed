import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RosterSwitcher } from "./RosterSwitcher";

interface ScheduleSectionHeaderProps {
  postsCount: number;
  shiftsPerDay: number;
  shiftDuration: number;
  scheduleMode: "24h" | "7d";
  weeklyView: boolean;
  onWeeklyViewChange: (next: boolean) => void;
  endSlot?: ReactNode;
}

export function ScheduleSectionHeader({
  postsCount,
  shiftsPerDay,
  shiftDuration,
  scheduleMode,
  weeklyView,
  onWeeklyViewChange,
  endSlot,
}: ScheduleSectionHeaderProps) {
  const { t } = useTranslation();
  const safeDuration = isNaN(shiftDuration) ? 0 : shiftDuration;
  return (
    <div className="flex items-baseline gap-3 flex-none flex-nowrap">
      <h2 className="text-base font-bold m-0">{t("schedule")}</h2>
      <span
        className="text-xs text-muted-foreground inline-flex items-center gap-1.5 tabular-nums"
        dir="ltr"
      >
        <span>
          <b className="text-foreground font-semibold me-1">{postsCount}</b>{" "}
          {t("positionsLabel")}
        </span>
        <span className="text-border-strong">·</span>
        <span>
          <b className="text-foreground font-semibold me-1">{shiftsPerDay}</b>{" "}
          {t("shiftsPerDayLabel")}
        </span>
        <span className="text-border-strong">·</span>
        <span>
          <b className="text-foreground font-semibold me-1">{safeDuration.toFixed(1)}</b>{" "}
          {t("avgShiftDurationLabel")}
        </span>
      </span>
      <RosterSwitcher />
      {scheduleMode === "7d" && (
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => onWeeklyViewChange(false)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              !weeklyView ? "bg-muted" : "hover:bg-accent"
            }`}
          >
            {t("dailyView")}
          </button>
          <button
            type="button"
            onClick={() => onWeeklyViewChange(true)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              weeklyView ? "bg-muted" : "hover:bg-accent"
            }`}
          >
            {t("weeklyView")}
          </button>
        </div>
      )}
      {endSlot ? <div className="ms-auto flex items-center min-w-0">{endSlot}</div> : null}
    </div>
  );
}
