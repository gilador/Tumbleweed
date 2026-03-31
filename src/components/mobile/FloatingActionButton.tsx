import { IconWand, IconLoader2 } from "@tabler/icons-react";

interface FloatingActionButtonProps {
  onClick: () => void;
  onDisabledClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
}

export function FloatingActionButton({
  onClick,
  onDisabledClick,
  disabled = false,
  loading = false,
  title = "Optimize",
}: FloatingActionButtonProps) {
  return (
    <button
      onClick={() => {
        if (loading) return;
        if (disabled) {
          onDisabledClick?.();
          return;
        }
        onClick();
      }}
      title={title}
      className={`fixed bottom-20 end-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all z-10 ${
        disabled || loading
          ? "bg-muted text-muted-foreground cursor-default opacity-60"
          : "bg-primary text-primary-foreground active:scale-95"
      }`}
    >
      {loading ? (
        <IconLoader2 size={24} className="animate-spin" />
      ) : (
        <IconWand size={24} className={disabled ? "wand-icon-disabled" : "wand-icon"} />
      )}
    </button>
  );
}
