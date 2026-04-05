import {
  IconPlus,
  IconTrash,
  IconSelectAll,
  IconDeselect,
  IconRestore,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/elements/dialog";
import { Button } from "@/components/elements/button";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface WorkerListActionsProps {
  isEditing: boolean;
  onAddUser: () => void;
  onRemoveUsers: (userIds: string[]) => void;
  checkedUserIds: string[];
  onCheckAll: (allWasClicked: boolean) => void;
  onResetAllAvailability?: () => void;
}

export function WorkerListActions({
  isEditing,
  onAddUser,
  onRemoveUsers,
  checkedUserIds,
  onCheckAll,
  onResetAllAvailability,
}: WorkerListActionsProps) {
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetAvailabilityDialogOpen, setIsResetAvailabilityDialogOpen] =
    useState(false);
  const [checkAllEnabled, setCheckAllEnabled] = useState(false);

  const handleDelete = () => {
    if (checkedUserIds.length === 0) {
      return; // No users selected
    }
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    onRemoveUsers(checkedUserIds);
    setIsDeleteDialogOpen(false);
    setCheckAllEnabled(false);
  };

  const handleCheckAll = () => {
    setCheckAllEnabled((prev) => {
      const newValue = !prev;
      onCheckAll(newValue);
      return newValue;
    });
  };

  const handleResetAvailability = () => {
    if (onResetAllAvailability) {
      onResetAllAvailability();
      setIsResetAvailabilityDialogOpen(false);
    }
  };

  return (
    <div
      id="worker-list-actions"
      className={`flex items-center bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 transition-all duration-200 ease-in-out flex-initial gap-1 mx-1 ${
        isEditing ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0 pointer-events-none"
      }`}
    >
      <button
        onClick={onAddUser}
        aria-label={t("addUser")}
        title={t("addUser")}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
      >
        <IconPlus size={15} />
      </button>
      <button
        onClick={handleDelete}
        aria-label={t("deleteSelectedUsers")}
        title={t("deleteSelectedUsers")}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
      >
        <IconTrash size={15} />
      </button>
      <button
        onClick={handleCheckAll}
        aria-label={t("selectAllUsers")}
        title={t("selectAllUsers")}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
      >
        {checkAllEnabled ? (
          <IconDeselect size={15} strokeWidth={2} />
        ) : (
          <IconSelectAll size={15} strokeWidth={2} />
        )}
      </button>
      {onResetAllAvailability && (
        <button
          onClick={() => setIsResetAvailabilityDialogOpen(true)}
          aria-label={t("resetAllUserAvailability")}
          title={t("resetAllUserAvailabilityToAvailable")}
          className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
        >
          <IconRestore size={15} />
        </button>
      )}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("deleteStaffConfirm", { count: checkedUserIds.length })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              {t("onceDeletedNoUndo")}
            </p>
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
      <Dialog
        open={isResetAvailabilityDialogOpen}
        onOpenChange={setIsResetAvailabilityDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("resetAllAvailabilityTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p>
              {t("resetAllAvailabilityDescription")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsResetAvailabilityDialogOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleResetAvailability}
              >
                {t("resetAllAvailabilityTitle")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
