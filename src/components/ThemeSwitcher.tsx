import { IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react";
import { useTheme } from "../hooks/useTheme";

const modes = [
  { value: "light" as const, icon: IconSun },
  { value: "system" as const, icon: IconDeviceDesktop },
  { value: "dark" as const, icon: IconMoon },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const activeIndex = modes.findIndex((m) => m.value === theme);

  return (
    <div
      dir="ltr"
      className="relative flex items-center rounded-full p-0.5 h-7"
      style={{ backgroundColor: "#1e293b", width: "5.25rem" }}
    >
      {/* Sliding indicator */}
      <span
        className="absolute top-0.5 h-6 rounded-full bg-white shadow-md transition-all duration-300 ease-in-out"
        style={{
          width: "1.5rem",
          left: `calc(0.125rem + ${activeIndex} * 1.625rem)`,
        }}
      />
      {modes.map(({ value, icon: Icon }, i) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`relative z-10 h-6 flex items-center justify-center rounded-full transition-colors duration-300 ${
            theme === value ? "text-gray-700" : "text-gray-400"
          }`}
          style={{ width: "1.5rem", marginLeft: i === 0 ? 0 : "0.125rem" }}
        >
          <Icon size={13} stroke={2.5} />
        </button>
      ))}
    </div>
  );
}
