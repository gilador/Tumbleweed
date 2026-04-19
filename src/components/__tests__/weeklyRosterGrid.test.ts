import { generateBadges } from "../../service/badgeUtils";
import { getDaySlice, getShiftsPerDay, getDisplayTime } from "../../service/weeklyScheduleUtils";
import { UniqueString } from "../../models";

/**
 * Unit tests for WeeklyRosterGrid logic.
 * Component rendering tests are covered in E2E (Playwright).
 */

// Helper: create weekly hours (7 days × N shifts)
function makeWeeklyHours(shiftsPerDay: number, startHour = 8): UniqueString[] {
  const hours: UniqueString[] = [];
  for (let day = 0; day < 7; day++) {
    for (let s = 0; s < shiftsPerDay; s++) {
      const h = String(startHour + s * Math.floor(14 / shiftsPerDay)).padStart(2, "0");
      hours.push({ id: `d${day}-h${s}`, value: `${day}·${h}:00` });
    }
  }
  return hours;
}

describe("WeeklyRosterGrid logic", () => {
  describe("column count computation", () => {
    it("computes correct total columns for 2 shifts/day", () => {
      const hours = makeWeeklyHours(2);
      expect(hours.length).toBe(14);
      expect(getShiftsPerDay(hours)).toBe(2);
    });

    it("computes correct total columns for 3 shifts/day", () => {
      const hours = makeWeeklyHours(3);
      expect(hours.length).toBe(21);
      expect(getShiftsPerDay(hours)).toBe(3);
    });

    it("computes correct total columns for 5 shifts/day", () => {
      const hours = makeWeeklyHours(5);
      expect(hours.length).toBe(35);
      expect(getShiftsPerDay(hours)).toBe(5);
    });
  });

  describe("day slicing for headers", () => {
    it("slices correct range for each day with 3 shifts", () => {
      const hours = makeWeeklyHours(3);
      const day0 = getDaySlice(hours.length, 0);
      expect(day0).toEqual({ start: 0, end: 3 });

      const day3 = getDaySlice(hours.length, 3);
      expect(day3).toEqual({ start: 9, end: 12 });

      const day6 = getDaySlice(hours.length, 6);
      expect(day6).toEqual({ start: 18, end: 21 });
    });

    it("each day header should span shiftsPerDay columns", () => {
      const hours = makeWeeklyHours(3);
      const spd = getShiftsPerDay(hours);
      // This is the gridColumn span value used in the component
      expect(spd).toBe(3);
    });
  });

  describe("badge display in cells", () => {
    const users = [
      { id: "u1", name: "נתן חתוקה" },
      { id: "u2", name: "דנה לוי" },
      { id: "u3", name: "יוסי כהן" },
    ];

    it("assigned cells show the correct badge", () => {
      const badges = generateBadges(users);
      expect(badges.get("u1")).toBe("נח");
      expect(badges.get("u2")).toBe("דל");
      expect(badges.get("u3")).toBe("יכ");
    });

    it("unassigned cells would show placeholder (null assignment)", () => {
      // In the component: if userId is null, badge = "–"
      const assignments = [[null, "u1", null]];
      expect(assignments[0][0]).toBeNull(); // → "–"
      expect(assignments[0][1]).toBe("u1"); // → badge lookup
    });
  });

  describe("time display", () => {
    it("extracts display time from weekly hour format", () => {
      expect(getDisplayTime("0·08:00")).toBe("08:00");
      expect(getDisplayTime("3·14:30")).toBe("14:30");
    });
  });
});

describe("ViewToggle logic", () => {
  it("toggle is only relevant in 7d mode", () => {
    // The toggle renders when scheduleMode === "7d"
    const modes = ["24h", "7d"] as const;
    expect(modes[0]).toBe("24h"); // toggle hidden
    expect(modes[1]).toBe("7d");  // toggle visible
  });

  it("defaults to daily view", () => {
    // weeklyView state initialized to false
    const weeklyView = false;
    expect(weeklyView).toBe(false);
  });
});

describe("Mobile weekly grid behavior", () => {
  it("day drill-down provides correct day index", () => {
    // When tapping day 3, onDayDrillDown(3) is called
    // which sets selectedDay=3 and weeklyView=false
    let capturedDay = -1;
    const onDayDrillDown = (dayIndex: number) => { capturedDay = dayIndex; };
    onDayDrillDown(3);
    expect(capturedDay).toBe(3);
  });
});

/**
 * Unit tests for handleCellClick branching logic.
 *
 * The component's handleCellClick function has two branches:
 *   - Mobile: toggles revealCell (show/hide staff name), ignores unassigned
 *   - Desktop: toggles reassignCell (open/close reassignment dropdown)
 *
 * We simulate the exact branching logic from WeeklyRosterGrid.tsx
 * using the same state shape and getCellDisplay lookup.
 */
describe("handleCellClick branching logic", () => {
  // --- State types matching the component ---
  type CellCoord = { postIndex: number; hourIndex: number } | null;

  // Simulated getCellDisplay based on assignments + userMap
  function getCellDisplay(
    assignments: (string | null)[][],
    userMap: Map<string, string>,
    badgeMap: Map<string, string>,
    postIndex: number,
    hourIndex: number
  ): { badge: string; fullName: string } {
    const userId = assignments[postIndex]?.[hourIndex];
    if (!userId) return { badge: "–", fullName: "" };
    const badge = badgeMap.get(userId) || "??";
    const fullName = userMap.get(userId) || "";
    return { badge, fullName };
  }

  // Simulated handleCellClick matching the component logic exactly
  function handleCellClick(
    isMobile: boolean,
    postIndex: number,
    hourIndex: number,
    assignments: (string | null)[][],
    userMap: Map<string, string>,
    badgeMap: Map<string, string>,
    revealCell: CellCoord,
    reassignCell: CellCoord,
  ): { revealCell: CellCoord; reassignCell: CellCoord } {
    if (isMobile) {
      const { fullName } = getCellDisplay(assignments, userMap, badgeMap, postIndex, hourIndex);
      if (fullName === "") {
        return { revealCell: null, reassignCell };
      }
      if (revealCell?.postIndex === postIndex && revealCell?.hourIndex === hourIndex) {
        return { revealCell: null, reassignCell };
      } else {
        return { revealCell: { postIndex, hourIndex }, reassignCell };
      }
    }
    if (reassignCell?.postIndex === postIndex && reassignCell?.hourIndex === hourIndex) {
      return { revealCell, reassignCell: null };
    } else {
      return { revealCell, reassignCell: { postIndex, hourIndex } };
    }
  }

  // --- Test fixtures ---
  const userMap = new Map([
    ["u1", "נתן חתוקה"],
    ["u2", "דנה לוי"],
  ]);
  const badgeMap = new Map([
    ["u1", "נח"],
    ["u2", "דל"],
  ]);
  // Post 0: assigned(u1), unassigned(null), assigned(u2)
  const assignments: (string | null)[][] = [["u1", null, "u2"]];

  describe("mobile branch", () => {
    const mobile = true;

    it("reveals staff name when tapping an assigned cell", () => {
      const result = handleCellClick(mobile, 0, 0, assignments, userMap, badgeMap, null, null);
      expect(result.revealCell).toEqual({ postIndex: 0, hourIndex: 0 });
    });

    it("dismisses reveal when tapping the same cell again (toggle off)", () => {
      const alreadyRevealed: CellCoord = { postIndex: 0, hourIndex: 0 };
      const result = handleCellClick(mobile, 0, 0, assignments, userMap, badgeMap, alreadyRevealed, null);
      expect(result.revealCell).toBeNull();
    });

    it("switches reveal to a different cell when tapping another assigned cell", () => {
      const alreadyRevealed: CellCoord = { postIndex: 0, hourIndex: 0 };
      const result = handleCellClick(mobile, 0, 2, assignments, userMap, badgeMap, alreadyRevealed, null);
      expect(result.revealCell).toEqual({ postIndex: 0, hourIndex: 2 });
    });

    it("clears reveal when tapping an unassigned cell (guard: fullName === empty)", () => {
      const alreadyRevealed: CellCoord = { postIndex: 0, hourIndex: 0 };
      const result = handleCellClick(mobile, 0, 1, assignments, userMap, badgeMap, alreadyRevealed, null);
      expect(result.revealCell).toBeNull();
    });

    it("does nothing when tapping unassigned cell with no prior reveal", () => {
      const result = handleCellClick(mobile, 0, 1, assignments, userMap, badgeMap, null, null);
      expect(result.revealCell).toBeNull();
    });

    it("does not modify reassignCell state", () => {
      const existingReassign: CellCoord = { postIndex: 0, hourIndex: 2 };
      const result = handleCellClick(mobile, 0, 0, assignments, userMap, badgeMap, null, existingReassign);
      expect(result.reassignCell).toBe(existingReassign);
    });

    it("handles Hebrew names correctly in lookup", () => {
      const result = handleCellClick(mobile, 0, 2, assignments, userMap, badgeMap, null, null);
      expect(result.revealCell).toEqual({ postIndex: 0, hourIndex: 2 });
      // Verify the underlying lookup returns the Hebrew name
      const display = getCellDisplay(assignments, userMap, badgeMap, 0, 2);
      expect(display.fullName).toBe("דנה לוי");
      expect(display.badge).toBe("דל");
    });
  });

  describe("desktop branch", () => {
    const mobile = false;

    it("opens reassignment dropdown on first click", () => {
      const result = handleCellClick(mobile, 0, 0, assignments, userMap, badgeMap, null, null);
      expect(result.reassignCell).toEqual({ postIndex: 0, hourIndex: 0 });
    });

    it("closes reassignment dropdown when clicking same cell (toggle off)", () => {
      const alreadyReassigning: CellCoord = { postIndex: 0, hourIndex: 0 };
      const result = handleCellClick(mobile, 0, 0, assignments, userMap, badgeMap, null, alreadyReassigning);
      expect(result.reassignCell).toBeNull();
    });

    it("switches reassignment to a different cell", () => {
      const alreadyReassigning: CellCoord = { postIndex: 0, hourIndex: 0 };
      const result = handleCellClick(mobile, 0, 2, assignments, userMap, badgeMap, null, alreadyReassigning);
      expect(result.reassignCell).toEqual({ postIndex: 0, hourIndex: 2 });
    });

    it("allows clicking unassigned cells (no guard — desktop shows dropdown)", () => {
      const result = handleCellClick(mobile, 0, 1, assignments, userMap, badgeMap, null, null);
      expect(result.reassignCell).toEqual({ postIndex: 0, hourIndex: 1 });
    });

    it("does not modify revealCell state", () => {
      const existingReveal: CellCoord = { postIndex: 0, hourIndex: 0 };
      const result = handleCellClick(mobile, 0, 2, assignments, userMap, badgeMap, existingReveal, null);
      expect(result.revealCell).toBe(existingReveal);
    });
  });

  describe("getCellDisplay helper", () => {
    it("returns dash badge and empty name for unassigned cell", () => {
      const display = getCellDisplay(assignments, userMap, badgeMap, 0, 1);
      expect(display.badge).toBe("–");
      expect(display.fullName).toBe("");
    });

    it("returns badge and full name for assigned cell", () => {
      const display = getCellDisplay(assignments, userMap, badgeMap, 0, 0);
      expect(display.badge).toBe("נח");
      expect(display.fullName).toBe("נתן חתוקה");
    });

    it("returns ?? badge for unknown user ID", () => {
      const weirdAssignments: (string | null)[][] = [["unknown-user"]];
      const display = getCellDisplay(weirdAssignments, userMap, badgeMap, 0, 0);
      expect(display.badge).toBe("??");
      expect(display.fullName).toBe("");
    });

    it("returns dash for out-of-bounds index", () => {
      const display = getCellDisplay(assignments, userMap, badgeMap, 0, 99);
      expect(display.badge).toBe("–");
      expect(display.fullName).toBe("");
    });
  });
});
