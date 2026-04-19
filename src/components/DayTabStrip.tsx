import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getDayLabel } from "@/service/dayLabelUtils";

export type DayIndicator = "full" | "partial" | "empty";

interface DayTabStripProps {
  startDate: string;
  selectedDay: number;
  onDayChange: (dayIndex: number) => void;
  dayIndicators?: DayIndicator[];
  highlightedDays?: Set<number>;
  className?: string;
}

export function DayTabStrip({
  startDate,
  selectedDay,
  onDayChange,
  dayIndicators,
  highlightedDays,
  className = "",
}: DayTabStripProps) {
  const { i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const locale = i18n.language === "he" ? "he-IL" : "en-US";

  // Auto-scroll selected tab into view
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeTab = container.children[selectedDay] as HTMLElement;
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedDay]);

  return (
    <div
      ref={containerRef}
      className={`flex gap-1 overflow-x-auto scrollbar-hide ${className}`}
      role="tablist"
    >
      {(() => {
        const anyDotVisible = !!(highlightedDays?.size || dayIndicators?.length);
        return Array.from({ length: 7 }, (_, dayIndex) => {
        const label = getDayLabel(startDate, dayIndex, locale);
        const isActive = dayIndex === selectedDay;
        const isHighlighted = highlightedDays?.has(dayIndex) ?? false;
        const indicator = dayIndicators?.[dayIndex];

        const showDot = indicator || isHighlighted;
        const dotChar = isHighlighted
          ? "\u25CF"
          : indicator === "full" ? "\u25CF" : indicator === "partial" ? "\u25D0" : "\u25CB";

        return (
          <button
            key={dayIndex}
            role="tab"
            aria-selected={isActive}
            onClick={() => onDayChange(dayIndex)}
            className={`relative flex items-center justify-center px-3 h-8 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
              anyDotVisible ? "pb-2.5" : ""
            } ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            <span dir="ltr" className="transition-transform duration-300">{label}</span>
            <span
              className={`absolute bottom-1 text-[8px] leading-none transition-all duration-300 ${
                showDot
                  ? isActive ? "text-primary-foreground/70 opacity-100" : "text-muted-foreground/60 opacity-100"
                  : "opacity-0"
              }`}
            >
              {dotChar}
            </span>
          </button>
        );
      });
      })()}
    </div>
  );
}
