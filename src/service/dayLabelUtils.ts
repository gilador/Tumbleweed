export function getDayLabel(
  startDate: string,
  dayIndex: number,
  locale: string
): string {
  const date = new Date(startDate + "T00:00:00");
  date.setDate(date.getDate() + dayIndex);
  const dayName = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  const dateStr = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  return `${dayName} ${dateStr}`;
}

export function getDayLabels(
  startDate: string,
  locale: string
): string[] {
  return Array.from({ length: 7 }, (_, i) => getDayLabel(startDate, i, locale));
}

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDayOfWeek(startDate: string, dayIndex: number): number {
  const date = new Date(startDate + "T00:00:00");
  date.setDate(date.getDate() + dayIndex);
  return date.getDay(); // 0=Sunday, 6=Saturday
}

export function getWeekdayIndices(startDate: string): number[] {
  // Israeli weekdays: Sunday (0) through Thursday (4)
  return Array.from({ length: 7 }, (_, i) => i).filter((i) => {
    const dow = getDayOfWeek(startDate, i);
    return dow >= 0 && dow <= 4; // Sun-Thu
  });
}

export function getWeekendIndices(startDate: string): number[] {
  // Israeli weekend: Friday (5) and Saturday (6)
  return Array.from({ length: 7 }, (_, i) => i).filter((i) => {
    const dow = getDayOfWeek(startDate, i);
    return dow === 5 || dow === 6; // Fri-Sat
  });
}
