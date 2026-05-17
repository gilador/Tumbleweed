import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { User } from "../../models";
import { StaffAvatar } from "../StaffAvatar";

interface WhoCellProps {
  pi: number;
  si: number;
  assignedUser: User | null;
  customDisplayName?: string;
  isHighlighted: boolean;
  isLocked: boolean;
  onClick?: (anchor: HTMLSpanElement) => void;
}

export const WhoCell = forwardRef<HTMLSpanElement, WhoCellProps>(function WhoCell(
  { pi, si, assignedUser, customDisplayName, isHighlighted, isLocked, onClick },
  ref
) {
  const { t } = useTranslation();
  const displayName =
    customDisplayName !== undefined
      ? customDisplayName
      : assignedUser
        ? assignedUser.name
        : "";
  const isEmpty = displayName === "" || displayName === "-";

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (isLocked) return;
    e.stopPropagation();
    if (onClick) onClick(e.currentTarget);
  };

  if (isEmpty) {
    return (
      <span
        ref={ref}
        className={`who empty inline-flex items-center gap-2 text-xs italic text-muted-foreground rounded-md px-1.5 py-1 transition-colors whitespace-nowrap ${
          isLocked ? "cursor-default" : "cursor-pointer hover:bg-muted"
        }`}
        data-pi={pi}
        data-si={si}
        onClick={handleClick}
      >
        <span>— {t("clickToAssign")}</span>
      </span>
    );
  }

  return (
    <span
      ref={ref}
      className={`who inline-flex items-center gap-2 text-xs rounded-md px-1.5 py-1 min-w-0 transition-colors ${
        isLocked ? "cursor-default" : "cursor-pointer hover:bg-muted"
      } ${isHighlighted ? "highlighted ring-2 ring-primary" : ""}`}
      data-pi={pi}
      data-si={si}
      onClick={handleClick}
    >
      <StaffAvatar
        size="sm"
        id={assignedUser?.id ?? ""}
        name={displayName}
      />
      <span className="truncate">{displayName}</span>
    </span>
  );
});
