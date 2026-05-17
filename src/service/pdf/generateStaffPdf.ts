import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RosterState, UserShiftData } from "@/models";
import { getDaySlice, getDisplayTime } from "@/service/weeklyScheduleUtils";
import { getDayLabel, getTodayISO } from "@/service/dayLabelUtils";
import { registerFonts } from "./registerFonts";
import { processRtl, shapeHebrew } from "./rtlText";

interface StaffPdfOptions {
  staffName: string;
  staffId: string;
  rosters: RosterState[];
  userShiftData: UserShiftData[];
  locale: string;
}

interface StaffAssignment {
  day: string;
  post: string;
  time: string;
}

function getAssignmentsForStaff(
  roster: RosterState,
  staffId: string,
  locale: string
): StaffAssignment[] {
  const { posts, hours, assignments, scheduleMode, startDate, endTime, customCellDisplayNames } = roster;
  const isWeekly = scheduleMode === "7d";
  const numDays = isWeekly ? 7 : 1;
  const result: StaffAssignment[] = [];

  for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
    const slice = isWeekly
      ? getDaySlice(hours.length, dayIdx)
      : { start: 0, end: hours.length };
    const dayHourIndices = Array.from(
      { length: slice.end - slice.start },
      (_, i) => slice.start + i
    );

    const dayLabel = isWeekly
      ? getDayLabel(startDate || getTodayISO(), dayIdx, locale)
      : "";

    for (const hIdx of dayHourIndices) {
      for (let pIdx = 0; pIdx < posts.length; pIdx++) {
        const slotKey = `${pIdx}-${hIdx}`;
        const userId = assignments?.[pIdx]?.[hIdx];

        if (customCellDisplayNames?.[slotKey]) {
          continue;
        }

        if (userId === staffId) {
          const rawStart = hours[hIdx]?.value || "";
          const start = isWeekly ? getDisplayTime(rawStart) : rawStart;
          const rawEnd =
            hIdx + 1 < hours.length ? hours[hIdx + 1].value : endTime || "";
          const end = isWeekly ? getDisplayTime(rawEnd) : rawEnd;

          result.push({
            day: dayLabel,
            post: posts[pIdx].value,
            time: `${start}-${end}`,
          });
        }
      }
    }
  }

  return result;
}

export async function generateStaffPdf(options: StaffPdfOptions): Promise<Blob> {
  const { staffName, staffId, rosters, locale } = options;
  const isRtl = locale.startsWith("he");
  const shape = (text: string) => (isRtl ? processRtl(text) : shapeHebrew(text));

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await registerFonts(doc);

  const fontName = "NotoSans";

  // Title
  doc.setFontSize(16);
  doc.setFont(fontName, "bold");
  doc.text(shape(staffName), isRtl ? doc.internal.pageSize.width - 14 : 14, 18, {
    align: isRtl ? "right" : "left",
  });

  let yPos = 28;

  for (const roster of rosters) {
    const assignments = getAssignmentsForStaff(roster, staffId, locale);
    if (assignments.length === 0) continue;

    // Roster section header
    if (rosters.length > 1 && roster.name) {
      doc.setFontSize(12);
      doc.setFont(fontName, "bold");
      doc.text(
        shape(roster.name),
        isRtl ? doc.internal.pageSize.width - 14 : 14,
        yPos,
        { align: isRtl ? "right" : "left" }
      );
      yPos += 6;
    }

    const isWeekly = roster.scheduleMode === "7d";

    const head = isRtl
      ? isWeekly
        ? [[shape("שעות"), shape("תפקיד"), shape("יום")]]
        : [[shape("שעות"), shape("תפקיד")]]
      : isWeekly
        ? [[shape("Day"), shape("Post"), shape("Time")]]
        : [[shape("Post"), shape("Time")]];

    const body = assignments.map((a) =>
      isRtl
        ? isWeekly
          ? [shape(a.time), shape(a.post), shape(a.day)]
          : [shape(a.time), shape(a.post)]
        : isWeekly
          ? [shape(a.day), shape(a.post), shape(a.time)]
          : [shape(a.post), shape(a.time)]
    );

    autoTable(doc, {
      startY: yPos,
      head,
      body,
      styles: {
        fontSize: 10,
        cellPadding: 3,
        halign: isRtl ? "right" : "left",
        font: fontName,
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontStyle: "bold",
      },
      theme: "grid",
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable?.finalY + 10 || yPos + 40;
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setFont(fontName, "normal");
  doc.setTextColor(150);
  doc.text(
    shape("Powered by Tumbleweed"),
    doc.internal.pageSize.width / 2,
    pageHeight - 8,
    { align: "center" }
  );

  return doc.output("blob");
}
