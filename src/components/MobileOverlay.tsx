
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function MobileOverlay() {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);

  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check for mobile width (md breakpoint is usually 768px in tailwind)
      // or if user agent hints at a mobile device
      const isMobileWidth = window.innerWidth < 768;
      const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      setIsMobile(isMobileWidth || isMobileUA);
    };

    const dismissed = sessionStorage.getItem("mobile-overlay-dismissed");
    if (dismissed === "true") {
      setIsDismissed(true);
    }

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("mobile-overlay-dismissed", "true");
  };

  if (!isMobile || isDismissed) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="max-w-md space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("desktopOnlySupport")}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t("mobileNotReady")}
        </p>
        <button
          onClick={handleDismiss}
          className="text-sm text-primary underline hover:text-primary/80"
        >
          {t("continueAnyway")}
        </button>
      </div>
    </div>
  );
}
