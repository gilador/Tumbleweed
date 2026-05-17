import type { MultiSelectKind } from "../stores/selectionStore";

/** Compute which staff IDs the heatmap should drive itself by.
 * Multi-staff selection wins; falls back to single-staff selection;
 * empty otherwise. Posts-kind multi never resolves to staff IDs.
 */
export function getActiveStaffIds(
  multiSelected: Set<string> | null,
  multiSelectKind: MultiSelectKind | null,
  selectedStaffId: string | null
): string[] {
  if (multiSelectKind === "staff" && multiSelected) {
    return Array.from(multiSelected);
  }
  if (selectedStaffId !== null) return [selectedStaffId];
  return [];
}
