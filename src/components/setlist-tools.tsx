"use client";

import { useState, useTransition } from "react";
import { Check, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Werkzeug ueber der Setlist: alle persoenlichen Eintrags-Hinweise aus den
 * Song-Notizen aktualisieren. Das Kopieren in die Zwischenablage steht als
 * eigener Button in der Kopfzeile neben Teilen/Drucken (SetlistCopyButton).
 */
export function SetlistTools({
  syncAllAction,
  labels,
}: {
  syncAllAction: () => Promise<void>;
  labels: {
    syncAll: string;
    syncAllConfirm: string;
    syncing: string;
    synced: string;
  };
}) {
  const [synced, setSynced] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSyncAll() {
    if (!window.confirm(labels.syncAllConfirm)) return;
    startTransition(async () => {
      await syncAllAction();
      setSynced(true);
      setTimeout(() => setSynced(false), 2000);
    });
  }

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={handleSyncAll} disabled={pending}>
        {synced ? <Check className="h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
        {pending ? labels.syncing : synced ? labels.synced : labels.syncAll}
      </Button>
    </div>
  );
}
