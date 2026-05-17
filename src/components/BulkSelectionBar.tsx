import { IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/elements/dialog";
import { Button } from "@/components/elements/button";
import {
  useMultiSelect,
  MultiSelectKind,
  cancelMultiSelectAction,
} from "../stores/selectionStore";
import { trackEvent } from "../lib/analytics";

interface BulkSelectionBarProps {
  kind: MultiSelectKind;
  total: number;
  allIds: string[];
  onBulkDelete: (ids: string[]) => void;
  inline?: boolean;
  onExitComplete?: () => void;
}

export function BulkSelectionBar({
  kind,
  total,
  allIds,
  onBulkDelete,
  inline = false,
  onExitComplete,
}: BulkSelectionBarProps) {
  const { t } = useTranslation();
  const {
    multiSelected,
    multiSelectKind,
    enterMulti,
    exitMulti,
    setSelectedStaffId,
  } = useMultiSelect();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const inThisMulti = multiSelectKind === kind && multiSelected !== null;
  const checkedIds: string[] = inThisMulti ? Array.from(multiSelected) : [];
  const allChecked = total > 0 && checkedIds.length >= total;

  const [isVisible, setIsVisible] = useState(inThisMulti);
  const lastLiveStateRef = useRef({ count: checkedIds.length, allChecked });

  useEffect(() => {
    if (inThisMulti) {
      setIsVisible(true);
      lastLiveStateRef.current = { count: checkedIds.length, allChecked };
    }
  }, [inThisMulti, checkedIds.length, allChecked]);

  if (!isVisible) return null;

  const isExiting = !inThisMulti;
  const displayCount = isExiting ? lastLiveStateRef.current.count : checkedIds.length;
  const displayAllChecked = isExiting ? lastLiveStateRef.current.allChecked : allChecked;

  // Both "deselect all" and "Cancel" exit the multi-select bar. Per CEO
  // directive (round 5), exiting the staff variant must also clear the
  // viewing-selection so the availability panel returns to empty/default
  // — otherwise the previously selected staff member's availability stays
  // rendered after the bar disappears.
  const performCancel = (via: "deselect-all" | "cancel") => {
    trackEvent("multi-select-cancel", { kind, via });
    const action = cancelMultiSelectAction(kind);
    if (action.clearStaffSelection) setSelectedStaffId(null);
    if (action.exit) exitMulti();
  };

  const handleSelectAll = () => {
    if (allChecked) {
      performCancel("deselect-all");
    } else {
      trackEvent("multi-select-start", { kind, entry: "select-all" });
      enterMulti(allIds, kind);
    }
  };

  const handleCancel = () => {
    performCancel("cancel");
  };

  const handleConfirmDelete = () => {
    if (kind === "posts") {
      trackEvent("post-delete-bulk", { count: checkedIds.length });
    } else {
      trackEvent("user-delete-bulk", { count: checkedIds.length });
    }
    onBulkDelete(checkedIds);
    setIsDeleteDialogOpen(false);
  };

  const confirmTitle =
    kind === "staff"
      ? t("deleteStaffConfirm", { count: checkedIds.length })
      : t("deletePostsConfirm", { count: checkedIds.length });

  const animationCls = isExiting ? "animate-slide-up pointer-events-none" : "animate-slide-down";
  const rootClass = inline
    ? `flex items-center gap-1.5 text-foreground rounded-md h-[26px] px-2 ${animationCls}`
    : `flex items-center gap-2 text-foreground rounded-[10px] px-3 py-2 ${animationCls}`;

  const countPillClass = inline
    ? "bg-foreground/10 px-2 py-0 rounded-full text-[11px] font-semibold tabular-nums leading-[18px]"
    : "bg-foreground/10 px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums";

  const labelClass = inline
    ? "text-[11px] opacity-85"
    : "text-xs opacity-85";

  const actionButtonClass = inline
    ? "bg-foreground/10 hover:bg-foreground/20 text-foreground h-[20px] px-2 rounded text-[11px] font-medium inline-flex items-center gap-1"
    : "bg-foreground/10 hover:bg-foreground/20 text-foreground px-2.5 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5";

  const deleteButtonClass = inline
    ? "bg-destructive hover:brightness-110 text-destructive-foreground h-[20px] px-2 rounded text-[11px] font-semibold inline-flex items-center disabled:opacity-50"
    : "bg-destructive hover:brightness-110 text-destructive-foreground px-2.5 py-1.5 rounded-md text-xs font-semibold inline-flex items-center disabled:opacity-50";

  const iconSize = inline ? 12 : 13;

  return (
    <>
      <div
        className={rootClass}
        role="region"
        aria-label={t("nSelected", { count: displayCount })}
        onAnimationEnd={() => {
          if (isExiting) {
            setIsVisible(false);
            onExitComplete?.();
          }
        }}
      >
        <span className={countPillClass}>
          {displayCount}
        </span>
        <span className={labelClass}>{t("nSelected", { count: displayCount })}</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={handleSelectAll}
          className={actionButtonClass}
        >
          {displayAllChecked
            ? kind === "staff"
              ? t("deselectAllUsers")
              : t("deselectAllPosts")
            : t("selectAll")}
        </button>
        <button
          type="button"
          onClick={() => setIsDeleteDialogOpen(true)}
          disabled={displayCount === 0}
          className={deleteButtonClass}
        >
          {t("deleteCount", { count: displayCount })}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          aria-label={t("cancelSelection")}
          className={actionButtonClass}
        >
          <IconX size={iconSize} />
          {t("cancel")}
        </button>
      </div>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground">{t("onceDeletedNoUndo")}</p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                {t("no")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
              >
                {t("yesPlease")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
