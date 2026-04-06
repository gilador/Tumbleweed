import { useContext, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilValue } from "recoil";
import { IconRefresh, IconBrandGoogleDrive, IconExternalLink } from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LAST_LOCAL_SAVE_KEY, LAST_CLOUD_SAVE_KEY, DRIVE_ROSTER_CHECKSUM_KEY, computeChecksum } from "../lib/localStorageUtils";
import { shiftState } from "../stores/shiftStore";
import { CloudSyncContext, TriggerSyncContext, ShowDrivePromptContext } from "../App";
import { useAuth, isGoogleAuthAvailable } from "../lib/auth";
import { useIsMobile } from "../hooks/useIsMobile";

// Keep the type export for backward compat (shiftStore imports it)
export type SyncStatus = "synced" | "out-of-sync" | "syncing" | "idle" | "no-optimised";

function useFormatRelative() {
  const { t } = useTranslation();

  return (iso: string | null): string => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      if (isToday) return `${t("today")}, ${time}`;
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return `${t("yesterday")}, ${time}`;
      return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
    } catch {
      return "—";
    }
  };
}

function shortChecksum(full: string | null): string {
  if (!full) return "—";
  return full.substring(0, 7);
}

function SyncTimestamps() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const cloudSyncStatus = useContext(CloudSyncContext);
  const showDrivePrompt = useContext(ShowDrivePromptContext);
  const formatRelative = useFormatRelative();
  const recoil = useRecoilValue(shiftState);
  const [currentChecksum, setCurrentChecksum] = useState<string | null>(null);

  useEffect(() => {
    const { syncStatus, ...persistable } = recoil;
    computeChecksum(persistable).then(setCurrentChecksum);
  }, [recoil]);

  const localSave = localStorage.getItem(LAST_LOCAL_SAVE_KEY);
  const cloudSave = localStorage.getItem(LAST_CLOUD_SAVE_KEY);
  const localChecksum = localStorage.getItem("tumbleweed-local-checksum");
  const cloudChecksum = localStorage.getItem(DRIVE_ROSTER_CHECKSUM_KEY);

  let cloudDisplay: React.ReactNode;
  if (!isAuthenticated) {
    cloudDisplay = <span className="text-muted-foreground/60">{t("notSynced")}</span>;
  } else if (cloudSyncStatus === "permission-error") {
    cloudDisplay = (
      <span className="text-red-500">
        {t("permissionError")}
        <button
          onClick={() => showDrivePrompt?.()}
          className="inline-flex items-center ms-1 text-primary hover:text-primary/80"
          title={t("drivePromptConnect")}
        >
          <IconExternalLink size={12} />
        </button>
      </span>
    );
  } else {
    cloudDisplay = <span dir="ltr">({shortChecksum(cloudChecksum)}) {formatRelative(cloudSave)}</span>;
  }

  return (
    <div className="text-xs space-y-0.5">
      <div>{t("lastSync")}</div>
      <div>{t("currentState")}: <span dir="ltr">({shortChecksum(currentChecksum)}) {formatRelative(new Date().toISOString())}</span></div>
      <div>{t("localSync")}: <span dir="ltr">({shortChecksum(localChecksum)}) {formatRelative(localSave)}</span></div>
      <div>{t("cloudSync")}: {cloudDisplay}</div>
    </div>
  );
}

const COLORS = {
  green: "#16a34a",
  yellow: "#eab308",
  red: "#dc2626",
} as const;

type DerivedSync = "out-of-sync" | "half" | "full" | "drive-error";

function useDerivedSync(): { sync: DerivedSync; animating: boolean } {
  const recoil = useRecoilValue(shiftState);
  const { isAuthenticated } = useAuth();
  const cloudSyncStatus = useContext(CloudSyncContext);
  const [currentChecksum, setCurrentChecksum] = useState<string | null>(null);

  useEffect(() => {
    const { syncStatus, ...persistable } = recoil;
    computeChecksum(persistable).then(setCurrentChecksum);
  }, [recoil]);

  const localChecksum = localStorage.getItem("tumbleweed-local-checksum");
  const cloudChecksum = localStorage.getItem(DRIVE_ROSTER_CHECKSUM_KEY);

  // Drive error takes priority
  if (cloudSyncStatus === "error" || cloudSyncStatus === "permission-error" || cloudSyncStatus === "token-expired") {
    return { sync: "drive-error", animating: false };
  }

  // If not authenticated, cloud checksum is stale — treat as not synced
  const effectiveCloudChecksum = isAuthenticated ? cloudChecksum : null;

  let sync: DerivedSync;
  if (!currentChecksum || !localChecksum || currentChecksum !== localChecksum) {
    sync = "out-of-sync";
  } else if (!effectiveCloudChecksum || localChecksum !== effectiveCloudChecksum) {
    sync = "half";
  } else {
    sync = "full";
  }

  return { sync, animating: cloudSyncStatus === "syncing" };
}

function SyncCircleIcon({ size, sync, animating }: {
  size: number;
  sync: DerivedSync;
  animating: boolean;
}) {
  const r = 9;
  const cx = 12;
  const cy = 12;

  const leftColor = sync === "drive-error" ? COLORS.green : sync === "out-of-sync" ? COLORS.yellow : COLORS.green;
  const rightColor = sync === "drive-error" ? COLORS.red : sync === "full" ? COLORS.green : COLORS.yellow;
  const centerIcon: "check" | "question" | "exclamation" =
    sync === "drive-error" ? "exclamation" : sync === "out-of-sync" ? "question" : "check";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g
        className={animating ? "animate-spin" : ""}
        style={{
          transformOrigin: "12px 12px",
          animationDuration: animating ? "1.5s" : undefined,
        }}
      >
        <circle
          cx={cx} cy={cy} r={r}
          stroke={leftColor} strokeWidth="2" fill="none"
          strokeDasharray="2.83 2.83"
          mask="url(#left-mask)"
        />
        <circle
          cx={cx} cy={cy} r={r}
          stroke={rightColor} strokeWidth="2" fill="none"
          strokeDasharray="2.83 2.83"
          mask="url(#right-mask)"
        />
      </g>
      {centerIcon === "check" && (
        <path d="M9 12l2 2l4 -4" stroke={COLORS.green} strokeWidth="2" fill="none" />
      )}
      {centerIcon === "question" && (
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fill={COLORS.yellow} fontSize="12" fontWeight="bold" fontFamily="sans-serif">?</text>
      )}
      {centerIcon === "exclamation" && (
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fill={COLORS.red} fontSize="13" fontWeight="bold" fontFamily="sans-serif">!</text>
      )}
      <defs>
        <mask id="left-mask">
          <rect x="0" y="0" width="12" height="24" fill="white" />
        </mask>
        <mask id="right-mask">
          <rect x="12" y="0" width="12" height="24" fill="white" />
        </mask>
      </defs>
    </svg>
  );
}

interface SyncStatusIconProps {
  status?: SyncStatus;
  size?: number;
}

export function SyncStatusIcon({ size = 18 }: SyncStatusIconProps) {
  const isMobile = useIsMobile();
  const { sync, animating } = useDerivedSync();

  if (isMobile) {
    return <MobileSyncPopover size={size} sync={sync} animating={animating} />;
  }

  return <DesktopSyncIcon size={size} sync={sync} animating={animating} />;
}

function DesktopSyncIcon({ size, sync, animating }: {
  size: number;
  sync: DerivedSync;
  animating: boolean;
}) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const triggerSync = useContext(TriggerSyncContext);
  const showDrivePrompt = useContext(ShowDrivePromptContext);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => (isGoogleAuthAvailable && (!isAuthenticated || sync === "drive-error")) ? showDrivePrompt?.() : triggerSync?.()}
          className="cursor-pointer"
          disabled={animating}
        >
          <SyncCircleIcon size={size} sync={sync} animating={animating} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <SyncTimestamps />
        {isGoogleAuthAvailable && (!isAuthenticated || sync === "drive-error") && (
          <p className="text-xs text-primary mt-1">{t("drivePromptConnect")}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function MobileSyncPopover({ size, sync, animating }: {
  size: number;
  sync: DerivedSync;
  animating: boolean;
}) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const triggerSync = useContext(TriggerSyncContext);
  const showDrivePrompt = useContext(ShowDrivePromptContext);
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside as any);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside as any);
    };
  }, [open]);

  const handleSync = () => {
    triggerSync?.();
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button onClick={() => setOpen(!open)} className="p-1">
        <SyncCircleIcon size={size} sync={sync} animating={animating} />
      </button>
      {open && (
        <div className="absolute end-0 top-full mt-1 z-50 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md whitespace-nowrap space-y-2">
          <SyncTimestamps />
          <div className="flex items-center gap-2 text-xs font-medium">
            {(isAuthenticated || !isGoogleAuthAvailable) ? (
              <button
                onClick={handleSync}
                disabled={animating}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted hover:bg-accent text-primary disabled:opacity-50 active:scale-95 transition-all"
              >
                <IconRefresh size={14} className={animating ? "animate-spin" : ""} />
                {t("syncNow")}
              </button>
            ) : (
              <button
                onClick={() => { showDrivePrompt?.(); setOpen(false); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted hover:bg-accent text-primary active:scale-95 transition-all"
              >
                <IconBrandGoogleDrive size={14} />
                {t("drivePromptConnect")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
