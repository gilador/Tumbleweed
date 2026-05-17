import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { User } from "../../models";
import { StaffAvatar } from "../StaffAvatar";

interface AssignWorkerPopoverProps {
  anchorEl: HTMLElement | null;
  users: User[];
  open: boolean;
  onSelect: (userId: string | null) => void;
  onClose: () => void;
}

export function AssignWorkerPopover({
  anchorEl,
  users,
  open,
  onSelect,
  onClose,
}: AssignWorkerPopoverProps) {
  const { t } = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [query, setQuery] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q));
  }, [query, users]);

  // Position next to the anchor element.
  useLayoutEffect(() => {
    if (!open || !anchorEl) return;
    const popoverEl = popoverRef.current;
    if (!popoverEl) return;
    const a = anchorEl.getBoundingClientRect();
    const p = popoverEl.getBoundingClientRect();
    let left = a.left;
    let top = a.bottom + 4;
    if (left + p.width > window.innerWidth) {
      left = Math.max(0, window.innerWidth - p.width - 4);
    }
    if (top + p.height > window.innerHeight) {
      top = Math.max(0, a.top - p.height - 4);
    }
    setPos({ left, top });
  }, [open, anchorEl, filtered.length]);

  // Reset query/highlight on open.
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightedIdx(0);
      // Focus the search input after render.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Outside click + Esc dismissal.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const el = popoverRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // total list = unassign + filtered users
  const total = filtered.length + 1;

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => (i + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => (i - 1 + total) % total);
    } else if (e.key === "Enter") {
      e.preventDefault();
      activateAt(highlightedIdx);
    }
  };

  const activateAt = (idx: number) => {
    if (idx === 0) {
      onSelect(null);
      return;
    }
    const u = filtered[idx - 1];
    if (u) onSelect(u.id);
  };

  if (!open) return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={t("contextMenu.assignWorker")}
      className="fixed z-[1000] w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-md py-1"
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <div className="px-2 py-1.5 border-b border-border">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIdx(0);
          }}
          onKeyDown={onInputKey}
          placeholder={t("contextMenu.assignWorker")}
          className="w-full px-2 py-1 text-sm bg-background outline-none border-b border-border focus:border-primary"
        />
      </div>
      <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
        <li>
          <button
            type="button"
            role="option"
            aria-selected={highlightedIdx === 0}
            onClick={() => activateAt(0)}
            onMouseEnter={() => setHighlightedIdx(0)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start italic text-muted-foreground ${
              highlightedIdx === 0 ? "bg-muted" : "hover:bg-muted"
            }`}
          >
            — {t("clickToAssign")}
          </button>
        </li>
        {filtered.map((u, i) => {
          const idx = i + 1;
          return (
            <li key={u.id}>
              <button
                type="button"
                role="option"
                aria-selected={highlightedIdx === idx}
                onClick={() => activateAt(idx)}
                onMouseEnter={() => setHighlightedIdx(idx)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start ${
                  highlightedIdx === idx ? "bg-muted" : "hover:bg-muted"
                }`}
              >
                <StaffAvatar size="sm" id={u.id} name={u.name} />
                <span className="truncate">{u.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body
  );
}
