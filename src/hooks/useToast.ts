import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  highlightText?: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showSuccess = useCallback(
    (message: string, duration = 3000, highlightText?: string) => {
      console.log("🍞 [useToast] Adding toast:", {
        message,
        duration,
        highlightText,
      });
      addToast({ message, type: "success", duration, highlightText });
    },
    [addToast]
  );

  const showError = useCallback(
    (message: string, duration = 5000) => {
      addToast({ message, type: "error", duration });
    },
    [addToast]
  );

  const showInfo = useCallback(
    (message: string, duration = 3000) => {
      addToast({ message, type: "info", duration });
    },
    [addToast]
  );

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
  };
}
