import { useTranslation } from "react-i18next";
import { getWeekdayIndices, getWeekendIndices } from "@/service/dayLabelUtils";

interface AvailabilityCopyBarProps {
  startDate: string;
  sourceDayIndex: number;
  onCopy: (targetDayIndices: number[]) => void;
  className?: string;
}

export function AvailabilityCopyBar({
  startDate,
  sourceDayIndex,
  onCopy,
  className = "",
}: AvailabilityCopyBarProps) {
  const { t } = useTranslation();

  const allOtherDays = Array.from({ length: 7 }, (_, i) => i).filter(
    (i) => i !== sourceDayIndex
  );
  const weekdays = getWeekdayIndices(startDate).filter(
    (i) => i !== sourceDayIndex
  );
  const weekend = getWeekendIndices(startDate).filter(
    (i) => i !== sourceDayIndex
  );

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        onClick={() => onCopy(allOtherDays)}
        className="px-3 py-1 text-xs rounded-md border border-gray-300 hover:bg-gray-100 transition-colors"
      >
        {t("copyToAllDays")}
      </button>
      {weekdays.length > 0 && (
        <button
          onClick={() => onCopy(weekdays)}
          className="px-3 py-1 text-xs rounded-md border border-gray-300 hover:bg-gray-100 transition-colors"
        >
          {t("copyToWeekdays")}
        </button>
      )}
      {weekend.length > 0 && (
        <button
          onClick={() => onCopy(weekend)}
          className="px-3 py-1 text-xs rounded-md border border-gray-300 hover:bg-gray-100 transition-colors"
        >
          {t("copyToWeekend")}
        </button>
      )}
    </div>
  );
}
