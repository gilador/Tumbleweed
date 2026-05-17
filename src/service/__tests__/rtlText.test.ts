import { processRtl, shapeHebrew } from "@/service/pdf/rtlText";

describe("processRtl", () => {
  it("returns empty string unchanged", () => {
    expect(processRtl("")).toBe("");
  });

  it("returns non-Hebrew text unchanged", () => {
    expect(processRtl("Hello")).toBe("Hello");
  });

  it("reverses pure Hebrew string", () => {
    expect(processRtl("דני")).toBe("ינד");
  });

  it("handles Hebrew followed by a number", () => {
    expect(processRtl("תחנה 3")).toBe(" 3הנחת");
  });

  it("handles Latin followed by Hebrew", () => {
    expect(processRtl("Bar מנהל")).toBe("להנמBar ");
  });

  it("handles multi-word Hebrew name", () => {
    // BUG: spaces between Hebrew words form separate non-Hebrew runs
    // instead of joining the adjacent Hebrew run (see rtlText.ts:35 comment).
    // The visual output is coincidentally correct for jsPDF because reversing
    // run order also reverses word order, but the run segmentation is wrong.
    // Tracked as a known issue -- do not fix in this task.
    expect(processRtl("יוסף בן דוד")).toBe("דוד ןב ףסוי");
  });
});

describe("shapeHebrew", () => {
  it("returns empty string unchanged", () => {
    expect(shapeHebrew("")).toBe("");
  });

  it("returns non-Hebrew text unchanged (fast path)", () => {
    const input = "Hello 123";
    expect(shapeHebrew(input)).toBe(input);
  });

  it("reverses pure Hebrew string in place", () => {
    expect(shapeHebrew("דני")).toBe("ינד");
  });

  it("reverses Hebrew run but keeps trailing digits in original LTR position", () => {
    // logical "עובד 1" -> shaped "דבוע 1": Hebrew run reversed in place,
    // the " 1" non-Hebrew run stays put on the right (LTR document flow).
    expect(shapeHebrew("עובד 1")).toBe("דבוע 1");
  });

  it("handles Latin + Hebrew in LTR context", () => {
    expect(shapeHebrew("Bar מנהל")).toBe("Bar להנמ");
  });

  it("pins real-world weekly title shape (Hebrew title + em-dash + date range)", () => {
    expect(shapeHebrew("סידור — 11.04-17.04")).toBe("רודיס — 11.04-17.04");
  });

  it("pins the known multi-word Hebrew spacing quirk (pre-existing bug, tracked)", () => {
    // spaces between Hebrew words form a non-Hebrew run; each word reversed
    // in place, word order preserved. Tracked as an out-of-scope bug.
    expect(shapeHebrew("יוסף בן דוד")).toBe("ףסוי ןב דוד");
  });

  it("handles mixed Hebrew + Latin + digits in a single cell", () => {
    // AC: "mixed Hebrew + Latin + digits in a single cell renders correctly"
    // runs: ["עובד", " Main 1"] -> ["דבוע", " Main 1"] -> "דבוע Main 1"
    // Hebrew word reversed in place; Latin+digits segment preserved in LTR order.
    expect(shapeHebrew("עובד Main 1")).toBe("דבוע Main 1");
  });
});
