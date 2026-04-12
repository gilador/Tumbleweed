import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RosterState, UserShiftData } from "@/models";
import { getDaySlice, getDisplayTime } from "@/service/weeklyScheduleUtils";
import { getDayLabel, getTodayISO } from "@/service/dayLabelUtils";
import { registerFonts } from "./registerFonts";
import { processRtl } from "./rtlText";

interface RosterPdfOptions {
  roster: RosterState;
  userShiftData: UserShiftData[];
  locale: string;
  rosterLabel?: string;
}

function resolveUserName(
  roster: RosterState,
  userShiftData: UserShiftData[],
  postIndex: number,
  hourIndex: number
): string {
  const slotKey = `${postIndex}-${hourIndex}`;
  if (roster.customCellDisplayNames?.[slotKey])
    return roster.customCellDisplayNames[slotKey];
  const userId = roster.assignments?.[postIndex]?.[hourIndex];
  if (!userId) return "\u2014";
  const user = userShiftData.find((u) => u.user.id === userId);
  return user?.user.name || "\u2014";
}

function getTimeRange(roster: RosterState, hourIndex: number): string {
  const { hours, endTime } = roster;
  const isWeekly = roster.scheduleMode === "7d";
  const rawStart = hours[hourIndex]?.value || "";
  const start = isWeekly ? getDisplayTime(rawStart) : rawStart;
  const rawEnd =
    hourIndex + 1 < hours.length ? hours[hourIndex + 1].value : endTime || "";
  const end = isWeekly ? getDisplayTime(rawEnd) : rawEnd;
  return `${start}-${end}`;
}

export async function generateRosterPdf(options: RosterPdfOptions): Promise<Blob> {
  const { roster, userShiftData, locale, rosterLabel } = options;
  const { posts, hours, scheduleMode, startDate } = roster;
  const isWeekly = scheduleMode === "7d";
  const numDays = isWeekly ? 7 : 1;
  const isRtl = locale.startsWith("he");
  const rtl = (text: string) => (isRtl ? processRtl(text) : text);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await registerFonts(doc);

  const fontName = "NotoSans";
  const title = rosterLabel || roster.name || "Schedule";

  for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
    if (dayIdx > 0) doc.addPage();

    const slice = isWeekly
      ? getDaySlice(hours.length, dayIdx)
      : { start: 0, end: hours.length };
    const dayHourIndices = Array.from(
      { length: slice.end - slice.start },
      (_, i) => slice.start + i
    );

    let yPos = 15;

    // Title
    doc.setFontSize(14);
    doc.setFont(fontName, "bold");
    const titleText = isWeekly
      ? rtl(`${title} — ${getDayLabel(startDate || getTodayISO(), dayIdx, locale)}`)
      : rtl(title);
    doc.text(titleText, isRtl ? doc.internal.pageSize.width - 14 : 14, yPos, {
      align: isRtl ? "right" : "left",
    });
    yPos += 10;

    // Build table data
    const timeHeaders = dayHourIndices.map((hIdx) => getTimeRange(roster, hIdx));
    const head = isRtl
      ? [[...timeHeaders.reverse(), rtl("תפקיד")]]
      : [["Post", ...timeHeaders]];

    const body = posts.map((post, pIdx) => {
      const cells = dayHourIndices.map((hIdx) =>
        rtl(resolveUserName(roster, userShiftData, pIdx, hIdx))
      );
      return isRtl
        ? [...cells.reverse(), rtl(post.value)]
        : [post.value, ...cells];
    });

    autoTable(doc, {
      startY: yPos,
      head,
      body,
      styles: {
        fontSize: 9,
        cellPadding: 3,
        halign: isRtl ? "right" : "center",
        font: fontName,
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: isRtl
        ? { [timeHeaders.length]: { fontStyle: "bold", halign: "right" } }
        : { 0: { fontStyle: "bold", halign: isRtl ? "right" : "left" } },
      theme: "grid",
      margin: { left: 14, right: 14 },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setFont(fontName, "normal");
    doc.setTextColor(150);
    doc.text("Powered by Tumbleweed", doc.internal.pageSize.width / 2, pageHeight - 8, {
      align: "center",
    });
    doc.setTextColor(0);
  }

  return doc.output("blob");
}
