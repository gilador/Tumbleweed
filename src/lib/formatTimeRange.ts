export type TextDirection = "ltr" | "rtl";

export function formatTimeRange(
  start: string,
  end: string | undefined,
  dir: TextDirection
): string {
  const arrow = dir === "rtl" ? "←" : "→";
  return end ? `${start} ${arrow} ${end}` : `${start} ${arrow}`;
}
