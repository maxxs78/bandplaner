"use client";

import { useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CUE_TYPES, getCueDefinitions, COLOR_PALETTE, type Cue } from "@/lib/setlist-cues";
import { EQUIPMENT_ICONS, isEquipmentIconKey } from "@/lib/equipment-icons";

export type AnnotationValues = { note: string; color: string | null; cues: Cue[] };

export type EquipmentOption = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  category: string;
};

/** Kompakte Feld-Groesse fuer die Cue-Zeilen - ueberschreibt Hoehe, Padding und
 * Textgroesse der gemeinsamen Input/Select-Basisklassen (die fuer normale,
 * groessere Formularfelder ausgelegt sind, dort px-3/py-2/text-sm). Die
 * Padding-/Textgroessen-Utilities muessen mit "!" (important) erzwungen werden,
 * da Tailwind gleich-spezifische Utility-Klassen nach ihrer Position im
 * generierten Stylesheet aufloest statt nach der Reihenfolge im className -
 * ohne "!" gewinnt teils die groessere Basisklasse und der Text wird in der
 * dadurch zu kleinen Boxhoehe abgeschnitten. */
const COMPACT_FIELD = "h-7 !px-2 !py-1 !text-xs leading-tight";

export function CueAnnotationEditor({
  defaultValues,
  onSave,
  compact = false,
  equipmentOptions,
}: {
  defaultValues: AnnotationValues;
  onSave: (data: AnnotationValues) => Promise<{ error?: string } | void>;
  compact?: boolean;
  /** Katalog an waehlbarem Equipment fuer INSTRUMENT_CHANGE (nur Kategorie
   * INSTRUMENTS) und EQUIPMENT (alles andere) - ohne diese Liste bleibt es
   * beim reinen Freitext. */
  equipmentOptions?: EquipmentOption[];
}) {
  const t = useTranslations("cues");
  const cueDefinitions = getCueDefinitions(t);
  const [note, setNote] = useState(defaultValues.note);
  const [color, setColor] = useState<string | null>(defaultValues.color);
  const [cues, setCues] = useState<Cue[]>(defaultValues.cues);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const instrumentOptions = equipmentOptions?.filter((o) => o.category === "INSTRUMENTS");
  const otherEquipmentOptions = equipmentOptions?.filter((o) => o.category !== "INSTRUMENTS");

  /** Jeder Typ ist beliebig oft anhaengbar (z. B. zwei Instrumentwechsel in
   * einem Song) - Eintraege werden daher ueber ihren Index im flachen
   * cues-Array adressiert, nicht ueber den Typ allein. */
  function addCue(type: Cue["type"]) {
    setCues((current) => [...current, { type }]);
  }

  function removeCueAt(index: number) {
    setCues((current) => current.filter((_, i) => i !== index));
  }

  function setCueValueAt(index: number, value: string) {
    setCues((current) =>
      current.map((c, i) =>
        i === index
          ? { ...c, value, equipmentId: undefined, equipmentIcon: undefined, equipmentColor: undefined }
          : c
      )
    );
  }

  function setCueEquipmentAt(index: number, options: EquipmentOption[] | undefined, equipmentId: string) {
    const option = options?.find((o) => o.id === equipmentId);
    setCues((current) =>
      current.map((c, i) =>
        i === index
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

      <div className="space-y-2">
        {CUE_TYPES.map((type) => {
          const def = cueDefinitions[type];
          const entries = cues
            .map((cue, index) => ({ cue, index }))
            .filter((e) => e.cue.type === type);
          const optionsForType =
            type === "INSTRUMENT_CHANGE" ? instrumentOptions : type === "EQUIPMENT" ? otherEquipmentOptions : undefined;
          return (
            <div key={type} className="space-y-1">
              <button
                type="button"
                onClick={() => addCue(type)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted transition hover:text-foreground"
              >
                <def.icon className="h-3.5 w-3.5" />
                {def.label}
                <Plus className="h-3 w-3" />
              </button>
              {entries.map(({ cue, index }) => (
                <div key={index} className="ml-1 flex flex-wrap items-center gap-1.5 border-l-2 border-primary/30 pl-2">
                  <CueValueControl
                    type={type}
                    cue={cue}
                    hasValue={def.hasValue}
                    placeholder={def.placeholder}
                    equipmentOptions={optionsForType}
                    onChangeValue={(value) => setCueValueAt(index, value)}
                    onChangeEquipment={(equipmentId) => setCueEquipmentAt(index, optionsForType, equipmentId)}
                  />
                  <button
                    type="button"
                    onClick={() => removeCueAt(index)}
                    aria-label={t("remove")}
                    title={t("remove")}
                    className="text-muted hover:text-danger"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
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

/** Rendert das Werte-Eingabefeld eines einzelnen Cue-Eintrags - je nach Typ ein
 * Equipment-Picker (INSTRUMENT_CHANGE nur Instrumente, EQUIPMENT alles andere),
 * ein "ohne"/Freitext-Picker (COUNT_IN) oder ein einfaches Freitextfeld (alle
 * anderen Typen mit hasValue). */
function CueValueControl({
  type,
  cue,
  hasValue,
  placeholder,
  equipmentOptions,
  onChangeValue,
  onChangeEquipment,
}: {
  type: Cue["type"];
  cue: Cue;
  hasValue: boolean;
  placeholder?: string;
  equipmentOptions?: EquipmentOption[];
  onChangeValue: (value: string) => void;
  onChangeEquipment: (equipmentId: string) => void;
}) {
  const t = useTranslations("cues");

  if (!hasValue) return null;

  if ((type === "INSTRUMENT_CHANGE" || type === "EQUIPMENT") && equipmentOptions && equipmentOptions.length > 0) {
    return (
      <>
        <Select
          value={cue.equipmentId ?? ""}
          onChange={(e) => onChangeEquipment(e.target.value)}
          className={clsx(COMPACT_FIELD, "w-48")}
        >
          <option value="">{t("equipmentFreeText")}</option>
          {equipmentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        {cue.equipmentId ? (
          isEquipmentIconKey(cue.equipmentIcon) && (
            <EquipmentIconPreview iconKey={cue.equipmentIcon} color={cue.equipmentColor} />
          )
        ) : (
          <Input
            value={cue.value ?? ""}
            onChange={(e) => onChangeValue(e.target.value)}
            placeholder={placeholder}
            className={clsx(COMPACT_FIELD, "w-40")}
          />
        )}
      </>
    );
  }

  if (type === "COUNT_IN") {
    const noneLabel = t("countInNone");
    const isNone = cue.value === noneLabel;
    return (
      <>
        <Select
          value={isNone ? "none" : ""}
          onChange={(e) => onChangeValue(e.target.value === "none" ? noneLabel : "")}
          className={clsx(COMPACT_FIELD, "w-36")}
        >
          <option value="">{t("countInCustom")}</option>
          <option value="none">{noneLabel}</option>
        </Select>
        {!isNone && (
          <Input
            value={cue.value ?? ""}
            onChange={(e) => onChangeValue(e.target.value)}
            placeholder={placeholder}
            className={clsx(COMPACT_FIELD, "w-36")}
          />
        )}
      </>
    );
  }

  return (
    <Input
      value={cue.value ?? ""}
      onChange={(e) => onChangeValue(e.target.value)}
      placeholder={placeholder}
      className={clsx(COMPACT_FIELD, "w-40")}
    />
  );
}
