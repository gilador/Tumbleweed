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

function getDateRangeLabel(startDate: string): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}`;
  };
  return `${fmt(start)}-${fmt(end)}`;
}

export function getRosterPdfFilename(roster: RosterState): string {
  const name = roster.name || "roster";
  if (roster.scheduleMode === "7d" && roster.startDate) {
    const range = getDateRangeLabel(roster.startDate);
    return `${name} — ${range}.pdf`;
  }
  return `${name}.pdf`;
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
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const marginBottom = 16;

  // For weekly: print title once at top, then stack all day tables
  if (isWeekly) {
    let yPos = 15;

    // Main title with date range
    doc.setFontSize(14);
    doc.setFont(fontName, "bold");
    const dateRange = startDate
      ? getDateRangeLabel(startDate)
      : "";
    const titleText = rtl(dateRange ? `${title} — ${dateRange}` : title);
    doc.text(titleText, isRtl ? pageWidth - 14 : 14, yPos, {
      align: isRtl ? "right" : "left",
    });
    yPos += 8;

    for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
      const slice = getDaySlice(hours.length, dayIdx);
      const dayHourIndices = Array.from(
        { length: slice.end - slice.start },
        (_, i) => slice.start + i
      );

      // Estimate table height: header row + data rows, ~7mm each
      const estimatedHeight = (posts.length + 1) * 7 + 10;

      // Check if we need a new page
      if (yPos + estimatedHeight > pageHeight - marginBottom) {
        // Footer on current page
        doc.setFontSize(8);
        doc.setFont(fontName, "normal");
        doc.setTextColor(150);
        doc.text("Powered by Tumbleweed", pageWidth / 2, pageHeight - 8, { align: "center" });
        doc.setTextColor(0);
        doc.addPage();
        yPos = 15;
      }

      // Day sub-header
      doc.setFontSize(10);
      doc.setFont(fontName, "bold");
      const dayLabel = rtl(getDayLabel(startDate || getTodayISO(), dayIdx, locale));
      doc.text(dayLabel, isRtl ? pageWidth - 14 : 14, yPos, {
        align: isRtl ? "right" : "left",
      });
      yPos += 5;

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
          fontSize: 8,
          cellPadding: 2,
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

      // Get Y position after table
      yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    // Footer on last page
    doc.setFontSize(8);
    doc.setFont(fontName, "normal");
    doc.setTextColor(150);
    doc.text("Powered by Tumbleweed", pageWidth / 2, pageHeight - 8, { align: "center" });
    doc.setTextColor(0);
  } else {
    // Single-day mode: one table, same as before
    let yPos = 15;
    const dayHourIndices = Array.from({ length: hours.length }, (_, i) => i);

    doc.setFontSize(14);
    doc.setFont(fontName, "bold");
    doc.text(rtl(title), isRtl ? pageWidth - 14 : 14, yPos, {
      align: isRtl ? "right" : "left",
    });
    yPos += 10;

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

    doc.setFontSize(8);
    doc.setFont(fontName, "normal");
    doc.setTextColor(150);
    doc.text("Powered by Tumbleweed", pageWidth / 2, pageHeight - 8, { align: "center" });
    doc.setTextColor(0);
  }

  return doc.output("blob");
}
