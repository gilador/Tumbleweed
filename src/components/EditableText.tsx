import { Input } from "@/components/elements/input";
import { cn } from "@/service/utils";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => void;
  isEditing?: boolean;
  onEditingChange?: (isEditing: boolean) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  displayClassName?: string;
  children?: (value: string, isEditing: boolean) => React.ReactNode;
  disabled?: boolean;
}

export function EditableText({
  value,
  onSave,
  isEditing: controlledEditing,
  onEditingChange,
  placeholder,
  className = "",
  inputClassName = "",
  displayClassName = "",
  children,
  disabled = false,
}: EditableTextProps) {
  const [internalEditing, setInternalEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use controlled or internal editing state
  const isEditing =
    controlledEditing !== undefined ? controlledEditing : internalEditing;
  const setIsEditing = useCallback(
    (editing: boolean) => {
      if (controlledEditing !== undefined) {
        onEditingChange?.(editing);
      } else {
        setInternalEditing(editing);
      }
    },
    [controlledEditing, onEditingChange]
  );

  // Update temp value when prop value changes
  useEffect(() => {
    setTempValue(value);
  }, [value]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmedValue = tempValue.trim();
    if (trimmedValue && trimmedValue !== value) {
      onSave(trimmedValue);
    }
    setIsEditing(false);
  }, [tempValue, value, onSave, setIsEditing]);

  const handleCancel = useCallback(() => {
    setTempValue(value);
    setIsEditing(false);
  }, [value, setIsEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  const handleDoubleClick = useCallback(() => {
    if (!disabled) {
      setIsEditing(true);
    }
  }, [disabled, setIsEditing]);

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn("text-center", inputClassName)}
        disabled={disabled}
      />
    );
  }

  if (children) {
    return (
      <div
        className={cn(
          "cursor-pointer text-center",
          displayClassName,
          className
        )}
        onDoubleClick={handleDoubleClick}
      >
        {children(value, isEditing)}
      </div>
    );
  }

  return (
    <span
      className={cn(
        "cursor-pointer hover:underline text-center",
        disabled && "cursor-default hover:no-underline",
        displayClassName,
        className
      )}
      onDoubleClick={handleDoubleClick}
    >
      {value || placeholder}
    </span>
  );
}
