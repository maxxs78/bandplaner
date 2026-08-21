import clsx from "clsx";
import { useTranslations } from "next-intl";
import { getCueDefinitions, type Cue } from "@/lib/setlist-cues";

export function CueBadges({
  cues,
  size = "sm",
}: {
  cues: Cue[];
  size?: "sm" | "lg";
}) {
  const t = useTranslations("cues");
  if (cues.length === 0) return null;
  const cueDefinitions = getCueDefinitions(t);
  return (
    <div className={clsx("flex flex-wrap items-center", size === "lg" ? "gap-2" : "gap-1")}>
      {cues.map((cue, i) => {
        const def = cueDefinitions[cue.type];
        return (
          <span
            key={`${cue.type}-${i}`}
            title={cue.value ? `${def.label}: ${cue.value}` : def.label}
            className={clsx(
              "inline-flex items-center rounded-full bg-primary/10 font-medium text-primary",
              size === "lg" ? "gap-1.5 px-3 py-1 text-base" : "gap-1 px-1.5 py-0.5 text-[11px]"
            )}
          >
            <def.icon className={size === "lg" ? "h-6 w-6" : "h-3 w-3"} />
            {cue.value && <span>{cue.value}</span>}
          </span>
        );
      })}
    </div>
  );
}
