import type { RosterState, UserShiftData } from "@/models";
import { processRtl, shapeHebrew } from "@/service/pdf/rtlText";

// Capture calls to doc.text()
const textCalls: [string, number, number][] = [];
// Capture calls to autoTable
const autoTableCalls: unknown[] = [];
const mockDoc = {
  setFontSize: jest.fn(),
  setFont: jest.fn(),
  setTextColor: jest.fn(),
  text: jest.fn((...args: unknown[]) => {
    textCalls.push(args as [string, number, number]);
  }),
  addPage: jest.fn(),
  output: jest.fn(() => new Blob()),
  internal: { pageSize: { width: 297, height: 210 } },
  addFileToVFS: jest.fn(),
  addFont: jest.fn(),
  lastAutoTable: { finalY: 30 },
};

jest.mock("jspdf", () => ({
  __esModule: true,
  default: jest.fn(() => mockDoc),
}));

jest.mock("jspdf-autotable", () => ({
  __esModule: true,
  default: jest.fn((_doc: unknown, opts: unknown) => {
    autoTableCalls.push(opts);
  }),
}));

jest.mock("@/service/pdf/registerFonts", () => ({
  registerFonts: jest.fn(),
}));

import { generateRosterPdf } from "../pdf/generateRosterPdf";

const baseRoster: RosterState = {
  id: "r1",
  name: "",
  posts: [{ id: "p1", value: "Bar" }],
  hours: [{ id: "h1", value: "08:00" }],
  endTime: "18:00",
  assignments: [[null]],
  scheduleMode: "1d",
  startDate: "2026-01-01",
} as unknown as RosterState;

const userShiftData: UserShiftData[] = [];

beforeEach(() => {
  textCalls.length = 0;
  autoTableCalls.length = 0;
  jest.clearAllMocks();
});

describe("generateRosterPdf title", () => {
  it("uses rosterLabel as fallback when roster.name is empty (Hebrew locale)", async () => {
    await generateRosterPdf({
      roster: { ...baseRoster, name: "" },
      userShiftData,
      locale: "he-IL",
      rosterLabel: "סידור",
    });

    // The first text() call is the title
    const titleCall = textCalls[0];
    expect(titleCall[0]).not.toBe("Schedule");
    // processRtl reverses Hebrew for jsPDF rendering
    expect(titleCall[0]).toContain(processRtl("סידור"));
  });

  it("uses roster.name when available, ignoring rosterLabel", async () => {
    await generateRosterPdf({
      roster: { ...baseRoster, name: "Morning Shift" },
      userShiftData,
      locale: "he-IL",
      rosterLabel: "סידור",
    });

    const titleCall = textCalls[0];
    expect(titleCall[0]).toContain("Morning Shift");
  });

  it("falls back to 'Schedule' when neither roster.name nor rosterLabel provided", async () => {
    await generateRosterPdf({
      roster: { ...baseRoster, name: "" },
      userShiftData,
      locale: "en-US",
    });

    const titleCall = textCalls[0];
    expect(titleCall[0]).toBe("Schedule");
  });
});

describe("generateRosterPdf EN locale with Hebrew cell content", () => {
  it("shapes Hebrew custom cell names in en locale without reversing run order", async () => {
    await generateRosterPdf({
      roster: {
        ...baseRoster,
        customCellDisplayNames: { "0-0": "עובד 1" },
      } as unknown as RosterState,
      userShiftData,
      locale: "en-US",
    });

    expect(autoTableCalls.length).toBeGreaterThan(0);
    const opts = autoTableCalls[0] as { head: string[][]; body: string[][] };
    // en locale single-day: first body col is post.value, second is the cell
    expect(opts.body[0][1]).toBe(shapeHebrew("עובד 1"));
    // head should not contain reversed run-order (no Hebrew → identity)
    expect(opts.head[0][0]).toBe("Post");
  });

  it("preserves RTL behavior for the same input in he locale", async () => {
    await generateRosterPdf({
      roster: {
        ...baseRoster,
        customCellDisplayNames: { "0-0": "עובד 1" },
      } as unknown as RosterState,
      userShiftData,
      locale: "he-IL",
    });

    const opts = autoTableCalls[0] as { body: string[][] };
    // he locale single-day: RTL column flip — cell at body[0][0], post at body[0][1]
    expect(opts.body[0][0]).toBe(processRtl("עובד 1"));
  });

  it("shapes Hebrew cell content in en locale weekly (7d) path", async () => {
    // AC: "fix applies to weekly AND single-day export paths"
    // Weekly mode requires hours.length divisible by 7 (getDaySlice divides evenly).
    const weeklyHours = Array.from({ length: 7 }, (_, i) => ({
      id: `h${i}`,
      value: `${String(8 + i).padStart(2, "0")}:00`,
    }));
    const weeklyAssignments = [Array.from({ length: 7 }, () => null)];
    await generateRosterPdf({
      roster: {
        ...baseRoster,
        scheduleMode: "7d",
        startDate: "2026-01-05",
        hours: weeklyHours,
        assignments: weeklyAssignments,
        customCellDisplayNames: { "0-0": "עובד 1" },
      } as unknown as RosterState,
      userShiftData,
      locale: "en-US",
    });

    // Weekly path emits one autoTable per day. Day 0's first cell (hourIndex 0)
    // must carry the shaped Hebrew cell content in the en branch.
    expect(autoTableCalls.length).toBeGreaterThanOrEqual(1);
    const day0 = autoTableCalls[0] as { head: string[][]; body: string[][] };
    // en weekly: body[row][0] is post.value, body[row][1] is the first hour cell
    expect(day0.body[0][1]).toBe(shapeHebrew("עובד 1"));
    // head first column is the literal "Post" (no Hebrew → identity)
    expect(day0.head[0][0]).toBe("Post");
  });
});
