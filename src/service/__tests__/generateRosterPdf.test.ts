import type { RosterState, UserShiftData } from "@/models";
import { processRtl } from "@/service/pdf/rtlText";

// Capture calls to doc.text()
const textCalls: [string, number, number][] = [];
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
};

jest.mock("jspdf", () => ({
  __esModule: true,
  default: jest.fn(() => mockDoc),
}));

jest.mock("jspdf-autotable", () => ({
  __esModule: true,
  default: jest.fn(),
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
