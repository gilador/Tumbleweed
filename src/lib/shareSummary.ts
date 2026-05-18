import type { RosterState, UserShiftData } from "@/models";
import { generateTextSummary } from "@/service/textSummary";

export function buildScheduleShareText(
  rosters: RosterState[],
  userShiftData: UserShiftData[],
  locale: string
): string {
  if (rosters.length === 0) return "";
  const sections = rosters.map((roster) =>
    generateTextSummary({
      posts: roster.posts,
      hours: roster.hours,
      assignments: roster.assignments,
      userShiftData,
      endTime: roster.endTime,
      customCellDisplayNames: roster.customCellDisplayNames,
      groupBy: "time",
      scheduleMode: roster.scheduleMode,
      startDate: roster.startDate,
      locale,
    })
  );
  return sections.join("\n\n");
}
