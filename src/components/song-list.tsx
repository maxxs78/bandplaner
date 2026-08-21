"use client";

import { useState } from "react";
import Link from "next/link";
import { List, LayoutGrid } from "lucide-react";
import { Card, Badge } from "@/components/ui/card";
import clsx from "clsx";

export type SongListItem = {
  id: string;
  title: string;
  coverUrl: string | null;
  subtitle: string;
  statusLabel: string;
  statusVariant: "warning" | "accent" | "success" | "default" | "danger";
  rejected: boolean;
};

export function SongList({
  bandId,
  songs,
  noSongsFoundText,
  rejectedBadgeText,
  listViewLabel,
  gridViewLabel,
}: {
  bandId: string;
  songs: SongListItem[];
  noSongsFoundText: string;
  rejectedBadgeText: string;
  listViewLabel: string;
  gridViewLabel: string;
}) {
  const [view, setView] = useState<"list" | "grid">("list");

  if (songs.length === 0) {
    return <Card className="mt-4 text-sm text-muted">{noSongsFoundText}</Card>;
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex justify-end">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label={listViewLabel}
            title={listViewLabel}
            className={clsx(
              "rounded-md p-1.5",
              view === "list" ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label={gridViewLabel}
            title={gridViewLabel}
            className={clsx(
              "rounded-md p-1.5",
              view === "grid" ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === "list" ? (
        <div className="space-y-2">
          {songs.map((song) => (
            <Link key={song.id} href={`/bands/${bandId}/songs/${song.id}`}>
              <Card className="flex items-center justify-between gap-3 transition hover:border-primary">
                <div className="flex min-w-0 items-center gap-3">
                  {song.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={song.coverUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-md border border-border bg-surface-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{song.title}</p>
                    <p className="truncate text-sm text-muted">{song.subtitle}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {song.rejected && <Badge variant="danger">{rejectedBadgeText}</Badge>}
                  <Badge variant={song.statusVariant}>{song.statusLabel}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {songs.map((song) => (
            <Link key={song.id} href={`/bands/${bandId}/songs/${song.id}`}>
              <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm transition hover:border-primary">
                {song.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={song.coverUrl}
                    alt=""
                    className="aspect-square w-full rounded-md border border-border object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-md border border-border bg-surface-muted" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{song.title}</p>
                  <p className="truncate text-xs text-muted">{song.subtitle}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {song.rejected && <Badge variant="danger">{rejectedBadgeText}</Badge>}
                  <Badge variant={song.statusVariant}>{song.statusLabel}</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
