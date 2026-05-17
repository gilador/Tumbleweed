export function computeMenuPosition(args: {
  x: number;
  y: number;
  menuW: number;
  menuH: number;
  viewportW: number;
  viewportH: number;
}): { left: number; top: number } {
  const { x, y, menuW, menuH, viewportW, viewportH } = args;
  let left = x;
  let top = y;
  if (left + menuW > viewportW) left = Math.max(0, x - menuW);
  if (top + menuH > viewportH) top = Math.max(0, y - menuH);
  return { left, top };
}
