"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EquipmentIconDisplay } from "@/lib/setlist-cues";

const OPTIONS: EquipmentIconDisplay[] = ["IN_TAG", "LARGE", "HIDDEN"];

export function EquipmentIconDisplaySelector({
  action,
  value,
}: {
  action: (formData: FormData) => Promise<void>;
  value: EquipmentIconDisplay;
}) {
  const t = useTranslations("setlists.detail");
  const [selected, setSelected] = useState<EquipmentIconDisplay>(value);
  const [pending, startTransition] = useTransition();

  function handleChange(next: EquipmentIconDisplay) {
    setSelected(next);
    const formData = new FormData();
    formData.set("equipmentIconDisplay", next);
    startTransition(() => action(formData));
  }

  return (
    <div className="space-y-1.5">
      {OPTIONS.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2 hover:border-primary"
        >
          <input
            type="radio"
            name="equipmentIconDisplay"
            value={option}
            checked={selected === option}
            onChange={() => handleChange(option)}
            className="h-4 w-4 shrink-0 accent-primary"
          />
          <span className="text-sm text-foreground">{t(`equipmentIconDisplayOptions.${option}`)}</span>
        </label>
      ))}
      {pending && (
        <p className="flex items-center gap-1 text-xs text-muted">
          <Save className="h-3 w-3 animate-pulse" />
          {t("saving")}
        </p>
      )}
    </div>
  );
}
