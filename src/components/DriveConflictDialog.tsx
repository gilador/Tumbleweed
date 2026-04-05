import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/elements/dialog";
import { Button } from "@/components/elements/button";
import type { DriveConflict } from "../hooks/useDrivePersistence";

interface DriveConflictDialogProps {
  conflicts: DriveConflict[];
  onResolve: (conflict: DriveConflict, choice: "drive" | "local") => void;
}

export function DriveConflictDialog({ conflicts, onResolve }: DriveConflictDialogProps) {
  const { t } = useTranslation();
  const conflict = conflicts[0];
  if (!conflict) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {t("driveConflictShiftTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("driveConflictShiftDesc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="default"
            className="px-8"
            onClick={() => onResolve(conflict, "drive")}
          >
            {t("driveConflictUseDrive")}
          </Button>
          <Button
            variant="outline"
            className="px-8"
            onClick={() => onResolve(conflict, "local")}
          >
            {t("driveConflictKeepLocal")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
