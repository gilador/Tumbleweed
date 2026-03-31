import type { UniqueString, UserShiftData } from "../models";
import { getDaySlice, getDisplayTime } from "./weeklyScheduleUtils";
import { getDayLabel, getTodayISO } from "./dayLabelUtils";

interface TextSummaryOptions {
  posts: UniqueString[];
  hours: UniqueString[];
  assignments: (string | null)[][];
  userShiftData: UserShiftData[];
  endTime: string;
  customCellDisplayNames: { [slotKey: string]: string };
  groupBy: "time" | "post";
  date?: string;
  scheduleMode?: "24h" | "7d";
  startDate?: string | null;
  locale?: string;
}

function formatDate(date?: string): string {
  if (date) return date;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function getTimeRange(
  hours: UniqueString[],
  endTime: string,
  hourIndex: number,
  isWeekly: boolean = false
): string {
  const rawStart = hours[hourIndex]?.value || "";
  const start = isWeekly ? getDisplayTime(rawStart) : rawStart;
  const rawEnd = hourIndex + 1 < hours.length ? hours[hourIndex + 1].value : endTime;
  const end = isWeekly ? getDisplayTime(rawEnd) : rawEnd;
  return `${start}-${end}`;
}

function resolveUserName(
  userId: string | null,
  postIndex: number,
  hourIndex: number,
  userShiftData: UserShiftData[],
  customCellDisplayNames: { [slotKey: string]: string }
): string | null {
  const slotKey = `${postIndex}-${hourIndex}`;
  if (customCellDisplayNames[slotKey]) return customCellDisplayNames[slotKey];
  if (!userId) return null;
  const user = userShiftData.find((u) => u.user.id === userId);
  return user?.user.name || null;
}

export function generateTextSummary(opts: TextSummaryOptions): string {
  const {
    posts,
    hours,
    assignments,
    userShiftData,
    endTime,
    customCellDisplayNames,
    groupBy,
    date,
    scheduleMode = "24h",
    startDate,
    locale = "he-IL",
  } = opts;

  const isWeekly = scheduleMode === "7d";
  const numDays = isWeekly ? 7 : 1;

  const lines: string[] = [`Shift Schedule — ${formatDate(date)}`];
  lines.push("");

  for (let day = 0; day < numDays; day++) {
    const slice = isWeekly
      ? getDaySlice(hours.length, day)
      : { start: 0, end: hours.length };
    const dayHourIndices = Array.from(
      { length: slice.end - slice.start },
      (_, i) => slice.start + i
    );

    if (isWeekly) {
      lines.push(getDayLabel(startDate || getTodayISO(), day, locale));
    }

    if (groupBy === "time") {
      for (const h of dayHourIndices) {
        const timeRange = getTimeRange(hours, endTime, h, isWeekly);
        const entries: string[] = [];

        for (let p = 0; p < posts.length; p++) {
          const name = resolveUserName(
            assignments[p]?.[h] ?? null,
            p,
            h,
            userShiftData,
            customCellDisplayNames
          );
          if (name) {
            entries.push(`  ${posts[p].value}: ${name}`);
          }
        }

        if (entries.length > 0) {
          lines.push(isWeekly ? `  ${timeRange}` : timeRange);
          lines.push(...entries.map((e) => (isWeekly ? `  ${e}` : e)));
          lines.push("");
        }
      }
    } else {
      for (let p = 0; p < posts.length; p++) {
        const entries: string[] = [];

        for (const h of dayHourIndices) {
          const name = resolveUserName(
            assignments[p]?.[h] ?? null,
            p,
            h,
            userShiftData,
            customCellDisplayNames
          );
          if (name) {
            const timeRange = getTimeRange(hours, endTime, h, isWeekly);
            entries.push(`  ${timeRange}: ${name}`);
          }
        }

        if (entries.length > 0) {
          lines.push(isWeekly ? `  ${posts[p].value}` : posts[p].value);
          lines.push(...entries.map((e) => (isWeekly ? `  ${e}` : e)));
          lines.push("");
        }
      }
    }

    if (isWeekly) lines.push("");
  }

  return lines.join("\n").trimEnd();
}
