import type { RosterState } from "@/models";
import { processRtl } from "@/service/pdf/rtlText";

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
  internal: { pageSize: { width: 210, height: 297 } },
  addFileToVFS: jest.fn(),
  addFont: jest.fn(),
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

import { generateStaffPdf } from "../pdf/generateStaffPdf";

const baseRoster: RosterState = {
  id: "r1",
  name: "משמרת בוקר",
  posts: [{ id: "p1", value: "בר" }],
  hours: [{ id: "h1", value: "08:00" }],
  endTime: "18:00",
  assignments: [["staff-1"]],
  scheduleMode: "24h",
  startDate: null,
  manuallyEditedSlots: {},
  customCellDisplayNames: {},
  startTime: "08:00",
  cachedWeeklyState: null,
} as RosterState;

beforeEach(() => {
  textCalls.length = 0;
  autoTableCalls.length = 0;
  jest.clearAllMocks();
});

describe("generateStaffPdf (Hebrew)", () => {
  it("passes Hebrew staff name through processRtl to doc.text()", async () => {
    await generateStaffPdf({
      staffName: "דני",
      staffId: "staff-1",
      rosters: [baseRoster],
      userShiftData: [],
      locale: "he-IL",
    });

    // First text() call is the title (staff name)
    const titleCall = textCalls[0];
    expect(titleCall[0]).toBe(processRtl("דני")); // "ינד"
  });

  it("passes Hebrew post names through processRtl in table data", async () => {
    await generateStaffPdf({
      staffName: "דני",
      staffId: "staff-1",
      rosters: [baseRoster],
      userShiftData: [],
      locale: "he-IL",
    });

    // autoTable should be called with Hebrew header/body values processed through processRtl
    expect(autoTableCalls.length).toBeGreaterThan(0);
    const tableOpts = autoTableCalls[0] as {
      head: string[][];
      body: string[][];
    };

    // For 24h mode + RTL: head is [[rtl("שעות"), rtl("תפקיד")]]
    expect(tableOpts.head[0]).toContain(processRtl("שעות"));
    expect(tableOpts.head[0]).toContain(processRtl("תפקיד"));

    // Body should contain the processed post name
    const flatBody = tableOpts.body.flat();
    expect(flatBody).toContain(processRtl("בר"));
  });

  // NOTE: With a single roster, the roster name header at generateStaffPdf.ts:99
  // is not rendered because that branch requires `rosters.length > 1`.
  it("returns a Blob without throwing", async () => {
    const result = await generateStaffPdf({
      staffName: "דני",
      staffId: "staff-1",
      rosters: [baseRoster],
      userShiftData: [],
      locale: "he-IL",
    });

    expect(result).toBeInstanceOf(Blob);
    expect(mockDoc.output).toHaveBeenCalledWith("blob");
  });
});
