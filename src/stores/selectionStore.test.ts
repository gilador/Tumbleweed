import {
  inMultiPure,
  isMultiCheckedPure,
  toggleInMultiPure,
  enterMultiPure,
  staffRowToggleAction,
  cancelMultiSelectAction,
  type MultiSelectState,
} from "./selectionStore";

describe("selectionStore pure helpers", () => {
  describe("inMultiPure", () => {
    it("returns false when state is null", () => {
      expect(inMultiPure(null)).toBe(false);
      expect(inMultiPure(null, "staff")).toBe(false);
    });

    it("returns true for any kind when no kind argument is given", () => {
      const state: MultiSelectState = { ids: new Set(["a"]), kind: "staff" };
      expect(inMultiPure(state)).toBe(true);
    });

    it("returns true only when kind matches", () => {
      const state: MultiSelectState = { ids: new Set(["a"]), kind: "staff" };
      expect(inMultiPure(state, "staff")).toBe(true);
      expect(inMultiPure(state, "posts")).toBe(false);
    });
  });

  describe("isMultiCheckedPure", () => {
    it("returns false when state is null", () => {
      expect(isMultiCheckedPure(null, "id1")).toBe(false);
    });

    it("returns true when id is in set and kind matches (or no kind given)", () => {
      const state: MultiSelectState = { ids: new Set(["a", "b"]), kind: "posts" };
      expect(isMultiCheckedPure(state, "a")).toBe(true);
      expect(isMultiCheckedPure(state, "a", "posts")).toBe(true);
    });

    it("returns false when kind mismatches", () => {
      const state: MultiSelectState = { ids: new Set(["a"]), kind: "posts" };
      expect(isMultiCheckedPure(state, "a", "staff")).toBe(false);
    });

    it("returns false when id is not in set", () => {
      const state: MultiSelectState = { ids: new Set(["a"]), kind: "staff" };
      expect(isMultiCheckedPure(state, "z")).toBe(false);
    });
  });

  describe("enterMultiPure", () => {
    it("creates a new state with the given ids and kind", () => {
      const state = enterMultiPure(["a", "b"], "staff");
      expect(state.kind).toBe("staff");
      expect(Array.from(state.ids).sort()).toEqual(["a", "b"]);
    });

    it("dedupes the input ids via Set", () => {
      const state = enterMultiPure(["a", "a", "b"], "posts");
      expect(state.ids.size).toBe(2);
    });
  });

  describe("toggleInMultiPure", () => {
    it("returns null when input state is null", () => {
      expect(toggleInMultiPure(null, "id1")).toBeNull();
    });

    it("adds an id when not present", () => {
      const state: MultiSelectState = { ids: new Set(["a"]), kind: "staff" };
      const next = toggleInMultiPure(state, "b");
      expect(next).not.toBeNull();
      expect(Array.from(next!.ids).sort()).toEqual(["a", "b"]);
      expect(next!.kind).toBe("staff");
    });

    it("removes an id when present", () => {
      const state: MultiSelectState = { ids: new Set(["a", "b"]), kind: "posts" };
      const next = toggleInMultiPure(state, "a");
      expect(next).not.toBeNull();
      expect(Array.from(next!.ids)).toEqual(["b"]);
    });

    it("auto-exits to null when removing the last id", () => {
      const state: MultiSelectState = { ids: new Set(["only"]), kind: "staff" };
      expect(toggleInMultiPure(state, "only")).toBeNull();
    });

    it("does not mutate the input state", () => {
      const state: MultiSelectState = { ids: new Set(["a"]), kind: "staff" };
      toggleInMultiPure(state, "b");
      expect(Array.from(state.ids)).toEqual(["a"]);
    });
  });

  describe("staffRowToggleAction", () => {
    it("checks an unchecked row and updates viewing-selection on row intent", () => {
      expect(staffRowToggleAction("a", false, null, "row")).toEqual({
        toggle: "check",
        selection: { update: true, to: "a" },
      });
    });

    it("checks an unchecked row but leaves viewing-selection alone on checkbox intent", () => {
      expect(staffRowToggleAction("a", false, "b", "checkbox")).toEqual({
        toggle: "check",
        selection: { update: false },
      });
    });

    it("unchecks a checked row and leaves viewing-selection alone when a different row is selected", () => {
      // Repro for the zombie bug: clicking the originally-checked row to
      // uncheck it must NOT re-set viewing-selection to that row.
      expect(staffRowToggleAction("a", true, "b", "row")).toEqual({
        toggle: "uncheck",
        selection: { update: false },
      });
    });

    it("unchecks a checked row and clears viewing-selection when this row was the selected one", () => {
      // Ensures unchecking the currently-viewed row does not leave it ringed.
      expect(staffRowToggleAction("a", true, "a", "row")).toEqual({
        toggle: "uncheck",
        selection: { update: true, to: null },
      });
      expect(staffRowToggleAction("a", true, "a", "checkbox")).toEqual({
        toggle: "uncheck",
        selection: { update: true, to: null },
      });
    });

    it("does not re-select the just-unchecked row even when no other row is selected", () => {
      expect(staffRowToggleAction("a", true, null, "row")).toEqual({
        toggle: "uncheck",
        selection: { update: false },
      });
    });
  });

  describe("cancelMultiSelectAction", () => {
    it("requests clearing the staff viewing-selection on staff cancel", () => {
      // CEO directive (round 5): cancelling the staff multi-select must
      // also empty the availability panel. The helper is the seam where
      // BulkSelectionBar opts into clearing selectedStaffIdState.
      expect(cancelMultiSelectAction("staff")).toEqual({
        exit: true,
        clearStaffSelection: true,
      });
    });

    it("leaves the staff selection alone on posts cancel (orthogonal flow)", () => {
      expect(cancelMultiSelectAction("posts")).toEqual({
        exit: true,
        clearStaffSelection: false,
      });
    });
  });
});
