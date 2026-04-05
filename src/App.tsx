import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RecoilRoot } from "recoil";
import { IconCloudDownload, IconBrandGoogleDrive } from "@tabler/icons-react";

export type CloudSyncStatus = "idle" | "syncing" | "synced" | "error" | "permission-error" | "token-expired";
export const CloudSyncContext = createContext<CloudSyncStatus>("idle");
export const TriggerSyncContext = createContext<(() => void) | null>(null);
export const ShowDrivePromptContext = createContext<(() => void) | null>(null);
import { ShiftManager } from "./components/ShiftManager";
import { MobileShell } from "./components/mobile/MobileShell";
import { PrintView } from "./components/PrintView";
import { PrivacyPolicyDialog } from "./components/PrivacyPolicyDialog";
import { TermsOfServiceDialog } from "./components/TermsOfServiceDialog";
import { useIsMobile } from "./hooks/useIsMobile";
import { useDrivePersistence } from "./hooks/useDrivePersistence";
import { DriveConflictDialog } from "./components/DriveConflictDialog";
import { AuthProvider, useAuth } from "./lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/elements/dialog";
import { Button } from "@/components/elements/button";

const queryClient = new QueryClient();

function useHashRoute(hash: string) {
  const [isOpen, setIsOpen] = useState(
    () => window.location.hash === `#${hash}`
  );

  useEffect(() => {
    const onHashChange = () => {
      setIsOpen(window.location.hash === `#${hash}`);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [hash]);

  const close = useCallback(() => {
    setIsOpen(false);
    history.replaceState("", "", location.pathname + location.search);
  }, []);

  return [isOpen, close] as const;
}

function AppFooter() {
  const { t } = useTranslation();
  return (
    <footer className="container flex items-center justify-center gap-3 py-1 text-[11px] text-gray-400 select-none flex-none">
      <button onClick={() => { location.hash = "privacy_policy"; }} className="hover:text-gray-600 hover:underline transition-colors">
        {t("privacyPolicy")}
      </button>
      <span>·</span>
      <button onClick={() => { location.hash = "term_of_service"; }} className="hover:text-gray-600 hover:underline transition-colors">
        {t("termsOfService")}
      </button>
    </footer>
  );
}

const DRIVE_CONNECT_DISMISSED_KEY = "tumbleweed-drive-connect-dismissed";

type DrivePromptReason = "not-connected" | "token-expired" | "permission-error" | null;

function DriveConnectPrompt({ cloudSyncStatus, forceShow, onForceShowHandled, isManual }: {
  cloudSyncStatus: CloudSyncStatus;
  forceShow: boolean;
  onForceShowHandled: () => void;
  isManual: boolean;
}) {
  const { t } = useTranslation();
  const { isAuthenticated, signInWithGoogle } = useAuth();
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(DRIVE_CONNECT_DISMISSED_KEY) === "true"
  );
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Determine the reason to show the prompt
  let reason: DrivePromptReason = null;
  if (cloudSyncStatus === "token-expired") {
    reason = "token-expired";
  } else if (cloudSyncStatus === "permission-error") {
    reason = "permission-error";
  } else if (!isAuthenticated) {
    reason = "not-connected";
  }

  // Force show overrides dismiss
  const shouldShow = forceShow || (reason && !dismissed);
  if (!shouldShow || !reason) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onForceShowHandled();
    if (dontShowAgain) {
      localStorage.setItem(DRIVE_CONNECT_DISMISSED_KEY, "true");
    }
  };

  const config = {
    "not-connected": {
      iconColor: "text-primary",
      title: t("drivePromptTitle"),
      desc: t("drivePromptDesc"),
      cta: t("drivePromptConnect"),
      showPrivacy: true,
    },
    "token-expired": {
      iconColor: "text-amber-500",
      title: t("driveTokenExpiredTitle"),
      desc: t("driveTokenExpiredDesc"),
      cta: t("driveTokenExpiredReconnect"),
      showPrivacy: false,
    },
    "permission-error": {
      iconColor: "text-red-500",
      title: t("drivePermissionTitle"),
      desc: t("drivePermissionDesc"),
      cta: t("drivePermissionGrant"),
      showPrivacy: false,
    },
  }[reason];

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <IconBrandGoogleDrive size={36} className={config.iconColor} />
          </div>
          <DialogTitle className="text-center">
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-center">
            {config.desc}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="default"
            className="px-8"
            onClick={() => { signInWithGoogle(); localStorage.setItem(DRIVE_CONNECT_DISMISSED_KEY, "true"); setDismissed(true); }}
          >
            {config.cta}
          </Button>
          <Button
            variant="outline"
            className="px-8"
            onClick={handleDismiss}
          >
            {t("drivePromptSkip")}
          </Button>
        </DialogFooter>
        {!isManual && (
          <div className="flex items-center justify-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="h-3 w-3 rounded border-border"
              />
              <span className="text-[11px] text-muted-foreground">{t("drivePromptDontShow")}</span>
            </label>
          </div>
        )}
        {config.showPrivacy && (
          <p className="text-[10px] text-muted-foreground/60 text-center">
            {t("drivePromptPrivacy")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SyncOverlay() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <IconCloudDownload size={36} className="animate-pulse" />
        <p className="text-sm font-medium">{t("syncingWithDrive")}</p>
      </div>
    </div>
  );
}

function AppContent() {
  const isMobile = useIsMobile();
  const { conflicts, resolveConflict, isSyncing, cloudSyncStatus, triggerSync } = useDrivePersistence();
  const [privacyOpen, closePrivacy] = useHashRoute("privacy_policy");
  const [tosOpen, closeTos] = useHashRoute("term_of_service");
  const [forceShowDrivePrompt, setForceShowDrivePrompt] = useState(false);
  const showDrivePrompt = useCallback(() => setForceShowDrivePrompt(true), []);

  const dialogs = (
    <>
      <PrivacyPolicyDialog
        open={privacyOpen}
        onOpenChange={(open) => {
          if (!open) closePrivacy();
        }}
      />
      <TermsOfServiceDialog
        open={tosOpen}
        onOpenChange={(open) => {
          if (!open) closeTos();
        }}
      />
      <DriveConflictDialog conflicts={conflicts} onResolve={resolveConflict} />
      <DriveConnectPrompt
        cloudSyncStatus={cloudSyncStatus}
        forceShow={forceShowDrivePrompt}
        onForceShowHandled={() => setForceShowDrivePrompt(false)}
        isManual={forceShowDrivePrompt}
      />
    </>
  );

  const footer = <AppFooter />;

  if (isMobile) {
    return (
      <CloudSyncContext.Provider value={cloudSyncStatus}>
      <TriggerSyncContext.Provider value={triggerSync}>
      <ShowDrivePromptContext.Provider value={showDrivePrompt}>
        {isSyncing && <SyncOverlay />}
        <MobileShell />
        <PrintView />
        {dialogs}
      </ShowDrivePromptContext.Provider>
      </TriggerSyncContext.Provider>
      </CloudSyncContext.Provider>
    );
  }

  return (
    <CloudSyncContext.Provider value={cloudSyncStatus}>
    <TriggerSyncContext.Provider value={triggerSync}>
    <ShowDrivePromptContext.Provider value={showDrivePrompt}>
      <div className="bg-background flex flex-col h-screen pb-1">
        {isSyncing && <SyncOverlay />}
        <div className="container flex h-4"></div>
        <main className="container flex-1 overflow-hidden">
          <ShiftManager />
        </main>
        {footer}
        <PrintView />
        {dialogs}
      </div>
    </ShowDrivePromptContext.Provider>
    </TriggerSyncContext.Provider>
    </CloudSyncContext.Provider>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RecoilRoot>
          <AppContent />
        </RecoilRoot>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;

