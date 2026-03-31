import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/elements/button";
import { useAuth } from "../lib/auth";
import { api } from "../lib/apiClient";
import { listRegulationRules } from "../constraints/engine";
import type { ConstraintConfig, CustomRuleConfig } from "../constraints/types";

interface ConstraintConfigPanelProps {
  onConfigChange?: (config: ConstraintConfig) => void;
}

export function ConstraintConfigPanel({ onConfigChange }: ConstraintConfigPanelProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [config, setConfig] = useState<ConstraintConfig>({
    activeRegulations: [],
    customRules: [],
  });
  const [saving, setSaving] = useState(false);

  const regulationRules = listRegulationRules();

  useEffect(() => {
    if (isAuthenticated) {
      api
        .get<{ activeRegulations: string[]; customRules: CustomRuleConfig[] }>("/constraints")
        .then((serverConfig) => {
          const loaded: ConstraintConfig = {
            activeRegulations: serverConfig.activeRegulations ?? [],
            customRules: serverConfig.customRules ?? [],
          };
          setConfig(loaded);
          onConfigChange?.(loaded);
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const toggleRegulation = (ruleId: string) => {
    setConfig((prev) => {
      const active = prev.activeRegulations.includes(ruleId)
        ? prev.activeRegulations.filter((id) => id !== ruleId)
        : [...prev.activeRegulations, ruleId];
      const next = { ...prev, activeRegulations: active };
      onConfigChange?.(next);
      return next;
    });
  };

  const addMaxShiftsRule = () => {
    setConfig((prev) => {
      const next: ConstraintConfig = {
        ...prev,
        customRules: [
          ...prev.customRules,
          { type: "max-shifts-per-week", params: { maxShifts: 5 } },
        ],
      };
      onConfigChange?.(next);
      return next;
    });
  };

  const removeCustomRule = (index: number) => {
    setConfig((prev) => {
      const next: ConstraintConfig = {
        ...prev,
        customRules: prev.customRules.filter((_, i) => i !== index),
      };
      onConfigChange?.(next);
      return next;
    });
  };

  const handleSave = async () => {
    if (!isAuthenticated) return;
    setSaving(true);
    try {
      await api.put("/constraints", {
        activeRegulations: config.activeRegulations,
        customRules: config.customRules,
      });
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">{t("laborRegulations")}</h4>
        <div className="space-y-1">
          {regulationRules.map((rule) => (
            <label key={rule.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.activeRegulations.includes(rule.id)}
                onChange={() => toggleRegulation(rule.id)}
                className="rounded"
              />
              {rule.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-2">{t("customRules")}</h4>
        {config.customRules.map((rule, i) => (
          <div key={i} className="flex items-center gap-2 text-sm mb-1">
            <span>
              {rule.type === "max-shifts-per-week"
                ? t("maxShiftsPerWeek", { count: rule.params.maxShifts })
                : rule.type}
            </span>
            <button
              onClick={() => removeCustomRule(i)}
              className="text-red-500 hover:text-red-700 text-xs"
            >
              {t("remove")}
            </button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addMaxShiftsRule}>
          {t("addMaxShiftsRule")}
        </Button>
      </div>

      {isAuthenticated && (
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? t("saving") : t("saveToServer")}
        </Button>
      )}
    </div>
  );
}
