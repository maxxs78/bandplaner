"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { locales, localeLabels, funLocales, type Locale } from "@/i18n/config";
import { updateLocaleAction } from "@/app/(app)/actions";

/**
 * Eigenes Dropdown statt <select>: bei einem nativen <select> lässt sich die
 * Popup-Höhe browserübergreifend nicht begrenzen, das Saarländisch-Easter-Egg
 * wäre also ohne Scrollen sichtbar. Hier ist die Liste bewusst so hoch begrenzt,
 * dass genau die regulären Sprachen ohne Scrollen passen und der Trenner samt
 * Saarländisch erst durch Scrollen erreichbar ist.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("languageSwitcher");
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mainLocales = locales.filter((l) => !funLocales.includes(l));

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelect(next: string) {
    setOpen(false);
    startTransition(() => {
      updateLocaleAction(next);
    });
  }

  function renderOption(l: Locale) {
    return (
      <li key={l} role="presentation">
        <button
          type="button"
          role="option"
          aria-selected={locale === l}
          onClick={() => handleSelect(l)}
          className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-surface-muted"
        >
          {localeLabels[l]}
          {locale === l && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
        </button>
      </li>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("label")}
        className="flex h-9 items-center gap-1 rounded-full border border-border bg-surface px-2 text-sm text-foreground disabled:opacity-50"
      >
        <Languages className="h-4 w-4 text-muted" aria-hidden />
        {localeLabels[locale as Locale]}
        <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t("label")}
          className="absolute right-0 z-50 mt-1 max-h-[8.3rem] w-48 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {mainLocales.map((l) => renderOption(l))}
          {funLocales.length > 0 && (
            <>
              <li aria-hidden="true" className="my-1 border-t border-border" />
              {funLocales.map((l) => renderOption(l))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
