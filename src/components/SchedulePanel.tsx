import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/elements/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/elements/dialog";
import { useAuth } from "../lib/auth";
import { useServerSchedule } from "../hooks/useServerSchedule";
import { useTeamEvents } from "../hooks/useTeamEvents";
import type { ScheduleState, SSEEvent } from "@tumbleweed/shared";

const STATE_LABEL_KEYS: Record<ScheduleState, string> = {
  draft: "stateDraft",
  open: "stateOpen",
  closed: "stateClosed",
  published: "statePublished",
};

const STATE_TRANSITION_KEYS: Record<ScheduleState, { next: ScheduleState; labelKey: string } | null> = {
  draft: { next: "open", labelKey: "transitionOpenForStaff" },
  open: { next: "closed", labelKey: "transitionCloseSubmissions" },
  closed: { next: "published", labelKey: "transitionPublishSchedule" },
  published: null,
};

interface SchedulePanelProps {
  onAvailabilityUpdate?: (scheduleId: string) => void;
}

export function SchedulePanel({ onAvailabilityUpdate }: SchedulePanelProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const {
    activeSchedule,
    createSchedule,
    transitionState,
    getSchedules,
  } = useServerSchedule();

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    nextState: ScheduleState;
    label: string;
  }>({ open: false, nextState: "draft", label: "" });

  const [submissionCount, setSubmissionCount] = useState(0);

  // Listen for SSE events
  useTeamEvents({
    enabled: isAuthenticated,
    onEvent: useCallback(
      (event: SSEEvent) => {
        if (event.type === "availability-submitted") {
          setSubmissionCount((c) => c + 1);
          if (activeSchedule) {
            onAvailabilityUpdate?.(activeSchedule.id);
          }
        }
      },
      [activeSchedule, onAvailabilityUpdate]
    ),
  });

  // Load existing schedules on mount
  useEffect(() => {
    if (isAuthenticated) {
      getSchedules().catch(() => {});
    }
  }, [isAuthenticated, getSchedules]);

  if (!isAuthenticated) return null;

  const handleCreateSchedule = async () => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await createSchedule(
      now.toISOString(),
      weekFromNow.toISOString(),
      [],
      []
    );
  };

  const handleTransition = (nextState: ScheduleState, label: string) => {
    setConfirmDialog({ open: true, nextState, label });
  };

  const confirmTransition = async () => {
    if (!activeSchedule) return;
    await transitionState(activeSchedule.id, confirmDialog.nextState);
    setConfirmDialog({ open: false, nextState: "draft", label: "" });
  };

  const transition = activeSchedule
    ? STATE_TRANSITION_KEYS[activeSchedule.state]
    : null;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-sm">
      {!activeSchedule ? (
        <Button variant="outline" size="sm" onClick={handleCreateSchedule}>
          {t("newSchedule")}
        </Button>
      ) : (
        <>
          <span className="font-medium text-blue-700">
            {t(STATE_LABEL_KEYS[activeSchedule.state])}
          </span>
          {activeSchedule.state === "open" && submissionCount > 0 && (
            <span className="text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full text-xs font-medium">
              {t("submissionCountNew", { count: submissionCount })}
            </span>
          )}
          {transition && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTransition(transition.next, t(transition.labelKey))}
            >
              {t(transition.labelKey)}
            </Button>
          )}
        </>
      )}

      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.label}?</DialogTitle>
            <DialogDescription>
              {t("scheduleTransitionConfirm", { state: t(STATE_LABEL_KEYS[confirmDialog.nextState]).toLowerCase() })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
              size="sm"
            >
              {t("cancel")}
            </Button>
            <Button onClick={confirmTransition} size="sm">
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
