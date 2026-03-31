import { colors } from "@/constants/colors";

interface ShiftDurationProps {
  startTime: string;
  endTime: string;
  className?: string;
}

export function ShiftDuration({
  startTime,
  endTime,
  className = "",
}: ShiftDurationProps) {
  // Parse time strings to extract hours and minutes
  const parseTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    return { hours, minutes };
  };

  const start = parseTime(startTime);
  const end = parseTime(endTime);

  return (
    <div dir="ltr" className={`flex items-baseline justify-center gap-[0.2rem] ${className}`}>
      {/* Start Time - Large with superscript minutes */} 
      <div className="flex items-start">
        <span style={{ fontSize: '1.2rem', fontWeight: 400, lineHeight: 1 }}>
          {start.hours}
        </span>
        <span style={{ fontSize: '0.65rem', fontWeight: 600, lineHeight: 1, ...colors.text }}>
          {start.minutes}
        </span>
      </div>

      {/* Arrow */}
      <span className="flex-shrink-0" style={{ marginInlineStart: '-1rem', transform: 'translateY(3px) translateX(1px)' }}>
        <svg
          width="15"
          height="10"
          viewBox="0 0 21 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 4H20M16.5 1L20 4L16.5 7"
            stroke="black"
            strokeWidth="2"
          />
        </svg>
      </span>

      {/* End Time - Medium with superscript minutes */}
      <div className="flex items-start">
        <span style={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1 }}>
          {end.hours}
        </span>
        <span style={{ fontSize: '0.5rem', fontWeight: 600, lineHeight: 1, ...colors.text }}>
          {end.minutes}
        </span>
      </div>
    </div>
  );
}
