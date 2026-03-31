export const colors = {
  // Background colors
  background: {
    default: "bg-background",
    hover: "hover:bg-muted",
  },
  // Available but unassigned cells
  available: {
    default: "bg-white border border-black",
    hover: "hover:bg-gray-50",
  },
  // Unavailable cells
  unavailable: {
    default: "bg-black",
    hover: "hover:bg-gray-900",
  },
  // Selected user cells
  selected: {
    default: "bg-black text-white",
    hover: "hover:bg-gray-800",
  },
  // Cell colors
  cell: {
    default: "bg-[#d1d5db]",
    selected: "bg-black text-white",
    dim: "bg-[#d1d5db]/30",
    error: "bg-red-600 text-white",
  },
  // Text colors
  text: {
    default: "bg-white text-gray-600",    
  },
  subtitle: {
    default: "text-gray-400",
  },
  // Button colors
  button: {
    default: "bg-primary/5",
    hover: `hover:bg-[#9dffbf]/80`,
    hover_negative: `hover:bg-[#ff9d9d]/80`,
  },
  highlightText: {
    default: `text-[#9dffbf]`,
    hover: `hover:text-[#9dffbf]/50`,
  },
} as const;
