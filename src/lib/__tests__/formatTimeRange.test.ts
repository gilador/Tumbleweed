import { formatTimeRange } from "../formatTimeRange";

// Note: the asserted strings below are SOURCE strings. When rendered inside a
// dir="rtl" container, the Unicode bidirectional algorithm positionally
// reverses the digit runs, so source `"00:00 ← 03:00"` displays visually as
// `"03:00 ← 00:00"` (leftmost = end, rightmost = start). Do not "fix" the
// operand order to look right in source — that breaks the visual rendering.

describe("formatTimeRange", () => {
  it("LTR: returns 'start → end'", () => {
    expect(formatTimeRange("00:00", "03:00", "ltr")).toBe("00:00 → 03:00");
  });

  it("RTL: keeps operand order, flips arrow (visual order from bidi)", () => {
    expect(formatTimeRange("00:00", "03:00", "rtl")).toBe("00:00 ← 03:00");
  });

  it("LTR open-ended: trailing arrow", () => {
    expect(formatTimeRange("23:00", undefined, "ltr")).toBe("23:00 →");
  });

  it("RTL open-ended: trailing left arrow (renders leading via bidi)", () => {
    expect(formatTimeRange("23:00", undefined, "rtl")).toBe("23:00 ←");
  });
});
