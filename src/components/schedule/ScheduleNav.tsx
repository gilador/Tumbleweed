import { useEffect, useRef, useState } from "react";

interface ScheduleNavProps {
  // Stable id per chip — matches the data attribute on the corresponding card.
  chips: { id: string; label: string }[];
  // The scrollable container that holds the cards.
  scrollContainerRef: React.RefObject<HTMLElement>;
  // Selector used to find the card matching each chip id.
  cardSelector: (id: string) => string;
  // Optional analytics hook for chip clicks.
  onChipClick?: (chipIndex: number) => void;
}

export function ScheduleNav({
  chips,
  scrollContainerRef,
  cardSelector,
  onChipClick,
}: ScheduleNavProps) {
  const [activeIds, setActiveIds] = useState<Set<string>>(
    () => new Set(chips[0]?.id ? [chips[0].id] : [])
  );
  const [show, setShow] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const computeShow = () => {
      setShow(container.scrollWidth > container.clientWidth + 1);
    };

    let rafId = 0;
    const computeActive = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const next = new Set<string>();
        for (const chip of chips) {
          const el = container.querySelector(cardSelector(chip.id)) as HTMLElement | null;
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const visibleStart = Math.max(r.left, containerRect.left);
          const visibleEnd = Math.min(r.right, containerRect.right);
          if (visibleEnd - visibleStart > 1) next.add(chip.id);
        }
        setActiveIds((prev) => {
          if (prev.size === next.size) {
            let same = true;
            for (const id of next) {
              if (!prev.has(id)) {
                same = false;
                break;
              }
            }
            if (same) return prev;
          }
          return next;
        });
      });
    };

    computeShow();
    computeActive();
    container.addEventListener("scroll", computeActive, { passive: true });
    window.addEventListener("resize", computeShow);
    const obs = new ResizeObserver(() => {
      computeShow();
      computeActive();
    });
    obs.observe(container);
    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener("scroll", computeActive);
      window.removeEventListener("resize", computeShow);
      obs.disconnect();
    };
  }, [chips, scrollContainerRef, cardSelector]);

  useEffect(() => {
    const strip = navRef.current;
    if (!strip || activeIds.size === 0) return;
    const activeButtons = Array.from(
      strip.querySelectorAll<HTMLButtonElement>('button[data-active="true"]')
    );
    if (activeButtons.length === 0) return;
    const firstActive = activeButtons[0];
    const lastActive = activeButtons[activeButtons.length - 1];
    const stripRect = strip.getBoundingClientRect();
    const firstRect = firstActive.getBoundingClientRect();
    const lastRect = lastActive.getBoundingClientRect();
    if (firstRect.left >= stripRect.left && lastRect.right <= stripRect.right) return;
    const targetCenter = (firstRect.left + lastRect.right) / 2;
    const stripCenter = stripRect.left + stripRect.width / 2;
    const delta = targetCenter - stripCenter;
    strip.scrollTo({ left: strip.scrollLeft + delta, behavior: "smooth" });
  }, [activeIds]);

  if (!show || chips.length === 0) return null;

  const handleClick = (id: string, idx: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector(cardSelector(id)) as HTMLElement | null;
    if (!el) return;
    // Bounded horizontal scroll: never touch any ancestor (no vertical page jump).
    // Use bounding-rect deltas so the same code works for LTR and RTL across
    // browsers — Chrome/Firefox/Safari diverge on the sign of scrollLeft in RTL,
    // but getBoundingClientRect() always reports visual coordinates.
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const delta = elRect.left - containerRect.left;
    const left = container.scrollLeft + delta;
    container.scrollTo({ left, behavior: "smooth" });
    onChipClick?.(idx);
  };

  return (
    <div
      ref={navRef}
      className="flex gap-1.5 mb-2 overflow-x-auto py-1 scroll-smooth"
    >
      {chips.map((chip, idx) => {
        const active = activeIds.has(chip.id);
        return (
          <button
            key={chip.id}
            type="button"
            data-active={active}
            onClick={() => handleClick(chip.id, idx)}
            className={`whitespace-nowrap shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-medium tabular-nums transition-colors ${
              active
                ? "bg-muted border-border"
                : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
