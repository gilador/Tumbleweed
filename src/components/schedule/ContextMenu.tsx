import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  IconCheck,
  IconUserPlus,
  IconPencil,
  IconCopy,
  IconTrash,
} from "@tabler/icons-react";
import { useContextMenu, ContextMenuKind } from "../../stores/contextMenuStore";
import { useMultiSelect } from "../../stores/selectionStore";
import { trackEvent } from "../../lib/analytics";
import { computeMenuPosition } from "./contextMenuPosition";

export { computeMenuPosition };

export interface ContextMenuActionHandlers {
  onCopyName: (kind: ContextMenuKind, targetId: string) => void;
  onDelete: (kind: ContextMenuKind, targetId: string) => void;
  onAssignWorker?: () => void;
}

interface ContextMenuRootProps {
  handlers: ContextMenuActionHandlers;
}

type MenuAction = "select" | "assign-worker" | "rename" | "copy-name" | "delete";

interface MenuItem {
  action: MenuAction;
  label: string;
  icon: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

export function ContextMenuRoot({ handlers }: ContextMenuRootProps) {
  const { t } = useTranslation();
  const { state, close, openAssignPopover, requestRename } = useContextMenu();
  const { handlePostRowClick, handleStaffRowClick } = useMultiSelect();
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [focusedIdx, setFocusedIdx] = useState(0);

  const items = useMemo<MenuItem[]>(() => {
    if (!state) return [];
    if (state.kind === "posts") {
      return [
        { action: "select", label: t("contextMenu.select"), icon: <IconCheck size={14} /> },
        {
          action: "assign-worker",
          label: t("contextMenu.assignWorker"),
          icon: <IconUserPlus size={14} />,
        },
        { action: "rename", label: t("contextMenu.rename"), icon: <IconPencil size={14} /> },
        { action: "copy-name", label: t("contextMenu.copyName"), icon: <IconCopy size={14} /> },
        {
          action: "delete",
          label: t("contextMenu.delete"),
          icon: <IconTrash size={14} />,
          destructive: true,
        },
      ];
    }
    return [
      { action: "select", label: t("contextMenu.select"), icon: <IconCheck size={14} /> },
      { action: "rename", label: t("contextMenu.rename"), icon: <IconPencil size={14} /> },
      { action: "copy-name", label: t("contextMenu.copyName"), icon: <IconCopy size={14} /> },
      {
        action: "delete",
        label: t("contextMenu.delete"),
        icon: <IconTrash size={14} />,
        destructive: true,
      },
    ];
  }, [state, t]);

  // Position after mount/measure.
  useLayoutEffect(() => {
    if (!state) {
      setPos(null);
      return;
    }
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(
      computeMenuPosition({
        x: state.x,
        y: state.y,
        menuW: rect.width,
        menuH: rect.height,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
      })
    );
    setFocusedIdx(0);
  }, [state]);

  // Esc + outside click + scroll dismissal.
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => (i + 1) % items.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => (i - 1 + items.length) % items.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = items[focusedIdx];
        if (item) runAction(item);
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      const m = menuRef.current;
      if (!m) return;
      if (e.target instanceof Node && !m.contains(e.target)) {
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, items, focusedIdx]);

  // Auto-focus first item button on open.
  useEffect(() => {
    if (!state || !menuRef.current) return;
    const buttons = menuRef.current.querySelectorAll<HTMLButtonElement>(
      'button[role="menuitem"]'
    );
    buttons[focusedIdx]?.focus();
  }, [state, focusedIdx]);

  if (!state) return null;

  const runAction = (item: MenuItem) => {
    if (!state) return;
    if (item.disabled) return;
    trackEvent("context-menu-action", {
      kind: state.kind,
      action: item.action,
    });
    const { kind, targetId } = state;
    // Snapshot before close (which clears state).
    const cur = state;
    if (item.action === "assign-worker") {
      // Open the assign popover, keep state alive.
      openAssignPopover();
      return;
    }
    close();
    if (item.action === "select") {
      if (kind === "posts") handlePostRowClick(targetId);
      else handleStaffRowClick(targetId);
      return;
    }
    if (item.action === "rename") {
      requestRename(kind, targetId);
      return;
    }
    if (item.action === "copy-name") {
      handlers.onCopyName(kind, targetId);
      return;
    }
    if (item.action === "delete") {
      handlers.onDelete(kind, targetId);
      return;
    }
    // Unreachable — exhaustive.
    void cur;
  };

  // Hide assign-worker when popover is open (popover takes over) — menu unmounts via close instead.
  if (state.assignPopoverOpen) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={state.kind === "posts" ? "Post actions" : "Staff actions"}
      className="fixed z-[1000] min-w-[180px] py-1 rounded-md border border-border bg-popover text-popover-foreground shadow-md"
      style={{
        left: pos?.left ?? state.x,
        top: pos?.top ?? state.y,
        visibility: pos ? "visible" : "hidden",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, idx) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          tabIndex={idx === focusedIdx ? 0 : -1}
          aria-disabled={item.disabled || undefined}
          onClick={(e) => {
            e.stopPropagation();
            runAction(item);
          }}
          onMouseEnter={() => setFocusedIdx(idx)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start outline-none ${
            item.destructive
              ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
              : "hover:bg-muted focus:bg-muted"
          } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span className="inline-flex w-4 h-4 items-center justify-center text-muted-foreground">
            {item.icon}
          </span>
          <span className="flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}
