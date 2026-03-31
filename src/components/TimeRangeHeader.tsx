interface TimeRangeHeaderProps {
  startTime: string;
  endTime: string;
  className?: string;
}

export function TimeRangeHeader({
  startTime,
  endTime,
  className = "",
}: TimeRangeHeaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="text-sm font-normal text-gray-500 leading-tight">
        {endTime}
      </div>
      <div className="w-full border-t border-gray-300 my-0.5"></div>
      <div className="text-2xl font-bold leading-tight">{startTime}</div>
    </div>
  );
}
