import {
  IconCircleDashedCheck,
  IconAlertCircle,
  IconRefresh,
  IconClockHour4,
  IconCircleDashedMinus,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SyncStatus = "synced" | "out-of-sync" | "syncing" | "idle" | "no-optimised";

interface SyncStatusIconProps {
  status: SyncStatus;
  size?: number;
}

export function SyncStatusIcon({ status, size = 18 }: SyncStatusIconProps) {
  const { t } = useTranslation();
  const renderIcon = () => {
    switch (status) {
      case "synced":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <IconCircleDashedCheck
                size={size}
                aria-label={t("statusSynced")}
                className="text-green-600 cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("syncedDescription")}</p>
            </TooltipContent>
          </Tooltip>
        );
      case "out-of-sync":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <IconAlertCircle
                size={size}
                aria-label={t("statusOutOfSync")}
                className="text-red-600 cursor-help animate-pulse-error"
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("outOfSyncDescription")}</p>
            </TooltipContent>
          </Tooltip>
        );
      case "syncing":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <IconRefresh
                size={size}
                className="animate-spin cursor-help"
                aria-label={t("statusSyncing")}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("syncingDescription")}</p>
            </TooltipContent>
          </Tooltip>
        );
      case "idle":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <IconClockHour4
                size={size}
                aria-label={t("statusIdle")}
                className="text-gray-400 cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("idleDescription")}</p>
            </TooltipContent>
          </Tooltip>
        );
      case "no-optimised":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <IconCircleDashedMinus
                size={size}
                aria-label={t("statusNotOptimized")}
                className="text-yellow-500 cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("notOptimizedDescription")}</p>
            </TooltipContent>
          </Tooltip>
        );
      default:
        return null;
    }
  };

  return renderIcon();
}
