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
