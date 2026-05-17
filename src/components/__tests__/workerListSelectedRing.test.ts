import { readFileSync } from "fs";
import { resolve } from "path";
import { isMultiCheckedPure, type MultiSelectState } from "../../stores/selectionStore";

// Round-4/5 regression guard for the CEO directive: the staff list's row ring
// must be driven only by the "checked" state (via `isMultiCheckedPure` /
// `checkedUserIds.includes(user.id)`), never by the orthogonal viewing-
// selection (`selectedUserId`). Two layers of assertion:
//
//   1) Behavioral: the predicate that drives `isChecked` (which feeds
//      `isHighlighted`) must return the right answer for the Recoil
//      `multiSelectState` shape used by `WorkerList`'s consumers.
//   2) Source-shape: the row's `isHighlighted` derivation in
//      `WorkerList.tsx` must equal `isChecked` and must NOT include
//      `isSelected`. This package's Jest config runs in `node` env (see
//      `jest.config.cjs`) and forbids new deps, so we cannot mount the
//      component in a JSDOM tree to assert classNames at runtime; the
//      source-shape layer is the closest available proxy.
//
// The behavioral layer would catch a logic regression in the predicate;
// the source-shape layer would catch someone re-introducing a row-level
// `isSelected` term into the className conditional.

describe("WorkerList ring is driven only by checked state", () => {
  describe("predicate behavior (isMultiCheckedPure)", () => {
    it("returns true when the user is in the staff multi-set", () => {
      const state: MultiSelectState = { ids: new Set(["u1"]), kind: "staff" };
      expect(isMultiCheckedPure(state, "u1")).toBe(true);
    });

    it("returns false when the user is NOT in the staff multi-set", () => {
      const state: MultiSelectState = { ids: new Set(["other"]), kind: "staff" };
      expect(isMultiCheckedPure(state, "u1")).toBe(false);
    });

    it("returns false when there is no multi-select active (only viewing-selection)", () => {
      // This is the round-5 invariant: selectedUserId being set must NOT
      // make a row "checked" — the row only highlights when checked.
      expect(isMultiCheckedPure(null, "u1")).toBe(false);
    });
  });

  describe("source-shape regression (WorkerList.tsx)", () => {
    const SOURCE = readFileSync(
      resolve(__dirname, "../../components/WorkerList.tsx"),
      "utf8"
    );

    it("derives isHighlighted purely from isChecked (no isSelected term)", () => {
      expect(SOURCE).toMatch(/isHighlighted\s*=\s*isChecked\b/);
      expect(SOURCE).not.toMatch(/isHighlighted\s*=\s*isSelected\s*\|\|\s*isChecked/);
      expect(SOURCE).not.toMatch(/isHighlighted\s*=\s*isChecked\s*\|\|\s*isSelected/);
    });

    it("does not declare a row-level isSelected variable that drives styling", () => {
      expect(SOURCE).not.toMatch(/const\s+isSelected\s*=\s*selectedUserId\s*===\s*user\.id/);
    });

    it("checked state does NOT add a ring-2 ring-primary highlight to the row", () => {
      // CEO directive: checked rows must look identical to unchecked rows;
      // only the checkbox icon signals selection. The row's className must
      // not contain ring-2/ring-primary at all, and must not branch on
      // isHighlighted.
      expect(SOURCE).not.toMatch(/ring-2 ring-primary/);
      expect(SOURCE).not.toMatch(/isHighlighted[\s\S]{0,200}ring-/);
    });

    it("row className does not branch on isHighlighted (no ternary for row styling)", () => {
      // The row's outermost <div> uses a static className — no conditional
      // styling tied to isHighlighted/isChecked.
      expect(SOURCE).not.toMatch(
        /data-testid="staff-member"[\s\S]{0,400}isHighlighted\s*\?/
      );
      // And the unchecked-style classes must still be present on the row.
      expect(SOURCE).toMatch(
        /data-testid="staff-member"[\s\S]{0,400}bg-background border-border(?!\s+hover:bg-muted)/
      );
    });

    it("name span has no hover background (CEO directive — round 2)", () => {
      // The span around `{user.name}` must not paint any hover background:
      // neither conditionally (via isHighlighted) nor unconditionally.
      expect(SOURCE).not.toMatch(/isHighlighted\s*\?\s*""\s*:\s*"hover:bg-border-strong"/);
      expect(SOURCE).not.toMatch(/block truncate[\s\S]{0,200}hover:bg-border-strong/);
    });

    it("assignment-count pill always uses bg-primary-soft text-primary (no isHighlighted ternary)", () => {
      expect(SOURCE).not.toMatch(/isHighlighted[\s\S]{0,200}bg-background text-foreground/);
      expect(SOURCE).toMatch(/pill[\s\S]{0,200}bg-primary-soft text-primary/);
    });

    it("does not emit a data-selected attribute on the row", () => {
      expect(SOURCE).not.toMatch(/data-selected=/);
    });

    it("checked checkbox affordance still renders a filled primary background", () => {
      expect(SOURCE).toMatch(/isChecked[\s\S]{0,120}bg-primary border-primary text-primary-foreground/);
    });

    it("renders the avatar inside a fixed w-8 h-8 slot so the pencil can occupy the same footprint", () => {
      expect(SOURCE).toMatch(/className="relative w-8 h-8 flex-shrink-0"[\s\S]{0,200}<StaffAvatar/);
    });

    it("reveals the pencil on group-hover only (row gets focus on click via tabIndex={-1}; pencil must not re-appear from focus-within after pointer leaves)", () => {
      expect(SOURCE).toMatch(/group-hover:grid/);
      expect(SOURCE).not.toMatch(/group-focus-within:grid/);
    });

    it("gates the in-slot pencil by !isHighlighted && !isEditingThis && !inStaffMulti", () => {
      expect(SOURCE).toMatch(/!isHighlighted\s*&&\s*!isEditingThis\s*&&\s*!inStaffMulti[\s\S]{0,1200}IconPencil/);
    });

    it("pencil click dispatches startEdit for the row's user with stopPropagation", () => {
      expect(SOURCE).toMatch(/e\.stopPropagation\(\);\s*startEdit\(user\)[\s\S]{0,800}IconPencil/);
    });

    it("does not import or render IconTrash inside WorkerList", () => {
      expect(SOURCE).not.toMatch(/IconTrash/);
    });

    it("does not retain pendingDeleteId state or confirmation Dialog block", () => {
      expect(SOURCE).not.toMatch(/pendingDeleteId/);
      expect(SOURCE).not.toMatch(/setPendingDeleteId/);
      expect(SOURCE).not.toMatch(/onDeleteSingleUser/);
    });

    it("pencil button keeps its i18n aria-label and title (no hardcoded strings)", () => {
      expect(SOURCE).toMatch(/aria-label=\{t\("editUserName"\)\}/);
      expect(SOURCE).toMatch(/title=\{t\("editUserName"\)\}/);
    });

    it("multi-select checkbox at row end is unchanged (still renders when inStaffMulti)", () => {
      expect(SOURCE).toMatch(/inStaffMulti[\s\S]{0,400}check-mark[\s\S]{0,400}IconCheck/);
    });

    it("avatar element itself keeps its size='md' prop (no class stripping on StaffAvatar)", () => {
      expect(SOURCE).toMatch(/<StaffAvatar size="md" id=\{user\.id\} name=\{user\.name\} \/>/);
    });

    it("pencil button is a circular chip (rounded-full) with dark muted bg, primary on hover (non-destructive)", () => {
      expect(SOURCE).toMatch(/edit-affordance[\s\S]{0,400}rounded-full[\s\S]{0,200}bg-muted-foreground text-white/);
      expect(SOURCE).toMatch(/edit-affordance[\s\S]{0,600}hover:bg-primary hover:text-primary-foreground/);
      expect(SOURCE).toMatch(/edit-affordance[\s\S]{0,600}focus-visible:bg-primary focus-visible:text-primary-foreground/);
      // Square shape isn't reintroduced on the chip.
      expect(SOURCE).not.toMatch(/edit-affordance[\s\S]{0,400}rounded-md/);
      // Non-destructive: the chip className must not contain destructive colors.
      const editClassMatch = SOURCE.match(/className="edit-affordance[^"]*"/);
      expect(editClassMatch).not.toBeNull();
      expect(editClassMatch![0]).not.toMatch(/bg-destructive/);
      expect(editClassMatch![0]).not.toMatch(/border-white/);
      expect(editClassMatch![0]).not.toMatch(/border-2/);
    });
  });
});
