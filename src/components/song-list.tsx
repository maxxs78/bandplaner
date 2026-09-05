"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { List, LayoutGrid, Search, ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { Card, Badge } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import clsx from "clsx";

export type SongListItem = {
  id: string;
  title: string;
  coverUrl: string | null;
  subtitle: string;
  statusLabel: string;
  statusVariant: "warning" | "accent" | "success" | "default" | "danger";
  rejected: boolean;
  /** Nur fuer Suche/Sortierung, nicht angezeigt. */
  artist: string | null;
  genre: string | null;
  album: string | null;
  keyValue: string | null;
  bpmValue: number | null;
  createdAt: string;
};

type SortMode = "title" | "bpm" | "key" | "recent";
type SortDir = "asc" | "desc";
const SORT_STORAGE_KEY = "bandplaner:songSort";
const SORT_DIR_STORAGE_KEY = "bandplaner:songSortDir";

/** Natuerliche Ausgangsrichtung je Sortierfeld (Titel/Tonart aufsteigend, „zuletzt" neueste zuerst). */
const DEFAULT_DIR: Record<SortMode, SortDir> = {
  title: "asc",
  bpm: "asc",
  key: "asc",
  recent: "desc",
};

export function SongList({
  bandId,
  songs,
  noSongsFoundText,
  noSearchResultsText,
  rejectedBadgeText,
  listViewLabel,
  gridViewLabel,
  searchPlaceholder,
  sortLabel,
  sortOptionLabels,
  sortDirAscLabel,
  sortDirDescLabel,
}: {
  bandId: string;
  songs: SongListItem[];
  noSongsFoundText: string;
  noSearchResultsText: string;
  rejectedBadgeText: string;
  listViewLabel: string;
  gridViewLabel: string;
  searchPlaceholder: string;
  sortLabel: string;
  sortOptionLabels: Record<SortMode, string>;
  sortDirAscLabel: string;
  sortDirDescLabel: string;
}) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("title");
  const [dir, setDir] = useState<SortDir>("asc");

  // Gespeicherte Sortier-Wahl erst nach dem ersten Render nachziehen, damit
  // Server- und Client-Erstausgabe uebereinstimmen (kein Hydration-Mismatch).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SORT_STORAGE_KEY);
      const storedDir = localStorage.getItem(SORT_DIR_STORAGE_KEY);
      if (stored === "title" || stored === "bpm" || stored === "key" || stored === "recent") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSort(stored);
        setDir(storedDir === "asc" || storedDir === "desc" ? storedDir : DEFAULT_DIR[stored]);
      }
    } catch {
      // localStorage nicht verfuegbar (privater Modus o. ae.) - Default bleibt.
    }
  }, []);

  function persist(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignorieren
    }
  }

  function changeSort(next: SortMode) {
    setSort(next);
    setDir(DEFAULT_DIR[next]);
    persist(SORT_STORAGE_KEY, next);
    persist(SORT_DIR_STORAGE_KEY, DEFAULT_DIR[next]);
  }

  function toggleDir() {
    setDir((current) => {
      const next = current === "asc" ? "desc" : "asc";
      persist(SORT_DIR_STORAGE_KEY, next);
      return next;
    });
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? songs.filter((s) =>
          [s.title, s.artist, s.genre, s.album].some((v) => v?.toLowerCase().includes(q))
        )
      : songs;

    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    const mul = dir === "asc" ? 1 : -1;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const byTitle = collator.compare(a.title, b.title);
      switch (sort) {
        case "bpm":
          // Songs ohne BPM immer ans Ende, unabhaengig von der Richtung.
          if (a.bpmValue == null && b.bpmValue == null) return byTitle;
          if (a.bpmValue == null) return 1;
          if (b.bpmValue == null) return -1;
          return (a.bpmValue - b.bpmValue) * mul || byTitle;
        case "key":
          if (!a.keyValue && !b.keyValue) return byTitle;
          if (!a.keyValue) return 1;
          if (!b.keyValue) return -1;
          return collator.compare(a.keyValue, b.keyValue) * mul || byTitle;
        case "recent":
          return a.createdAt.localeCompare(b.createdAt) * mul;
        case "title":
        default:
          return byTitle * mul;
      }
    });
    return sorted;
  }, [songs, query, sort, dir]);

  if (songs.length === 0) {
    return <Card className="mt-4 text-sm text-muted">{noSongsFoundText}</Card>;
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Select
            value={sort}
            onChange={(e) => changeSort(e.target.value as SortMode)}
            aria-label={sortLabel}
            className="!w-auto"
          >
            <option value="title">{sortOptionLabels.title}</option>
            <option value="bpm">{sortOptionLabels.bpm}</option>
            <option value="key">{sortOptionLabels.key}</option>
            <option value="recent">{sortOptionLabels.recent}</option>
          </Select>
          <button
            type="button"
            onClick={toggleDir}
            aria-label={dir === "asc" ? sortDirAscLabel : sortDirDescLabel}
            title={dir === "asc" ? sortDirAscLabel : sortDirDescLabel}
            className="rounded-lg border border-border p-2 text-muted hover:text-foreground"
          >
            {dir === "asc" ? (
              <ArrowDownAZ className="h-4 w-4" />
            ) : (
              <ArrowUpAZ className="h-4 w-4" />
            )}
          </button>
        </div>
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

      {visible.length === 0 ? (
        <Card className="text-sm text-muted">{noSearchResultsText}</Card>
      ) : view === "list" ? (
        <div className="space-y-2">
          {visible.map((song) => (
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
          {visible.map((song) => (
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
