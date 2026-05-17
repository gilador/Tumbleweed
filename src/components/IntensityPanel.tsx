import { useTranslation } from "react-i18next";
import { ShiftLevel } from "../service/shiftLevels";

export interface IntensityPanelProps {
  levels: ShiftLevel[];
  selectedLevel: ShiftLevel | null;
  postsCount: number;
  staffCount: number;
  onLevelChange: (level: ShiftLevel) => void;
  variant: "desktop" | "mobile";
  className?: string;
}

export function IntensityPanel({
  levels,
  selectedLevel,
  postsCount,
  staffCount,
  onLevelChange,
  variant,
  className = "",
}: IntensityPanelProps) {
  const { t } = useTranslation();
  const isMobile = variant === "mobile";
  const feasibleLevels = levels.filter((l) => l.feasible);
  const selectedSliderIndex = selectedLevel
    ? levels.indexOf(selectedLevel)
    : feasibleLevels.length > 0
      ? levels.indexOf(feasibleLevels[Math.floor(feasibleLevels.length / 2)])
      : -1;

  // Sub-block: empty / single / slider
  const renderSlider = () => {
    if (levels.length === 0) {
      return (
        <p
          className={`${isMobile ? "text-xs" : "text-xs"} text-muted-foreground text-center py-1`}
        >
          {t("noFeasibleSchedule")}
        </p>
      );
    }

    if (levels.length === 1 && feasibleLevels.length <= 1) {
      const onlyLevel = levels[0];
      return (
        <div className="flex flex-col items-center gap-2 py-2">
          <div
            className={`${isMobile ? "w-1.5 h-5" : "w-1 h-3.5"} rounded-sm ${
              feasibleLevels.length === 1 ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />
          <span
            className={`${isMobile ? "text-sm" : "text-xs"} font-medium`}
            dir="ltr"
          >
            {onlyLevel.shifts}×{onlyLevel.duration.toFixed(1)}h
          </span>
          {feasibleLevels.length === 0 && onlyLevel.staffGap && (
            <span className="text-xs text-red-500">
              {t("needMoreStaff", {
                count: onlyLevel.staffGap,
                defaultValue: `Need ${onlyLevel.staffGap} more staff`,
              })}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className={`flex items-center ${isMobile ? "gap-3" : "gap-2"} ${isMobile ? "min-h-[2.75rem]" : "min-h-[1.5rem]"}`}>
        <span
          className={`${isMobile ? "text-xs" : "text-xs"} text-muted-foreground whitespace-nowrap`}
        >
          {t("intensityFew")}
        </span>
        <div
          className={`flex-1 flex items-center relative ${isMobile ? "h-11" : "h-4"}`}
        >
          <div
            className={`absolute ${isMobile ? "inset-x-[22px]" : "inset-x-[7px]"} h-0.5 bg-border rounded-full`}
          />
          <div className="relative w-full flex items-center justify-between">
            {levels.map((level, i) => {
              const tooltipText = level.feasible
                ? `${level.shifts}×${level.duration.toFixed(1)}h · ${t("rest")}: ${level.restBetween.toFixed(1)}h`
                : level.staffGap
                  ? `${level.shifts}×${level.duration.toFixed(1)}h — ${t(
                      "needMoreStaffOrLessPosts",
                      {
                        staffGap: level.staffGap,
                        postGap: level.postGap,
                        defaultValue: `Need ${level.staffGap} more staff or ${level.postGap} fewer posts`,
                      }
                    )}`
                  : "";
              const hitBox = isMobile
                ? "w-11 h-11"
                : "w-3.5 h-3.5";
              const dotSelected = isMobile
                ? "w-1.5 h-5 rounded-sm bg-primary shadow-sm"
                : "w-1 h-3.5 rounded-sm bg-primary shadow-sm";
              const dotIdle = isMobile
                ? "w-0.5 h-4 rounded-sm bg-muted-foreground/40 group-hover:bg-muted-foreground/70 group-hover:h-[1.125rem]"
                : "w-0.5 h-3 rounded-sm bg-muted-foreground/40 group-hover:bg-muted-foreground/70 group-hover:h-3.5";
              const dotInfeasible = isMobile
                ? "w-0.5 h-4 rounded-sm bg-muted-foreground/20"
                : "w-0.5 h-3 rounded-sm bg-muted-foreground/20";
              return (
                <div
                  key={i}
                  className={`relative group flex items-center justify-center ${hitBox} ${level.feasible ? "cursor-pointer" : "cursor-default"}`}
                  onClick={() => {
                    if (level.feasible) onLevelChange(level);
                  }}
                >
                  <div
                    className={`transition-all pointer-events-none ${
                      level.feasible
                        ? i === selectedSliderIndex
                          ? dotSelected
                          : dotIdle
                        : dotInfeasible
                    }`}
                  />
                  {tooltipText && (
                    <div
                      className={`absolute bottom-full left-1/2 -translate-x-1/2 ${isMobile ? "mb-2" : "mb-1.5"} px-2 py-1 rounded bg-foreground text-background text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none z-20`}
                      dir="ltr"
                    >
                      {tooltipText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <span
          className={`${isMobile ? "text-xs" : "text-xs"} text-muted-foreground whitespace-nowrap`}
        >
          {t("intensityMany")}
        </span>
      </div>
    );
  };

  // Sub-block: stats line
  const renderStats = () => {
    if (!selectedLevel) return null;
    return (
      <div
        className={`flex items-center justify-center ${isMobile ? "gap-4 text-sm" : "gap-2 text-xs"} text-muted-foreground flex-wrap`}
      >
        <span className="whitespace-nowrap">
          {t("shiftsLabel", { defaultValue: "Shifts" })}:{" "}
          <span className="font-medium text-foreground" dir="ltr">
            {selectedLevel.shifts}
          </span>
        </span>
        <span className="whitespace-nowrap" dir="ltr">
          {t("duration")}:{" "}
          <span className="font-medium text-primary">
            {selectedLevel.duration.toFixed(2)}h
          </span>
        </span>
        {selectedLevel.restBetween > 0 && (
          <span className="whitespace-nowrap" dir="ltr">
            {t("minRest", { defaultValue: "Min. rest" })}:{" "}
            <span className="font-medium text-foreground">
              {selectedLevel.restBetween.toFixed(1)}h
            </span>
          </span>
        )}
      </div>
    );
  };

  // Sub-block: how-it-works callout
  const renderHowItWorks = () => {
    if (!selectedLevel) return null;
    return (
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
        <div className="text-xs text-foreground space-y-1">
          <p>
            <span className="font-semibold">{t("howItWorks")}:</span>{" "}
            <span dir="ltr">
              {selectedLevel.shifts}×{selectedLevel.duration.toFixed(1)}h
            </span>{" "}
            {t("shifts").toLowerCase()} <span className="text-border-strong">·</span>{" "}
            {postsCount} {t("posts").toLowerCase()}{" "}
            <span className="text-border-strong">·</span> {staffCount}{" "}
            {t("staff").toLowerCase()}
          </p>
          <p className="text-muted-foreground">
            {t("eachWorker", { defaultValue: "Each worker" })}:{" "}
            {selectedLevel.shiftsPerWorker} {t("shifts").toLowerCase()},{" "}
            <span dir="ltr">{selectedLevel.workHours.toFixed(1)}h</span>{" "}
            {t("work", { defaultValue: "work" })}
            {selectedLevel.restBetween > 0 && (
              <>
                {" "}
                <span className="text-border-strong">·</span>{" "}
                <span dir="ltr">
                  {selectedLevel.restBetween.toFixed(1)}h
                </span>{" "}
                {t("rest").toLowerCase()}{" "}
                {t("betweenShifts", { defaultValue: "between shifts" })}
              </>
            )}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col ${isMobile ? "gap-3" : "gap-2"} ${className}`}>
      <h3
        className={`${isMobile ? "text-sm" : "text-xs"} font-semibold ${isMobile ? "" : "text-muted-foreground"}`}
      >
        {t("shiftIntensity")}
      </h3>
      {renderSlider()}
      {renderStats()}
      {renderHowItWorks()}
    </div>
  );
}
