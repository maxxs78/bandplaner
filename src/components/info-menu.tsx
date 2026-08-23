"use client";

import { useEffect, useRef, useState } from "react";
import { Info, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";

export function InfoMenu({ version }: { version: string }) {
  const t = useTranslations("info");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("triggerLabel")}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:bg-surface-muted"
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          className="absolute right-0 z-50 mt-1 w-64 rounded-md border border-border bg-surface p-3 shadow-lg"
        >
          <p className="text-sm font-semibold text-foreground">{t("title")}</p>
          <a
            href="/docs/handbook/index.html"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="mt-3 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-muted"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            {t("handbookLink")}
          </a>
          <p className="mt-1.5 text-xs text-muted">{t("handbookHint")}</p>
          <p className="mt-3 border-t border-border pt-2 text-xs text-muted">
            {t("appVersion")} {version}
          </p>
        </div>
      )}
    </div>
  );
}
