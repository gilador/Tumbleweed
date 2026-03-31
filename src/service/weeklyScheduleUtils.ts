import { UniqueString } from "@/models";

const DAY_SEPARATOR = "·";

export function parseFlatHour(value: string): { dayIndex: number; time: string } {
  const sepIndex = value.indexOf(DAY_SEPARATOR);
  if (sepIndex === -1) {
    // Plain time string (24h mode) — treat as day 0
    return { dayIndex: 0, time: value };
  }
  return {
    dayIndex: parseInt(value.substring(0, sepIndex), 10),
    time: value.substring(sepIndex + 1),
  };
}

export function encodeFlatHour(dayIndex: number, time: string): string {
  return `${dayIndex}${DAY_SEPARATOR}${time}`;
}

export function getHoursForDay(
  hours: UniqueString[],
  dayIndex: number
): UniqueString[] {
  return hours.filter(
    (h) => parseFlatHour(h.value).dayIndex === dayIndex
  );
}

export function getDaySlice(
  totalHours: number,
  dayIndex: number
): { start: number; end: number } {
  const perDay = totalHours / 7;
  return {
    start: dayIndex * perDay,
    end: (dayIndex + 1) * perDay,
  };
}

export function getShiftsPerDay(hours: UniqueString[]): number {
  if (hours.length === 0) return 0;
  // Check if this is a 7D schedule by looking for the day separator
  const isWeekly = hours[0].value.includes(DAY_SEPARATOR);
  if (!isWeekly) return hours.length;
  return hours.length / 7;
}

export function getDisplayTime(hourValue: string): string {
  return parseFlatHour(hourValue).time;
}

export function isWeeklyHour(hourValue: string): boolean {
  return hourValue.includes(DAY_SEPARATOR);
}
