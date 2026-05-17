export const colors = {
  // Background colors
  background: {
    default: "bg-background",
    hover: "hover:bg-muted",
  },
  // Available but unassigned cells
  available: {
    default: "bg-foreground text-background",
    hover: "hover:bg-foreground/85",
  },
  // Unavailable cells
  unavailable: {
    default: "bg-destructive/10 text-destructive",
    hover: "hover:bg-destructive/20",
  },
  // Selected user cells
  selected: {
    default: "bg-[#32353a] text-white",
    hover: "hover:bg-[#32353a]/80",
  },
  // Cell colors
  cell: {
    default: "bg-muted",
    selected: "bg-[#32353a] text-white",
    dim: "bg-muted/30",
    error: "bg-red-600 text-white",
  },
  // Text colors
  text: {
    default: "bg-background text-muted-foreground",
  },
  subtitle: {
    default: "text-muted-foreground",
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
