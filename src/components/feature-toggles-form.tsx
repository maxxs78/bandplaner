"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";
import { ToggleRow } from "@/components/ui/toggle-row";
import type { FormState } from "@/app/(app)/bands/[bandId]/settings/actions";

export function FeatureTogglesForm({
  action,
  initialEquipmentEnabled,
  initialPacklistsEnabled,
  initialFinanceEnabled,
  initialFinanceSettlementMode,
  initialCommunicationEnabled,
  initialMediaPlayerEnabled,
  initialKeyDetectionEnabled,
  initialLocationsEnabled,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  initialEquipmentEnabled: boolean;
  initialPacklistsEnabled: boolean;
  initialFinanceEnabled: boolean;
  initialFinanceSettlementMode: "NO_BALANCE" | "BAND_BALANCE";
  initialCommunicationEnabled: boolean;
  initialMediaPlayerEnabled: boolean;
  initialKeyDetectionEnabled: boolean;
  initialLocationsEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [equipmentEnabled, setEquipmentEnabled] = useState(initialEquipmentEnabled);
  const [packlistsEnabled, setPacklistsEnabled] = useState(initialPacklistsEnabled);
  const [financeEnabled, setFinanceEnabled] = useState(initialFinanceEnabled);
  const [financeSettlementMode, setFinanceSettlementMode] = useState(initialFinanceSettlementMode);
  const [communicationEnabled, setCommunicationEnabled] = useState(initialCommunicationEnabled);
  const [mediaPlayerEnabled, setMediaPlayerEnabled] = useState(initialMediaPlayerEnabled);
  const [keyDetectionEnabled, setKeyDetectionEnabled] = useState(initialKeyDetectionEnabled);
  const [locationsEnabled, setLocationsEnabled] = useState(initialLocationsEnabled);
  const t = useTranslations("bandSettings");

  const settlementModes = [
    {
      value: "NO_BALANCE",
      label: t("settlementModes.noBalance.label"),
      description: t("settlementModes.noBalance.description"),
    },
    {
      value: "BAND_BALANCE",
      label: t("settlementModes.bandBalance.label"),
      description: t("settlementModes.bandBalance.description"),
    },
  ] as const;

  return (
    <form action={formAction} className="space-y-3">
      <ToggleRow
        name="equipmentEnabled"
        label={t("features.equipment.label")}
        description={t("features.equipment.description")}
        checked={equipmentEnabled}
        onChange={setEquipmentEnabled}
      />
      <ToggleRow
        name="packlistsEnabled"
        label={t("features.packlists.label")}
        description={
          equipmentEnabled
            ? t("features.packlists.description")
            : t("features.packlists.descriptionDisabled")
        }
        checked={equipmentEnabled && packlistsEnabled}
        disabled={!equipmentEnabled}
        onChange={setPacklistsEnabled}
      />
      <ToggleRow
        name="financeEnabled"
        label={t("features.finance.label")}
        description={
          initialFinanceEnabled || financeEnabled
            ? t("features.finance.descriptionOn")
            : t("features.finance.descriptionOff")
        }
        checked={financeEnabled}
        onChange={setFinanceEnabled}
      />
      {financeEnabled && (
        <div className="ml-4 space-y-2 border-l-2 border-border pl-4">
          <p className="text-xs font-medium text-foreground">{t("settlementModes.title")}</p>
          {settlementModes.map((m) => (
            <label
              key={m.value}
              className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:border-primary"
            >
              <input
                type="radio"
                name="financeSettlementMode"
                value={m.value}
                checked={financeSettlementMode === m.value}
                onChange={() => setFinanceSettlementMode(m.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{m.label}</p>
                <p className="mt-0.5 text-xs text-muted">{m.description}</p>
              </div>
            </label>
          ))}
        </div>
      )}
      <ToggleRow
        name="communicationEnabled"
        label={t("features.communication.label")}
        description={t("features.communication.description")}
        checked={communicationEnabled}
        onChange={setCommunicationEnabled}
      />
      <ToggleRow
        name="mediaPlayerEnabled"
        label={t("features.mediaPlayer.label")}
        description={t("features.mediaPlayer.description")}
        checked={mediaPlayerEnabled}
        onChange={setMediaPlayerEnabled}
      />
      {mediaPlayerEnabled && (
        <div className="ml-4 space-y-2 border-l-2 border-border pl-4">
          <ToggleRow
            name="keyDetectionEnabled"
            label={t("features.keyDetection.label")}
            description={t("features.keyDetection.description")}
            checked={keyDetectionEnabled}
            onChange={setKeyDetectionEnabled}
          />
        </div>
      )}
      <ToggleRow
        name="locationsEnabled"
        label={t("features.locations.label")}
        description={t("features.locations.description")}
        checked={locationsEnabled}
        onChange={setLocationsEnabled}
      />
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
