import { useCallback, useEffect, useRef } from "react";

export const JUST_LONG_PRESSED_MS = 300;

export interface UseLongPressOptions {
  threshold?: number;
  moveTolerance?: number;
  onLongPress: (target: EventTarget) => void;
}

// Pure helper: decides whether a pointermove should cancel the pending
// long-press, given the move-tolerance and the pointerdown origin. Exported
// for unit tests (no DOM / no jsdom available in this package's Jest env).
export function shouldCancelOnMove(
  start: { x: number; y: number },
  current: { x: number; y: number },
  moveTolerance: number
): boolean {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return Math.hypot(dx, dy) > moveTolerance;
}

// Pure helper: returns true if a long-press fired within the synthetic-click
// suppression window. Used by row click handlers to swallow the synthetic
// click that follows a long-press.
export function isWithinJustLongPressed(
  firedAt: number,
  now: number,
  windowMs: number = JUST_LONG_PRESSED_MS
): boolean {
  return now - firedAt < windowMs;
}

export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  justLongPressed: () => boolean;
}

export function useLongPress(options: UseLongPressOptions): LongPressHandlers {
  const { threshold = 500, moveTolerance = 10, onLongPress } = options;

  const optionsRef = useRef({ threshold, moveTolerance, onLongPress });
  optionsRef.current = { threshold, moveTolerance, onLongPress };

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number; target: EventTarget } | null>(
    null
  );
  const firedRef = useRef(false);
  const justLongPressedAtRef = useRef(0);

  const reset = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
    firedRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    const target = e.target;
    startRef.current = { x: e.clientX, y: e.clientY, target };
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      const start = startRef.current;
      timerRef.current = null;
      if (start === null) return;
      firedRef.current = true;
      justLongPressedAtRef.current = Date.now();
      optionsRef.current.onLongPress(start.target);
    }, optionsRef.current.threshold);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const start = startRef.current;
    if (start === null) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > optionsRef.current.moveTolerance) {
      reset();
    }
  }, [reset]);

  const onPointerUp = useCallback(() => {
    reset();
  }, [reset]);

  const onPointerCancel = useCallback(() => {
    reset();
  }, [reset]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const justLongPressed = useCallback(
    () => Date.now() - justLongPressedAtRef.current < JUST_LONG_PRESSED_MS,
    []
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
    justLongPressed,
  };
}
