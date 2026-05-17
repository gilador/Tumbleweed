export const AVATAR_PALETTE = [
  "bg-amber-500 text-white",
  "bg-emerald-500 text-white",
  "bg-indigo-500 text-white",
  "bg-pink-500 text-white",
  "bg-sky-500 text-white",
  "bg-violet-500 text-white",
  "bg-teal-500 text-white",
  "bg-red-500 text-white",
  "bg-lime-500 text-white",
  "bg-purple-500 text-white",
];

export function hashCode(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function paletteForId(id: string): string {
  if (!id) return AVATAR_PALETTE[0];
  return AVATAR_PALETTE[hashCode(id) % AVATAR_PALETTE.length];
}
