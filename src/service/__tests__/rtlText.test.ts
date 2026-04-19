import { processRtl } from "@/service/pdf/rtlText";

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
