import { atom, useRecoilState, useSetRecoilState } from "recoil";
import { trackEvent } from "../lib/analytics";

export type ContextMenuKind = "staff" | "posts";

export interface ContextMenuOpenArgs {
  kind: ContextMenuKind;
  targetId: string;
  anchorEl: HTMLElement | null;
  x: number;
  y: number;
  postIndex?: number;
  shiftIndex?: number;
}

export interface ContextMenuState extends ContextMenuOpenArgs {
  assignPopoverOpen: boolean;
}

export const contextMenuState = atom<ContextMenuState | null>({
  key: "contextMenuState",
  default: null,
  // anchorEl is a DOM element — disable React DevTools/serializer freezing.
  dangerouslyAllowMutability: true,
});

export interface RenameTarget {
  kind: ContextMenuKind;
  id: string;
  // Bumped every time rename is requested for the same id, so listeners re-fire.
  nonce: number;
}

export const renameTargetState = atom<RenameTarget | null>({
  key: "renameTargetState",
  default: null,
});

export function useContextMenu() {
  const [state, setState] = useRecoilState(contextMenuState);
  const setRenameTarget = useSetRecoilState(renameTargetState);

  const open = (args: ContextMenuOpenArgs) => {
    trackEvent("context-menu-open", { kind: args.kind });
    setState({ ...args, assignPopoverOpen: false });
  };

  const close = () => {
    setState(null);
  };

  const openAssignPopover = () => {
    setState((prev) => (prev ? { ...prev, assignPopoverOpen: true } : prev));
  };

  const closeAssignPopover = () => {
    setState(null);
  };

  const requestRename = (kind: ContextMenuKind, id: string) => {
    setRenameTarget((prev) => ({
      kind,
      id,
      nonce: (prev && prev.kind === kind && prev.id === id ? prev.nonce : 0) + 1,
    }));
  };

  return {
    state,
    open,
    close,
    openAssignPopover,
    closeAssignPopover,
    requestRename,
  };
}
