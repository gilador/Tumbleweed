import { readFileSync } from "fs";
import { resolve } from "path";

// Source-shape regression guard for the removal of the standalone
// "Make All Available" header button and the rename of the Actions tab
// "Unavailable" twin to "All Unavailable". Jest is configured with
// testEnvironment: "node" so we read the component source as text and
// assert the structural invariants required by the task's acceptance
// criteria.

const HEATMAP_SRC = readFileSync(
  resolve(__dirname, "../AvailabilityHeatmap.tsx"),
  "utf8"
);

const EN_LOCALE = readFileSync(
  resolve(__dirname, "../../locales/en.json"),
  "utf8"
);

const HE_LOCALE = readFileSync(
  resolve(__dirname, "../../locales/he.json"),
  "utf8"
);

const REASSIGN_SHEET_SRC = readFileSync(
  resolve(__dirname, "../mobile/ReassignSheet.tsx"),
  "utf8"
);

describe("AvailabilityHeatmap actions — duplicate removal + rename", () => {
  it("removes the standalone 'Make All Available' header button (no t(\"makeAllAvailable\") reference)", () => {
    expect(HEATMAP_SRC).not.toMatch(/t\("makeAllAvailable"\)/);
  });

  it("Actions tab uses t(\"allUnavailable\") for the set-all-unavailable button", () => {
    const startIdx = HEATMAP_SRC.indexOf("handleSetAllAvailable(false)");
    expect(startIdx).toBeGreaterThan(-1);
    const endIdx = HEATMAP_SRC.indexOf("</Button>", startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);
    const slice = HEATMAP_SRC.slice(startIdx, endIdx);
    expect(slice).toMatch(/t\("allUnavailable"\)/);
    expect(slice).not.toMatch(/t\("unavailable"\)/);
  });

  it("Actions tab still uses t(\"allAvailable\") for the available twin (unchanged)", () => {
    const startIdx = HEATMAP_SRC.indexOf("handleSetAllAvailable(true)");
    expect(startIdx).toBeGreaterThan(-1);
    const endIdx = HEATMAP_SRC.indexOf("</Button>", startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);
    const slice = HEATMAP_SRC.slice(startIdx, endIdx);
    expect(slice).toMatch(/t\("allAvailable"\)/);
  });

  it("ReassignSheet retains t(\"unavailable\") — unrelated usage was not over-renamed", () => {
    expect(REASSIGN_SHEET_SRC).toMatch(/t\("unavailable"\)/);
  });

  it("makeAllAvailable key is removed from both locales", () => {
    expect(EN_LOCALE).not.toMatch(/"makeAllAvailable"/);
    expect(HE_LOCALE).not.toMatch(/"makeAllAvailable"/);
  });

  it("allUnavailable key exists in both locales with no trailing period", () => {
    expect(EN_LOCALE).toMatch(/"allUnavailable":\s*"All Unavailable"/);
    expect(HE_LOCALE).toMatch(/"allUnavailable":\s*"הכל לא זמין"/);
    expect(EN_LOCALE).not.toMatch(/"allUnavailable":\s*"[^"]*\.\s*"/);
    expect(HE_LOCALE).not.toMatch(/"allUnavailable":\s*"[^"]*\.\s*"/);
  });

  it("unavailable key is still present in both locales (used by ReassignSheet)", () => {
    expect(EN_LOCALE).toMatch(/"unavailable":\s*"Unavailable"/);
    expect(HE_LOCALE).toMatch(/"unavailable":\s*"לא זמין"/);
  });
});
