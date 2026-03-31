import { useCallback, useState } from "react";
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
import { api } from "../lib/apiClient";

interface UpgradePromptProps {
  feature: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradePrompt({ feature, open, onOpenChange }: UpgradePromptProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const { url } = await api.post<{ url: string }>("/billing/checkout");
      if (url) {
        window.location.href = url;
      }
    } catch {
      setLoading(false);
    }
  }, [isAuthenticated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("upgradeToPro")}</DialogTitle>
          <DialogDescription>
            <strong>{feature}</strong> {t("upgradeDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            {t("maybeLater")}
          </Button>
          <Button onClick={handleUpgrade} disabled={loading} size="sm">
            {loading ? t("redirecting") : t("upgradeNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
