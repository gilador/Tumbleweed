import { IconLayoutList, IconUsers, IconClipboardList } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export type TabId = "settings" | "staff" | "assignments";

interface MobileTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; labelKey: string; icon: typeof IconLayoutList }[] = [
  { id: "settings", labelKey: "posts", icon: IconLayoutList },
  { id: "staff", labelKey: "staff", icon: IconUsers },
  { id: "assignments", labelKey: "assignments", icon: IconClipboardList },
];

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
  const { t } = useTranslation();
  return (
    <nav className="flex-none border-t border-border bg-background" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex">
        {tabs.map(({ id, labelKey, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex-1 flex flex-col items-center justify-center min-h-[56px] py-2 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <Icon size={22} stroke={isActive ? 2.5 : 1.5} />
              <span className={`text-xs mt-1 ${isActive ? "font-semibold" : ""}`}>
                {t(labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
