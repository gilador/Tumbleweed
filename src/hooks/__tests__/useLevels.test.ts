import { shouldAutoApplyLevel } from "../useLevels";
import { ShiftLevel } from "../../service/shiftLevels";

const feasibleLevel: ShiftLevel = {
  shifts: 3,
  duration: 200 / 60,
  feasible: true,
  neededSlots: 3,
  availableSlots: 4,
  shiftsPerWorker: 2,
  workHours: 6,
  restBetween: 3,
};

describe("shouldAutoApplyLevel", () => {
  it("returns false when optimizationSignature is set (optimizer just ran)", () => {
    expect(
      shouldAutoApplyLevel(feasibleLevel, 1, 2, 2, "some-signature", "24h")
    ).toBe(false);
  });

  it("returns true when hour count differs and no optimization signature in 24h mode", () => {
    expect(
      shouldAutoApplyLevel(feasibleLevel, 1, 2, 2, null, "24h")
    ).toBe(true);
  });

  it("returns false when hour count already matches selected level", () => {
    expect(
      shouldAutoApplyLevel(feasibleLevel, 1, 2, 3, null, "24h")
    ).toBe(false);
  });

  it("returns false when no selected level", () => {
    expect(shouldAutoApplyLevel(null, 1, 2, 2, null, "24h")).toBe(false);
  });

  it("returns false when posts is 0", () => {
    expect(shouldAutoApplyLevel(feasibleLevel, 0, 2, 2, null, "24h")).toBe(false);
  });

  it("returns false when staff is 0", () => {
    expect(shouldAutoApplyLevel(feasibleLevel, 1, 0, 2, null, "24h")).toBe(false);
  });

  it("returns false in 7d mode (hours managed by useScheduleMode)", () => {
    // Bug case: in 7D mode, useLevels generates single-day hours that
    // overwrite the 7-day weekly hours, causing 0 shifts to display.
    expect(
      shouldAutoApplyLevel(feasibleLevel, 2, 20, 7, null, "7d")
    ).toBe(false);
  });
});
