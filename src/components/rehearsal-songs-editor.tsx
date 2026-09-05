"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export type RehearsalSongRow = {
  songId: string;
  title: string;
  source: "explicit" | "setlist";
  note: string | null;
};

export function RehearsalSongsEditor({
  bandId,
  entries,
  librarySongs,
  addAction,
  removeAction,
  saveNoteAction,
}: {
  bandId: string;
  entries: RehearsalSongRow[];
  librarySongs: { id: string; title: string }[];
  addAction: (songId: string) => Promise<void>;
  removeAction: (songId: string) => Promise<void>;
  saveNoteAction: (songId: string, formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("calendar.detail.rehearsalSongs");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [addValue, setAddValue] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(entries.filter((e) => e.source === "explicit").map((e) => [e.songId, e.note ?? ""]))
  );

  const listedIds = new Set(entries.map((e) => e.songId));
  const available = librarySongs.filter((s) => !listedIds.has(s.id));

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-3">
      {entries.length === 0 && <p className="text-sm text-muted">{t("empty")}</p>}

      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.songId} className="rounded-lg border border-border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/bands/${bandId}/songs/${e.songId}`}
                className="min-w-0 truncate text-sm font-medium text-foreground hover:underline"
              >
                {e.title}
              </Link>
              {e.source === "setlist" ? (
                <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted">
                  {t("fromSetlist")}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => run(() => removeAction(e.songId))}
                  aria-label={t("remove")}
                  className="shrink-0 text-muted hover:text-danger"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {e.source === "explicit" && (
              <form
                action={(formData) => run(() => saveNoteAction(e.songId, formData))}
                className="mt-2 flex gap-2"
              >
                <Input
                  name="note"
                  value={notes[e.songId] ?? ""}
                  onChange={(ev) => setNotes((n) => ({ ...n, [e.songId]: ev.target.value }))}
                  placeholder={t("notePlaceholder")}
                  className="text-xs"
                />
                <Button type="submit" size="sm" variant="secondary">
                  <Save className="h-3.5 w-3.5" />
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {available.length > 0 && (
        <div className="flex gap-2">
          <Select value={addValue} onChange={(e) => setAddValue(e.target.value)} className="text-sm">
            <option value="">{t("addPlaceholder")}</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!addValue}
            onClick={() => {
              if (!addValue) return;
              const id = addValue;
              setAddValue("");
              run(() => addAction(id));
            }}
          >
            <Plus className="h-4 w-4" />
            {t("add")}
          </Button>
        </div>
      )}
    </div>
  );
}
