import { useTranslation } from "react-i18next";

export type GroupBy = "time" | "position";

interface GroupToggleProps {
  value: GroupBy;
  onChange: (next: GroupBy) => void;
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function GroupToggle({ value, onChange }: GroupToggleProps) {
  const { t } = useTranslation();

  const baseBtn =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors";
  const activeCls = "bg-muted";
  const inactiveCls = "text-muted-foreground hover:bg-muted";

  // Map "post" data attribute (artifact) to internal "position" value to keep
  // type union meaningful while preserving the artifact's selector contract.
  return (
    <div
      className="inline-flex items-center rounded-md border bg-background overflow-hidden"
      role="group"
      aria-label={t("groupBy.timeAria")}
    >
      <button
        type="button"
        data-group="time"
        aria-pressed={value === "time"}
        aria-label={t("groupBy.timeAria")}
        className={`${baseBtn} ${value === "time" ? activeCls : inactiveCls}`}
        onClick={() => {
          if (value !== "time") onChange("time");
        }}
      >
        <ClockIcon />
        <span>{t("groupBy.time")}</span>
      </button>
      <button
        type="button"
        data-group="post"
        aria-pressed={value === "position"}
        aria-label={t("groupBy.positionAria")}
        className={`${baseBtn} ${value === "position" ? activeCls : inactiveCls}`}
        onClick={() => {
          if (value !== "position") onChange("position");
        }}
      >
        <PinIcon />
        <span>{t("groupBy.position")}</span>
      </button>
    </div>
  );
}
