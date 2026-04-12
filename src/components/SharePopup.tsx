import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilValue } from "recoil";
import {
  IconShare,
  IconDownload,
  IconPrinter,
  IconBrandWhatsapp,
  IconBrandGoogleDrive,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/elements/dialog";
import { Checkbox } from "@/components/elements/checkbox";
import { shiftState } from "@/stores/shiftStore";
import { generateRosterPdf } from "@/service/pdf/generateRosterPdf";
import { generateStaffPdf } from "@/service/pdf/generateStaffPdf";
import { hasGoogleDriveAccess } from "@/lib/googleDrive";
import { exportScheduleToDrive } from "@/lib/driveExport";
import type { RosterState, UserShiftData } from "@/models";

type ViewMode = "full" | "staff";

interface SharePopupProps {
  onCopied?: () => void;
  disabled?: boolean;
}

const isMobile =
  typeof window !== "undefined" &&
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function getAssignedStaffIds(
  rosters: RosterState[],
  userShiftData: UserShiftData[]
): { id: string; name: string }[] {
  const assignedIds = new Set<string>();
  for (const roster of rosters) {
    if (!roster.assignments) continue;
    for (const postAssignments of roster.assignments) {
      for (const userId of postAssignments) {
        if (userId) assignedIds.add(userId);
      }
    }
  }
  return userShiftData
    .filter((u) => assignedIds.has(u.user.id))
    .map((u) => ({ id: u.user.id, name: u.user.name }));
}

function hasAnyAssignments(rosters: RosterState[]): boolean {
  return rosters.some((r) =>
    r.assignments?.some((post) => post.some((u) => u !== null))
  );
}

export function SharePopup({ onCopied, disabled }: SharePopupProps) {
  const { t, i18n } = useTranslation();
  const state = useRecoilValue(shiftState);
  const allRosters = state.rosters;
  const activeRosterId = state.activeRosterId;
  const userShiftData = state.userShiftData || [];
  const locale = i18n.language === "he" ? "he-IL" : "en-US";

  const [open, setOpen] = useState(false);
  const [selectedRosterIds, setSelectedRosterIds] = useState<Set<string>>(
    new Set([activeRosterId])
  );
  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [driveLoading, setDriveLoading] = useState(false);

  // Reset state when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSelectedRosterIds(new Set([activeRosterId]));
      setViewMode("full");
      setSelectedStaffId("");
      setDriveLoading(false);
    }
    setOpen(nextOpen);
  };

  const selectedRosters = useMemo(
    () => allRosters.filter((r) => selectedRosterIds.has(r.id)),
    [allRosters, selectedRosterIds]
  );

  const assignedStaff = useMemo(
    () => getAssignedStaffIds(selectedRosters, userShiftData),
    [selectedRosters, userShiftData]
  );

  // Auto-select first staff when switching to staff mode
  const effectiveStaffId =
    viewMode === "staff" && assignedStaff.length > 0
      ? assignedStaff.find((s) => s.id === selectedStaffId)?.id ||
        assignedStaff[0].id
      : "";

  const canExport = hasAnyAssignments(selectedRosters);

  const toggleRoster = (rosterId: string) => {
    setSelectedRosterIds((prev) => {
      const next = new Set(prev);
      if (next.has(rosterId)) {
        if (next.size > 1) next.delete(rosterId);
      } else {
        next.add(rosterId);
      }
      return next;
    });
  };

  // --- PDF generation ---

  async function generatePdfs(): Promise<{ filename: string; blob: Blob }[]> {
    if (viewMode === "staff" && effectiveStaffId) {
      const staff = assignedStaff.find((s) => s.id === effectiveStaffId);
      if (!staff) return [];
      const blob = await generateStaffPdf({
        staffName: staff.name,
        staffId: staff.id,
        rosters: selectedRosters,
        userShiftData,
        locale,
      });
      return [{ filename: `${staff.name}.pdf`, blob }];
    }

    // Full roster mode — one PDF per selected roster
    const results = await Promise.all(
      selectedRosters.map(async (roster) => {
        const blob = await generateRosterPdf({ roster, userShiftData, locale });
        const name = roster.name || "roster";
        return { filename: `${name}.pdf`, blob };
      })
    );
    return results;
  }

  // --- Actions ---

  const handleDownload = async () => {
    const pdfs = await generatePdfs();
    for (const { filename, blob } of pdfs) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
    setOpen(false);
  };

  const handlePrint = async () => {
    const pdfs = await generatePdfs();
    if (pdfs.length === 0) return;
    // Open the first PDF in a new window for printing
    const blob = pdfs[0].blob;
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url);
    if (printWindow) {
      printWindow.addEventListener("load", () => {
        printWindow.print();
      });
    }
    setOpen(false);
  };

  const handleWhatsApp = async () => {
    const pdfs = await generatePdfs();
    if (pdfs.length === 0) return;

    // Mobile: try native share with file
    if (isMobile && typeof navigator.share === "function") {
      try {
        const files = pdfs.map(
          ({ filename, blob }) => new File([blob], filename, { type: "application/pdf" })
        );
        await navigator.share({ files });
        setOpen(false);
        return;
      } catch {
        // User cancelled or share failed — fall through to download
      }
    }

    // Desktop: if Drive connected, we could share a link, but for now just download
    await handleDownload();
  };

  const handleDriveExport = async () => {
    if (!hasGoogleDriveAccess()) return;
    setDriveLoading(true);
    try {
      // Generate all PDFs (roster + staff) for Drive export
      const rosterPdfs = await Promise.all(
        selectedRosters.map(async (roster) => ({
          filename: `${roster.name || "roster"}-roster.pdf`,
          blob: await generateRosterPdf({ roster, userShiftData, locale }),
        }))
      );

      const staffPdfs = await Promise.all(
        assignedStaff.map(async (staff) => ({
          filename: `${staff.name}.pdf`,
          blob: await generateStaffPdf({
            staffName: staff.name,
            staffId: staff.id,
            rosters: selectedRosters,
            userShiftData,
            locale,
          }),
        }))
      );

      const activeRoster = allRosters.find((r) => r.id === activeRosterId) || allRosters[0];

      await exportScheduleToDrive({
        rosterPdfs,
        staffPdfs,
        scheduleMode: activeRoster.scheduleMode,
        startDate: activeRoster.startDate,
      });

      onCopied?.();
      setOpen(false);
    } catch (err) {
      console.error("[SharePopup] Drive export failed:", err);
    } finally {
      setDriveLoading(false);
    }
  };

  const showDriveOption = hasGoogleDriveAccess();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          disabled={disabled}
          className="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
          title={t("shareSchedule")}
        >
          <IconShare size={16} className="text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("shareSchedule")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Roster selector (only show if multiple rosters) */}
          {allRosters.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("rosters")}</label>
              <div className="space-y-1.5">
                {allRosters.map((roster) => (
                  <label
                    key={roster.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedRosterIds.has(roster.id)}
                      onCheckedChange={() => toggleRoster(roster.id)}
                    />
                    <span className="text-sm">
                      {roster.name || t("roster")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* View mode toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("full")}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === "full"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {t("fullRoster")}
            </button>
            <button
              onClick={() => setViewMode("staff")}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === "staff"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {t("staffMember")}
            </button>
          </div>

          {/* Staff selector */}
          {viewMode === "staff" && (
            <div className="rounded-md border border-border bg-background max-h-[160px] overflow-y-auto">
              {assignedStaff.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {t("noAssignmentsToShare")}
                </div>
              ) : (
                assignedStaff.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => setSelectedStaffId(staff.id)}
                    className={`w-full px-3 py-2 text-sm text-start transition-colors ${
                      effectiveStaffId === staff.id
                        ? "bg-primary/10 font-medium"
                        : "hover:bg-accent"
                    }`}
                  >
                    {staff.name}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-1">
            {showDriveOption && (
              <button
                onClick={handleDriveExport}
                disabled={!canExport || driveLoading}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <IconBrandGoogleDrive size={18} />
                <span>
                  {driveLoading ? t("exportingToDrive") : t("shareToDrive")}
                </span>
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={!canExport}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <IconDownload size={18} />
              <span>{t("downloadPdf")}</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={!canExport}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <IconPrinter size={18} />
              <span>{t("print")}</span>
            </button>
            <button
              onClick={handleWhatsApp}
              disabled={!canExport}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <IconBrandWhatsapp size={18} />
              <span>{t("whatsapp")}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
