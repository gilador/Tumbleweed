import { paletteForId } from "../constants/avatarPalette";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface StaffAvatarProps {
  name: string;
  id: string;
  size?: "sm" | "md";
}

export function StaffAvatar({ name, id, size = "md" }: StaffAvatarProps) {
  const sizeClass =
    size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";
  return (
    <div
      aria-hidden
      className={`inline-grid place-items-center rounded-full font-semibold flex-shrink-0 ${sizeClass} ${paletteForId(id)}`}
    >
      {initials(name)}
    </div>
  );
}
