import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { IconClock } from "@tabler/icons-react";

interface TimeInputProps {
  value: string; // "HH:MM"
  onChange: (time: string) => void;
  className?: string;
}

export function TimeInput({ value, onChange, className = "" }: TimeInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, maxH: 200 });

  const [hours, minutes] = value.split(":").map(Number);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        pickerRef.current && !pickerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const positionPicker = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    // Find the nearest containing dialog/panel
    let container = ref.current.parentElement;
    let containerRect: DOMRect | null = null;
    while (container) {
      const style = getComputedStyle(container);
      if (style.overflow === "hidden" || style.overflowY === "hidden" || container.getAttribute("role") === "dialog") {
        containerRect = container.getBoundingClientRect();
        break;
      }
      container = container.parentElement;
    }
    const viewportBottom = window.innerHeight - 12;
    const containerBottom = containerRect ? containerRect.bottom - 12 : viewportBottom;
    const bottomBound = Math.min(containerBottom, viewportBottom);
    const available = Math.min(bottomBound - rect.bottom - 8, 200); // cap at ~7 rows
    const pickerWidth = 120;

    setPos({
      top: rect.bottom + 4,
      left: rect.left + rect.width / 2 - pickerWidth / 2,
      maxH: Math.max(available, 80),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionPicker();
    requestAnimationFrame(() => {
      if (hoursRef.current) {
        const selected = hoursRef.current.querySelector("[data-selected]");
        if (selected) selected.scrollIntoView({ block: "center", behavior: "instant" });
      }
      if (minutesRef.current) {
        const selected = minutesRef.current.querySelector("[data-selected]");
        if (selected) selected.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
  }, [open, positionPicker]);

  const setTime = (h: number, m: number) => {
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  const columnHeight = pos.maxH - 20;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-0.5 border border-border rounded text-sm bg-background text-foreground hover:bg-accent cursor-pointer w-full justify-center"
      >
        <span dir="ltr">{value}</span>
        <IconClock size={13} className="text-muted-foreground" />
      </button>
      {open && createPortal(
        <div
          ref={pickerRef}
          className="fixed z-[100] bg-popover border border-border rounded-lg shadow-lg p-2 flex gap-1 overflow-hidden"
          dir="ltr"
          style={{ top: pos.top, left: pos.left, maxHeight: pos.maxH }}
        >
          <div ref={hoursRef} className="overflow-y-auto scrollbar-thin" style={{ maxHeight: columnHeight }}>
            {Array.from({ length: 24 }, (_, h) => (
              <button
                key={h}
                data-selected={h === hours ? "" : undefined}
                onClick={() => setTime(h, minutes)}
                className={`block w-10 py-1 text-center text-sm rounded transition-colors ${
                  h === hours
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-accent text-foreground"
                }`}
              >
                {String(h).padStart(2, "0")}
              </button>
            ))}
          </div>
          <div className="w-px bg-border" />
          <div ref={minutesRef} className="overflow-y-auto scrollbar-thin" style={{ maxHeight: columnHeight }}>
            {[0, 15, 30, 45].map((m) => (
              <button
                key={m}
                data-selected={m === minutes ? "" : undefined}
                onClick={() => setTime(hours, m)}
                className={`block w-10 py-1 text-center text-sm rounded transition-colors ${
                  m === minutes
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-accent text-foreground"
                }`}
              >
                {String(m).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
