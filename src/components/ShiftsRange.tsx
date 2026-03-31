import { Card, CardContent } from "@/components/elements/card";
import { Input } from "@/components/elements/input";
import { useTranslation } from "react-i18next";

export interface ShiftsRangeProps {
  startTime: string;
  endTime: string;
  onStartTimeChange?: (startTime: string) => void;
  onEndTimeChange?: (endTime: string) => void;
  className?: string;
}

export function ShiftsRange({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  className = "",
}: ShiftsRangeProps) {
  const { t } = useTranslation();
  // Fully controlled component - no local state, always use props
  const handleStartTimeChange = (time: string) => {
    onStartTimeChange?.(time);
  };

  const handleEndTimeChange = (time: string) => {
    onEndTimeChange?.(time);
  };

  // Calculate operation duration for display
  const calculateDuration = () => {
    try {
      const [startHours, startMinutes] = startTime.split(":").map(Number);
      const [endHours, endMinutes] = endTime.split(":").map(Number);

      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;

      let durationMinutes = endTotalMinutes - startTotalMinutes;

      // Handle overnight shifts (show as invalid)
      if (durationMinutes <= 0) {
        return "Invalid";
      }

      return `${Math.round((durationMinutes / 60) * 10) / 10}h`;
    } catch (error) {
      return "Invalid";
    }
  };

  const duration = calculateDuration();
  const isValidRange = duration !== "Invalid";

  return (
    <Card className={className}>
      <CardContent className="p-2">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-700 text-sm">
              {t("shiftInput")}:
            </span>
            <span
              className={`text-sm font-medium ${
                isValidRange ? "text-primary" : "text-red-500"
              }`}
            >
              {isValidRange ? duration : t("invalid")}
            </span>
          </div>

          {/* Responsive time inputs - horizontal first, vertical on smaller screens */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Start Time */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t("start")}
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className={`w-full ${
                  !isValidRange ? "border-red-300 focus:border-red-500" : ""
                }`}
              />
            </div>

            {/* Visual separator */}
            <div className="hidden sm:flex items-end pb-1">
              <span className="text-gray-400 font-medium icon-flip">→</span>
            </div>

            {/* End Time */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t("end")}
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className={`w-full ${
                  !isValidRange ? "border-red-300 focus:border-red-500" : ""
                }`}
              />
            </div>
          </div>

          {/* Error message for invalid ranges */}
          {!isValidRange && (
            <p className="text-xs text-red-500 text-center">
              {t("endTimeAfterStartTime")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
