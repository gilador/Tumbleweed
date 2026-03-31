import { Button } from "@/components/elements/button";
import { Pencil } from "lucide-react";
import React, { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface EditButtonProps {
  isEditing: boolean;
  onToggle: () => void;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

export function EditButton({
  isEditing,
  onToggle,
  className = "",
  onClick,
  disabled = false,
}: EditButtonProps) {
  const { t } = useTranslation();
  const wasEditing = useRef(isEditing);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (wasEditing.current && !isEditing) {
      setDeactivating(true);
      const timer = setTimeout(() => setDeactivating(false), 400);
      return () => clearTimeout(timer);
    }
    wasEditing.current = isEditing;
  }, [isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    onClick?.(e);
    onToggle();
  };

  const pencilClass = isEditing
    ? "pencil-icon-active text-primary-foreground"
    : deactivating
    ? "pencil-icon-deactivating hover:text-foreground/80"
    : "pencil-icon hover:text-foreground/80";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={disabled}
      data-testid="edit-toggle-button"
      aria-label={isEditing ? t("exitEditMode") : t("enterEditMode")}
      className={` ease-in-out transform hover:scale-100 ${
        isEditing
          ? "bg-primary text-primary-foreground hover:bg-primary h-8 w-8"
          : "bg-transparent hover:bg-accent h-8 w-8"
      } ${className}`}
    >
      <Pencil className={`h-4 w-4 ${pencilClass}`} />
    </Button>
  );
}
