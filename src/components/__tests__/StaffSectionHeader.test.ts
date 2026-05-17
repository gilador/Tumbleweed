import { readFileSync } from "fs";
import { resolve } from "path";

// Regression guard for the "staff bulk-selection bar inline" fix.
//
// Limitation: Jest is configured with testEnvironment: "node" (see
// packages/core/jest.config.cjs) and the project does not render React in
// unit tests. Real DOM cannot be measured here. This test reads the
// component source as text and asserts the structural invariants required
// by the task's acceptance criteria — namely that the [reset][+Add]
// buttons and the <BulkSelectionBar /> share a single flex row marked
// with data-testid="staff-controls-row" (rather than the bar living in a
// separate sibling banner). Visual / E2E coverage of the rendered layout
// is the appropriate complement; this test guards against accidental
// drift back to the banner-style layout.

const HEADER_SRC = readFileSync(
  resolve(__dirname, "../StaffSectionHeader.tsx"),
  "utf8"
);

describe("StaffSectionHeader inline bulk-selection layout", () => {
  it("renders a single shared controls row with data-testid=\"staff-controls-row\"", () => {
    expect(HEADER_SRC).toMatch(/data-testid="staff-controls-row"/);
  });

  it("places the +Add button and BulkSelectionBar inside the same controls row", () => {
    const rowStartIdx = HEADER_SRC.indexOf(
      'data-testid="staff-controls-row"'
    );
    expect(rowStartIdx).toBeGreaterThan(-1);

    // After the reset button + dialog were relocated to AvailabilityHeatmap,
    // the controls row is followed only by the closing fragment `</>`.
    const dialogIdx = HEADER_SRC.indexOf("<Dialog", rowStartIdx);
    const fragmentIdx = HEADER_SRC.indexOf("</>", rowStartIdx);
    const endCandidates = [dialogIdx, fragmentIdx].filter((i) => i > -1);
    const endIdx = Math.min(...endCandidates);
    const rowSource = HEADER_SRC.slice(rowStartIdx, endIdx);

    // +Add button
    expect(rowSource).toMatch(/addUserShort/);
    // bulk selection bar mounted inline
    expect(rowSource).toMatch(/<BulkSelectionBar[\s\S]*?inline[\s\S]*?\/>/);
  });

  it("no longer renders the reset-availability icon button or its dialog", () => {
    expect(HEADER_SRC).not.toMatch(/IconRestore/);
    expect(HEADER_SRC).not.toMatch(/resetAllUserAvailability/);
    expect(HEADER_SRC).not.toMatch(/onResetAllAvailability/);
  });

  it("uses inline mode for BulkSelectionBar so it does not render as a banner", () => {
    expect(HEADER_SRC).toMatch(/<BulkSelectionBar[\s\S]*?\binline\b[\s\S]*?\/>/);
    // The previous banner wrapper (a div whose only child was BulkSelectionBar
    // with `mb-2`) must be gone.
    expect(HEADER_SRC).not.toMatch(
      /<div\s+className="mb-2">\s*<BulkSelectionBar/
    );
  });

  it("does not push the controls cluster with ms-auto on the title row anymore", () => {
    // The controls row owns its own line; the title row no longer carries
    // an ms-auto cluster of buttons.
    expect(HEADER_SRC).not.toMatch(/ms-auto[\s\S]*?addUserShort/);
  });
});
