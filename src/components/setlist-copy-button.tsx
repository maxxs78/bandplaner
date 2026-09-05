"use client";

import { useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Kopiert den Klartext-Ablauf der Setlist in die Zwischenablage. Bewusst als
 * eigene, schlanke Komponente, damit der Button neben Teilen/Drucken in der
 * Kopfzeile stehen kann.
 */
export function SetlistCopyButton({
  text,
  label,
  copiedLabel,
}: {
  text: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zwischenablage nicht verfuegbar - stiller Fehler.
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
      {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
