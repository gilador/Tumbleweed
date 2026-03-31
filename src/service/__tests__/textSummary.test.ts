import { generateTextSummary } from "../textSummary";
import type { UniqueString, UserShiftData } from "../../models";

const posts: UniqueString[] = [
  { id: "p1", value: "כניסה" },
  { id: "p2", value: "בר" },
];

const hours: UniqueString[] = [
  { id: "h1", value: "08:00" },
  { id: "h2", value: "10:00" },
  { id: "h3", value: "12:00" },
];

const userShiftData: UserShiftData[] = [
  { user: { id: "u1", name: "דני" }, constraints: [], totalAssignments: 0 },
  { user: { id: "u2", name: "יוסי" }, constraints: [], totalAssignments: 0 },
  { user: { id: "u3", name: "מיכל" }, constraints: [], totalAssignments: 0 },
];

// assignments[postIndex][hourIndex] = userId
const assignments: (string | null)[][] = [
  ["u1", "u2", "u3"], // כניסה
  ["u3", null, "u1"], // בר
];

const baseOpts = {
  posts,
  hours,
  assignments,
  userShiftData,
  endTime: "14:00",
  customCellDisplayNames: {},
  date: "18/03/2026",
};

describe("generateTextSummary", () => {
  it("generates summary grouped by time", () => {
    const result = generateTextSummary({ ...baseOpts, groupBy: "time" });

    expect(result).toContain("Shift Schedule — 18/03/2026");
    expect(result).toContain("08:00-10:00");
    expect(result).toContain("  כניסה: דני");
    expect(result).toContain("  בר: מיכל");
    expect(result).toContain("10:00-12:00");
    expect(result).toContain("  כניסה: יוסי");
    // בר at 10:00 is null — should not appear
    expect(result).not.toContain("10:00-12:00\n  בר:");
  });

  it("generates summary grouped by post", () => {
    const result = generateTextSummary({ ...baseOpts, groupBy: "post" });

    expect(result).toContain("Shift Schedule — 18/03/2026");
    expect(result).toContain("כניסה");
    expect(result).toContain("  08:00-10:00: דני");
    expect(result).toContain("  10:00-12:00: יוסי");
    expect(result).toContain("בר");
    expect(result).toContain("  08:00-10:00: מיכל");
    expect(result).toContain("  12:00-14:00: דני");
  });

  it("respects customCellDisplayNames", () => {
    const result = generateTextSummary({
      ...baseOpts,
      groupBy: "time",
      customCellDisplayNames: { "0-0": "מנהל משמרת" },
    });

    // slot 0-0 = כניסה at 08:00, should show custom name instead of דני
    expect(result).toContain("  כניסה: מנהל משמרת");
  });

  it("omits unassigned slots", () => {
    const emptyAssignments: (string | null)[][] = [
      [null, null, null],
      [null, null, null],
    ];
    const result = generateTextSummary({
      ...baseOpts,
      assignments: emptyAssignments,
      groupBy: "time",
    });

    // Should only have the header
    expect(result).toBe("Shift Schedule — 18/03/2026");
  });

  it("uses today's date when no date provided", () => {
    const result = generateTextSummary({
      ...baseOpts,
      date: undefined,
      groupBy: "time",
    });

    // Should contain a date in DD/MM/YYYY format
    expect(result).toMatch(/Shift Schedule — \d{2}\/\d{2}\/\d{4}/);
  });
});
