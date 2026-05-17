jest.mock("../../lib/analytics", () => ({
  trackEvent: jest.fn(),
}));

import { formatOptimizationDuration } from "../useShiftOptimization";

describe("formatOptimizationDuration", () => {
  it("formats 0ms as '0ms'", () => {
    expect(formatOptimizationDuration(0)).toBe("0ms");
  });

  it("formats sub-second durations with ms precision", () => {
    expect(formatOptimizationDuration(320)).toBe("320ms");
    expect(formatOptimizationDuration(999)).toBe("999ms");
  });

  it("clamps negative durations to 0ms", () => {
    expect(formatOptimizationDuration(-50)).toBe("0ms");
  });

  it("formats the 1000ms boundary as '1.0s'", () => {
    expect(formatOptimizationDuration(1000)).toBe("1.0s");
  });

  it("formats seconds with one decimal", () => {
    expect(formatOptimizationDuration(1050)).toBe("1.1s");
    expect(formatOptimizationDuration(1249)).toBe("1.2s");
  });

  it("formats the 59999ms boundary as '60.0s'", () => {
    expect(formatOptimizationDuration(59999)).toBe("60.0s");
  });

  it("formats the 60000ms boundary as '1m 0s'", () => {
    expect(formatOptimizationDuration(60000)).toBe("1m 0s");
  });

  it("rounds seconds inside the minutes tier", () => {
    expect(formatOptimizationDuration(61500)).toBe("1m 2s");
  });

  it("re-distributes when rounded seconds would equal 60", () => {
    // 119500ms → 120s total → 2m 0s (avoids degenerate '1m 60s')
    expect(formatOptimizationDuration(119500)).toBe("2m 0s");
  });

  it("formats large minute durations", () => {
    expect(formatOptimizationDuration(185000)).toBe("3m 5s");
  });

  it("produces an LTR-safe atomic token when wrapped in parens for RTL interpolation", () => {
    const formatted = `(${formatOptimizationDuration(1200)})`;
    expect(formatted).toBe("(1.2s)");
    // Simulating the Hebrew template interpolation in i18next
    const hebrewTemplate = "שיבוצי המשמרות אופטמו בהצלחה {{duration}}";
    const interpolated = hebrewTemplate.replace("{{duration}}", formatted);
    expect(interpolated).toBe("שיבוצי המשמרות אופטמו בהצלחה (1.2s)");
    expect(interpolated.includes(formatted)).toBe(true);
  });
});
