"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CUE_TYPES, getCueDefinitions, COLOR_PALETTE, type Cue } from "@/lib/setlist-cues";
import { EQUIPMENT_ICONS, isEquipmentIconKey } from "@/lib/equipment-icons";

export type AnnotationValues = { note: string; color: string | null; cues: Cue[] };

export type EquipmentOption = { id: string; name: string; icon: string | null; color: string | null };

export function CueAnnotationEditor({
  defaultValues,
  onSave,
  compact = false,
  equipmentOptions,
}: {
  defaultValues: AnnotationValues;
  onSave: (data: AnnotationValues) => Promise<{ error?: string } | void>;
  compact?: boolean;
  /** Katalog an waehlbarem Equipment fuer den INSTRUMENT_CHANGE-Hinweis (persoenliches
   * Equipment + Band-Equipment) - ohne diese Liste bleibt es beim reinen Freitext. */
  equipmentOptions?: EquipmentOption[];
}) {
  const t = useTranslations("cues");
  const cueDefinitions = getCueDefinitions(t);
  const [note, setNote] = useState(defaultValues.note);
  const [color, setColor] = useState<string | null>(defaultValues.color);
  const [cues, setCues] = useState<Cue[]>(defaultValues.cues);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleCue(type: Cue["type"]) {
    setCues((current) =>
      current.some((c) => c.type === type)
        ? current.filter((c) => c.type !== type)
        : [...current, { type }]
    );
  }

  function setCueValue(type: Cue["type"], value: string) {
    setCues((current) =>
      current.map((c) =>
        c.type === type
          ? { ...c, value, equipmentId: undefined, equipmentIcon: undefined, equipmentColor: undefined }
          : c
      )
    );
  }

  function setCueEquipment(type: Cue["type"], equipmentId: string) {
    const option = equipmentOptions?.find((o) => o.id === equipmentId);
    setCues((current) =>
      current.map((c) =>
        c.type === type
          ? option
            ? {
                ...c,
                value: option.name,
                equipmentId: option.id,
                equipmentIcon: option.icon,
                equipmentColor: option.color,
              }
            : { ...c, equipmentId: undefined, equipmentIcon: undefined, equipmentColor: undefined }
          : c
      )
    );
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await onSave({ note, color, cues });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className={clsx("space-y-3", compact ? "text-sm" : "")}>
      <div>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("notePlaceholder")}
          maxLength={80}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">{t("colorLabel")}</span>
        <button
          type="button"
          onClick={() => setColor(null)}
          aria-label={t("noColor")}
          title={t("noColor")}
          className={clsx(
            "h-5 w-5 rounded-full border border-border",
            color === null && "ring-2 ring-primary ring-offset-1 ring-offset-surface"
          )}
        />
        {COLOR_PALETTE.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setColor(c.value)}
            aria-label={c.key}
            title={c.key}
            style={{ backgroundColor: c.value }}
            className={clsx(
              "h-5 w-5 rounded-full",
              color === c.value && "ring-2 ring-primary ring-offset-1 ring-offset-surface"
            )}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        {CUE_TYPES.map((type) => {
          const def = cueDefinitions[type];
          const active = cues.find((c) => c.type === type);
          return (
            <div key={type} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCue(type)}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted hover:text-foreground"
                )}
              >
                <def.icon className="h-3.5 w-3.5" />
                {def.label}
              </button>
              {active && def.hasValue && type === "INSTRUMENT_CHANGE" && equipmentOptions && equipmentOptions.length > 0 ? (
                <>
                  <Select
                    value={active.equipmentId ?? ""}
                    onChange={(e) => setCueEquipment(type, e.target.value)}
                    className="h-7 w-40 text-xs"
                  >
                    <option value="">{t("equipmentFreeText")}</option>
                    {equipmentOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                  {active.equipmentId ? (
                    isEquipmentIconKey(active.equipmentIcon) && (
                      <EquipmentIconPreview iconKey={active.equipmentIcon} color={active.equipmentColor} />
                    )
                  ) : (
                    <Input
                      value={active.value ?? ""}
                      onChange={(e) => setCueValue(type, e.target.value)}
                      placeholder={def.placeholder}
                      className="h-7 w-36 text-xs"
                    />
                  )}
                </>
              ) : (
                active &&
                def.hasValue && (
                  <Input
                    value={active.value ?? ""}
                    onChange={(e) => setCueValue(type, e.target.value)}
                    placeholder={def.placeholder}
                    className="h-7 w-36 text-xs"
                  />
                )
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="button" size="sm" disabled={pending} onClick={handleSave}>
        <Check className="h-4 w-4" />
        {pending ? t("saving") : t("save")}
      </Button>
    </div>
  );
}

function EquipmentIconPreview({ iconKey, color }: { iconKey: string; color?: string | null }) {
  if (!isEquipmentIconKey(iconKey)) return null;
  const Icon = EQUIPMENT_ICONS[iconKey];
  return <Icon className="h-5 w-5 shrink-0" style={{ color: color ?? undefined }} />;
}
