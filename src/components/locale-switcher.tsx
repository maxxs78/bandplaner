"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { updateLocaleAction } from "@/app/(app)/actions";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("languageSwitcher");
  const [pending, startTransition] = useTransition();

  function handleChange(next: string) {
    startTransition(() => {
      updateLocaleAction(next);
    });
  }

  return (
    <label className="flex h-9 items-center gap-1 rounded-full border border-border bg-surface px-2 text-sm text-foreground">
      <Languages className="h-4 w-4 text-muted" aria-hidden />
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-transparent focus:outline-none"
        aria-label={t("label")}
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {localeLabels[l as Locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
