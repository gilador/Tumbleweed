import { atom, useRecoilState, useRecoilValue } from "recoil";

export type MultiSelectKind = "staff" | "posts";

export interface MultiSelectState {
  ids: Set<string>;
  kind: MultiSelectKind;
}

// Ephemeral atoms — never persisted to localStorage. Set is not JSON-serialisable;
// resetting selection on reload matches the prior local-useState behavior.
export const multiSelectState = atom<MultiSelectState | null>({
  key: "multiSelectState",
  default: null,
});

export const selectedStaffIdState = atom<string | null>({
  key: "selectedStaffIdState",
  default: null,
});

// --- Pure helpers (testable without Recoil) ---

export function inMultiPure(
  state: MultiSelectState | null,
  kind?: MultiSelectKind
): boolean {
  if (state === null) return false;
  return kind === undefined || state.kind === kind;
}

export function isMultiCheckedPure(
  state: MultiSelectState | null,
  id: string,
  kind?: MultiSelectKind
): boolean {
  if (state === null) return false;
  if (kind !== undefined && state.kind !== kind) return false;
  return state.ids.has(id);
}

export function toggleInMultiPure(
  state: MultiSelectState | null,
  id: string
): MultiSelectState | null {
  if (state === null) return null;
  const next = new Set(state.ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  if (next.size === 0) return null;
  return { ...state, ids: next };
}

export function enterMultiPure(
  ids: string[],
  kind: MultiSelectKind
): MultiSelectState {
  return { ids: new Set(ids), kind };
}

// Decides what should happen when a staff row (or its inline checkbox) is
// clicked. Returns the action the caller must perform, leaving side-effects
// to the component layer. `intent` distinguishes the whole-row click (which
// also moves the viewing-selection) from the small checkbox click (which is
// multi-select-only on the check side).
//
// The "uncheck + clear viewing-selection if same id" path prevents a zombie
// state where a row is unchecked but still ringed because it was the
// selectedUserId at the moment of the uncheck.
export type StaffRowToggleIntent = "row" | "checkbox";

export interface StaffRowToggleAction {
  toggle: "check" | "uncheck";
  selection:
    | { update: true; to: string | null }
    | { update: false };
}

export function staffRowToggleAction(
  userId: string,
  isChecked: boolean,
  selectedUserId: string | null,
  intent: StaffRowToggleIntent
): StaffRowToggleAction {
  if (isChecked) {
    return {
      toggle: "uncheck",
      selection:
        selectedUserId === userId
          ? { update: true, to: null }
          : { update: false },
    };
  }
  return {
    toggle: "check",
    selection:
      intent === "row"
        ? { update: true, to: userId }
        : { update: false },
  };
}

// Cancelling a multi-select bar must always exit multi-select. When the bar's
// kind is "staff", it must ALSO clear the viewing-selection so the availability
// panel returns to its default empty state — see CEO directive (round 5):
// no zombie staff/availability rendering after Cancel. Pure helper so the
// behavior is unit-testable without a DOM.
export interface CancelMultiSelectAction {
  exit: true;
  clearStaffSelection: boolean;
}

export function cancelMultiSelectAction(
  kind: MultiSelectKind
): CancelMultiSelectAction {
  return { exit: true, clearStaffSelection: kind === "staff" };
}

// --- Hook wrapper (call from components) ---

export function useMultiSelect() {
  const [multi, setMulti] = useRecoilState(multiSelectState);
  const [selectedStaffId, setSelectedStaffId] = useRecoilState(selectedStaffIdState);

  const inMulti = (kind?: MultiSelectKind) => inMultiPure(multi, kind);

  const isMultiChecked = (id: string, kind?: MultiSelectKind) =>
    isMultiCheckedPure(multi, id, kind);

  const enterMulti = (ids: string[], kind: MultiSelectKind) => {
    setMulti(enterMultiPure(ids, kind));
    if (kind === "staff") setSelectedStaffId(null);
  };

  const exitMulti = () => setMulti(null);

  const toggleInMulti = (id: string) => {
    setMulti((prev) => toggleInMultiPure(prev, id));
  };

  // Row-click handlers encode the upgrade-to-multi rule from the spec.
  // Plain click and cmd-click both route through here.
  const handleStaffRowClick = (userId: string) => {
    if (multi !== null && multi.kind === "posts") {
      // Switching kind mid-flight: exit posts cleanly, start staff single.
      setMulti(null);
      setSelectedStaffId(userId);
      return;
    }
    if (multi !== null && multi.kind === "staff") {
      setMulti(toggleInMultiPure(multi, userId));
      setSelectedStaffId(userId);
      return;
    }
    if (selectedStaffId === null) {
      setSelectedStaffId(userId);
      return;
    }
    if (selectedStaffId === userId) {
      setSelectedStaffId(null);
      return;
    }
    // Different single → upgrade to multi.
    setMulti(enterMultiPure([selectedStaffId, userId], "staff"));
    setSelectedStaffId(null);
  };

  const handlePostRowClick = (postId: string) => {
    if (multi !== null && multi.kind === "staff") {
      setMulti(enterMultiPure([postId], "posts"));
      setSelectedStaffId(null);
      return;
    }
    if (multi !== null && multi.kind === "posts") {
      setMulti(toggleInMultiPure(multi, postId));
      return;
    }
    setMulti(enterMultiPure([postId], "posts"));
  };

  return {
    multiSelected: multi?.ids ?? null,
    multiSelectKind: multi?.kind ?? null,
    selectedStaffId,
    setSelectedStaffId,
    inMulti,
    isMultiChecked,
    enterMulti,
    exitMulti,
    toggleInMulti,
    handleStaffRowClick,
    handlePostRowClick,
  };
}

// Read-only variant for components that only need to inspect state (no setters).
export function useMultiSelectValue() {
  const multi = useRecoilValue(multiSelectState);
  return {
    multiSelected: multi?.ids ?? null,
    multiSelectKind: multi?.kind ?? null,
    inMulti: (kind?: MultiSelectKind) => inMultiPure(multi, kind),
    isMultiChecked: (id: string, kind?: MultiSelectKind) =>
      isMultiCheckedPure(multi, id, kind),
  };
}
