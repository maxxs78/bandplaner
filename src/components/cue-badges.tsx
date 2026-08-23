import clsx from "clsx";
import { useTranslations } from "next-intl";
import { getCueDefinitions, type Cue } from "@/lib/setlist-cues";
import { EQUIPMENT_ICONS, isEquipmentIconKey } from "@/lib/equipment-icons";

export function CueBadges({
  cues,
  size = "sm",
  showEquipmentIcon = true,
}: {
  cues: Cue[];
  size?: "sm" | "lg";
  /** false bei Setlist.equipmentIconDisplay = LARGE/HIDDEN: das Equipment-Icon
   * wird dann entweder separat gross (siehe EquipmentIconStrip) oder gar nicht
   * dargestellt - der Badge faellt in beiden Faellen auf das generische
   * Hinweis-Typ-Icon zurueck. */
  showEquipmentIcon?: boolean;
}) {
  const t = useTranslations("cues");
  if (cues.length === 0) return null;
  const cueDefinitions = getCueDefinitions(t);
  return (
    <div className={clsx("flex flex-wrap items-center", size === "lg" ? "gap-2" : "gap-1")}>
      {cues.map((cue, i) => {
        const def = cueDefinitions[cue.type];
        const EquipmentIcon =
          showEquipmentIcon && isEquipmentIconKey(cue.equipmentIcon) ? EQUIPMENT_ICONS[cue.equipmentIcon] : null;
        const Icon = EquipmentIcon ?? def.icon;
        return (
          <span
            key={`${cue.type}-${i}`}
            title={cue.value ? `${def.label}: ${cue.value}` : def.label}
            style={EquipmentIcon && cue.equipmentColor ? { color: cue.equipmentColor } : undefined}
            className={clsx(
              "inline-flex items-center rounded-full bg-primary/10 font-medium",
              !(EquipmentIcon && cue.equipmentColor) && "text-primary",
              size === "lg" ? "gap-1.5 px-3 py-1 text-base" : "gap-1 px-1.5 py-0.5 text-[11px]"
            )}
          >
            <Icon className={size === "lg" ? "h-6 w-6" : "h-3 w-3"} />
            {cue.value && <span>{cue.value}</span>}
          </span>
        );
      })}
    </div>
  );
}

/** Grosse Equipment-Icons (ein Icon je Cue mit gewaehltem Equipment), gedacht
 * fuer die Platzierung neben Tonart/BPM (Setlist.equipmentIconDisplay = LARGE). */
export function EquipmentIconStrip({ cues, size = "lg" }: { cues: Cue[]; size?: "lg" | "xl" }) {
  const withEquipment = cues.filter((c) => isEquipmentIconKey(c.equipmentIcon));
  if (withEquipment.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {withEquipment.map((cue, i) => {
        const Icon = EQUIPMENT_ICONS[cue.equipmentIcon as keyof typeof EQUIPMENT_ICONS];
        return (
          <span key={`${cue.equipmentId ?? cue.value}-${i}`} title={cue.value ?? undefined}>
            <Icon
              className={size === "xl" ? "h-8 w-8 shrink-0" : "h-6 w-6 shrink-0"}
              style={{ color: cue.equipmentColor ?? undefined }}
            />
          </span>
        );
      })}
    </div>
  );
}
