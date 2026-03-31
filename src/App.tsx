import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RecoilRoot } from "recoil";
import { ShiftManager } from "./components/ShiftManager";
import { MobileShell } from "./components/mobile/MobileShell";
import { PrintView } from "./components/PrintView";
import { PrivacyPolicyDialog } from "./components/PrivacyPolicyDialog";
import { TermsOfServiceDialog } from "./components/TermsOfServiceDialog";
import { useIsMobile } from "./hooks/useIsMobile";
import { AuthProvider } from "./lib/auth";

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

function AppContent() {
  const isMobile = useIsMobile();
  const [privacyOpen, closePrivacy] = useHashRoute("privacy_policy");
  const [tosOpen, closeTos] = useHashRoute("term_of_service");

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
    </>
  );

  const footer = <AppFooter />;

  if (isMobile) {
    return (
      <>
        <MobileShell />
        <PrintView />
        {dialogs}
      </>
    );
  }

  return (
    <div className="bg-background flex flex-col h-screen pb-1">
      <div className="container flex h-4"></div>
      <main className="container flex-1 overflow-hidden">
        <ShiftManager />
      </main>
      {footer}
      <PrintView />
      {dialogs}
    </div>
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

