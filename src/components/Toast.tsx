import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconX } from "@tabler/icons-react";
import { colors } from "@/constants/colors";

export interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
  highlightText?: string;
}

export function Toast({
  message,
  type,
  duration = 3000,
  onClose,
  highlightText,
}: ToastProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show toast immediately
    setIsVisible(true);

    // Auto-hide after duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Wait for animation to complete before calling onClose
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const renderMessage = () => {
    if (!highlightText || !message.includes(highlightText)) {
      return <span className="flex-1 text-sm font-medium">{message}</span>;
    }

    const parts = message.split(highlightText);
    return (
      <span className="flex-1 text-sm font-medium">
        {parts.map((part, index) => (
          <span key={index}>
            {part}
            {index < parts.length - 1 && (
              <span className={`${colors.highlightText.default} font-semibold`}>
                {highlightText}
              </span>
            )}
          </span>
        ))}
      </span>
    );
  };

  const getTypeStyles = () => {
    if (type === "error") {
      return colors.cell.error;
    }
    return "bg-black text-white";
  };

  return (
    <div
      className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
    >
      <div
        className={`${getTypeStyles()} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px]`}
      >
        {renderMessage()}
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded hover:bg-black/20 transition-colors"
          aria-label={t("closeToast")}
        >
          <IconX size={16} />
        </button>
      </div>
    </div>
  );
}

export interface ToastManagerProps {
  toasts: Array<{
    id: string;
    message: string;
    type?: "success" | "error" | "info";
    duration?: number;
    highlightText?: string;
  }>;
  onRemoveToast: (id: string) => void;
}

export function ToastManager({ toasts, onRemoveToast }: ToastManagerProps) {
  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          highlightText={toast.highlightText}
          onClose={() => onRemoveToast(toast.id)}
        />
      ))}
    </>
  );
}
