import { Card, CardContent } from "@/components/elements/card";
import { useTranslation } from "react-i18next";

export interface ShiftInformationProps {
  shiftDuration: number;
  restTime: number;
  className?: string;
}

export function ShiftInformation({
  shiftDuration,
  restTime,
  className = "",
}: ShiftInformationProps) {
  const { t } = useTranslation();
  const formatTime = (hours: number) => {
    if (hours === 0) return "0.00h";
    return `${hours.toFixed(2)}h`;
  };

  const isValidDuration = shiftDuration > 0;

  return (
    <Card className={className}>
      <CardContent className="p-2">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-700 text-sm">
              {t("shiftInformation")}:
            </span>
            <span
              className={`text-sm font-medium ${
                isValidDuration ? "text-primary" : "text-red-500"
              }`}
            >
              {isValidDuration ? t("configured") : t("invalid")}
            </span>
          </div>

          {/* Responsive display - horizontal first, vertical on smaller screens */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Rest Time */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t("restTime")}
              </label>
              <div className="w-full px-2 py-1 border border-gray-300 rounded-md bg-white text-center font-medium text-gray-700 text-sm">
                {formatTime(restTime)}
              </div>
            </div>

            {/* Visual separator pointing from rest time to duration */}
            <div className="hidden sm:flex items-end pb-1">
              <span className="text-gray-400 font-medium icon-flip">→</span>
            </div>

            {/* Duration */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t("duration")}
              </label>
              <div className="relative">
                <div
                  className={`w-full px-2 py-1 border rounded-md text-center font-medium text-sm ${
                    isValidDuration
                      ? "border-gray-300 bg-white text-primary"
                      : "border-red-300 bg-red-50 text-red-500"
                  }`}
                >
                  {formatTime(shiftDuration)}
                </div>
              </div>
            </div>
          </div>

          {/* Error message for invalid configuration */}
          {!isValidDuration && (
            <p className="text-xs text-red-500 text-center">
              {t("unableToCalculateShiftDuration")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
