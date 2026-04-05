import React, { useState, useEffect, useRef } from "react";
import { Checkbox } from "@/components/elements/checkbox";

export interface ActionableTextProps {
  id: string;
  value: string;
  isSelected?: boolean;
  isEditing: boolean;
  isChecked: boolean;
  onCheck: (event?: React.MouseEvent) => void;
  onUncheck: (event?: React.MouseEvent) => void;
  onUpdate: (id: string, newValue: string) => void;
  onClick?: () => void;
  className?: string;
  allowClickWhenNotEditing?: boolean;
}

export function ActionableText({
  id,
  value,
  isSelected = false,
  isEditing,
  isChecked,
  onCheck,
  onUncheck,
  onUpdate,
  onClick,
  className = "",
  allowClickWhenNotEditing = false,
}: ActionableTextProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempValue, setTempValue] = useState(value); // For input field
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync tempValue with prop value when it changes externally
  useEffect(() => {
    setTempValue(value);
  }, [value]);

  // Handle click outside to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isEditMode &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        // Save the value and exit edit mode
        onUpdate(id, tempValue.trim());
        setIsEditMode(false);
      }
    };

    if (isEditMode) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditMode, tempValue, onUpdate, id]);

  return (
    <div
      ref={containerRef}
      className={`flex items-center gap-0 w-full min-w-0 min-h-[32px] ${
        (isEditing && !isEditMode) || allowClickWhenNotEditing
          ? "cursor-pointer"
          : "cursor-default"
      }`}
      onClick={
        (isEditing && !isEditMode) || allowClickWhenNotEditing
          ? onClick
          : undefined
      }
    >
      {/* Editing controls - slide in when editing */}
      <div
        className={`flex items-center gap-1 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          isEditing ? "max-w-[100px] opacity-100 me-2" : "max-w-0 opacity-0 me-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-max">
          <Checkbox
            className="flex-shrink-0 w-4 h-4"
            checked={isChecked}
            disabled={!isEditing}
            onCheckedChange={() => {
              // Handled in onClick to access the mouse event
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isEditing) {
                if (isChecked) {
                  onUncheck(e);
                } else {
                  onCheck(e);
                }
              }
            }}
          />
        </div>
      </div>

      {/* Text content */}
      <div
        className="flex-1 min-w-0"
        onClick={(e) => {
          if (isEditMode) {
            e.stopPropagation();
          } else if (isEditing && !isEditMode) {
            e.stopPropagation();
            setTempValue(value);
            setIsEditMode(true);
          }
        }}
      >
        {isEditMode ? (
          <input
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onUpdate(id, tempValue.trim());
                setIsEditMode(false);
              } else if (e.key === "Escape") {
                setTempValue(value);
                setIsEditMode(false);
              }
            }}
            autoFocus
            className={`px-1 w-full bg-transparent outline-none border-b border-primary ${
              isSelected ? "font-semibold" : ""
            } ${className}`}
          />
        ) : (
          <span
            style={{ direction: "ltr", unicodeBidi: "plaintext" }}
            className={`block overflow-hidden whitespace-nowrap text-ellipsis px-1 w-full min-h-[1.5em] select-none ${
              isSelected ? "font-semibold" : ""
            } ${!value && isEditing ? "border-b border-dashed border-gray-300" : ""} ${className}`}
          >
            {value || (isEditing ? "\u00A0" : "")}
          </span>
        )}
      </div>
    </div>
  );
}

// Original VerticalActionGroup component

interface VerticalActionGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function VerticalActionGroup({
  children,
  className = "",
}: VerticalActionGroupProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1 p-1 rounded-md ${className}`}
    >
      {children}
    </div>
  );
}
