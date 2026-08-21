"use client";

import { useRef, useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Tag, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  addSongToSetlistAction,
  addCustomItemAction,
  removeSetlistItemAction,
  reorderSetlistItemsAction,
  saveItemAnnotationAction,
} from "@/app/(app)/bands/[bandId]/setlists/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CueAnnotationEditor, type AnnotationValues } from "@/components/cue-annotation-editor";
import { CueBadges } from "@/components/cue-badges";
import { parseCues } from "@/lib/setlist-cues";
import clsx from "clsx";

type MyAnnotation = { note: string | null; color: string | null; cues: string | null } | null;

type SetlistItem = {
  id: string;
  songId: string | null;
  customTitle: string | null;
  songDeleted: boolean;
  song: {
    id: string;
    title: string;
    key: string | null;
    bpm: number | null;
    durationSec: number | null;
    status: string;
  } | null;
  myAnnotation?: MyAnnotation;
};

type LibrarySong = { id: string; title: string; key: string | null; bpm: number | null; status: string };

function formatDuration(sec: number | null) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function itemTitleAndMeta(item: SetlistItem, t: (key: string) => string) {
  const title = item.song?.title ?? item.customTitle ?? t("unnamed");
  const meta = item.song
    ? [item.song.key, item.song.bpm ? `${item.song.bpm} BPM` : null, formatDuration(item.song.durationSec)]
        .filter(Boolean)
        .join(" · ")
    : item.songDeleted
      ? t("songDeleted")
      : t("customEntry");
  return { title, meta };
}

function RowContent({
  item,
  index,
  isExpanded,
  onToggleExpand,
}: {
  item: SetlistItem;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const t = useTranslations("setlists.builder");
  const { title, meta } = itemTitleAndMeta(item, t);
  const isArchived = item.song?.status === "ARCHIVED";
  const annotation = item.myAnnotation;
  const cues = parseCues(annotation?.cues);

  return (
    <>
      <span className="w-6 shrink-0 text-sm text-muted">{index + 1}.</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={clsx(
              "truncate text-sm font-medium",
              item.songDeleted ? "italic text-muted" : "text-foreground"
            )}
          >
            {title}
          </p>
          {isArchived && (
            <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted">
              {t("archivedBadge")}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted">{meta}</p>
        {(annotation?.note || cues.length > 0) && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {annotation?.note && <p className="text-xs italic text-foreground">{annotation.note}</p>}
            <CueBadges cues={cues} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onToggleExpand}
        aria-label={t("annotationLabel")}
        title={t("annotationTitle")}
        className={clsx(
          "shrink-0",
          isExpanded || annotation?.note || annotation?.color || cues.length > 0
            ? "text-primary"
            : "text-muted hover:text-foreground"
        )}
      >
        <Tag className="h-4 w-4" />
      </button>
    </>
  );
}

function ReadOnlyRow({
  item,
  index,
  isExpanded,
  onToggleExpand,
}: {
  item: SetlistItem;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5",
        item.songDeleted ? "bg-surface-muted" : "bg-surface"
      )}
      style={item.myAnnotation?.color ? { borderLeft: `4px solid ${item.myAnnotation.color}` } : undefined}
    >
      <RowContent item={item} index={index} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
    </div>
  );
}

function SortableRow({
  item,
  index,
  isExpanded,
  onToggleExpand,
  onRemove,
}: {
  item: SetlistItem;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const t = useTranslations("setlists.builder");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    ...(item.myAnnotation?.color ? { borderLeft: `4px solid ${item.myAnnotation.color}` } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5",
        item.songDeleted ? "bg-surface-muted" : "bg-surface"
      )}
    >
      <button
        type="button"
        aria-label={t("move")}
        className="cursor-grab touch-none text-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <RowContent item={item} index={index} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={t("remove")}
        className="shrink-0 text-muted hover:text-danger"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SetlistBuilder({
  bandId,
  setlistId,
  initialItems,
  librarySongs,
  readOnly = false,
}: {
  bandId: string;
  setlistId: string;
  initialItems: SetlistItem[];
  librarySongs: LibrarySong[];
  readOnly?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const optimisticIdCounter = useRef(0);
  const t = useTranslations("setlists.builder");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((current) => {
      const oldIndex = current.findIndex((i) => i.id === active.id);
      const newIndex = current.findIndex((i) => i.id === over.id);
      const next = arrayMove(current, oldIndex, newIndex);
      startTransition(() =>
        reorderSetlistItemsAction(bandId, setlistId, next.map((i) => i.id))
      );
      return next;
    });
  }

  function handleRemove(itemId: string) {
    setItems((current) => current.filter((i) => i.id !== itemId));
    startTransition(() => removeSetlistItemAction(bandId, setlistId, itemId));
  }

  function handleAddSong(song: LibrarySong) {
    const optimisticId = `optimistic-${optimisticIdCounter.current++}`;
    setItems((current) => [
      ...current,
      {
        id: optimisticId,
        songId: song.id,
        customTitle: null,
        songDeleted: false,
        song: { ...song, durationSec: null },
      },
    ]);
    startTransition(async () => {
      await addSongToSetlistAction(bandId, setlistId, song.id);
    });
  }

  function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!customTitle.trim()) return;
    const formData = new FormData();
    formData.set("customTitle", customTitle);
    const optimisticId = `optimistic-${optimisticIdCounter.current++}`;
    setItems((current) => [
      ...current,
      { id: optimisticId, songId: null, customTitle, songDeleted: false, song: null },
    ]);
    setCustomTitle("");
    startTransition(async () => {
      await addCustomItemAction(bandId, setlistId, formData);
    });
  }

  async function handleSaveAnnotation(itemId: string, data: AnnotationValues) {
    const result = await saveItemAnnotationAction(bandId, setlistId, itemId, data);
    if (!result?.error) {
      setItems((current) =>
        current.map((i) =>
          i.id === itemId
            ? {
                ...i,
                myAnnotation: {
                  note: data.note.trim() || null,
                  color: data.color,
                  cues: data.cues.length > 0 ? JSON.stringify(data.cues) : null,
                },
              }
            : i
        )
      );
      setExpandedItemId(null);
    }
    return result;
  }

  const filteredLibrary = librarySongs.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={readOnly ? "" : "grid gap-6 lg:grid-cols-[1fr_320px]"}>
      <div>
        <h2 className="font-semibold text-foreground">{t("order")}</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {readOnly ? t("emptyReadOnly") : t("emptyEditable")}
          </p>
        ) : readOnly ? (
          <div className="mt-3 space-y-2">
            {items.map((item, index) => (
              <div key={item.id}>
                <ReadOnlyRow
                  item={item}
                  index={index}
                  isExpanded={expandedItemId === item.id}
                  onToggleExpand={() =>
                    setExpandedItemId((current) => (current === item.id ? null : item.id))
                  }
                />
                {expandedItemId === item.id && (
                  <div className="mt-2 rounded-lg border border-border bg-surface-muted p-3">
                    <CueAnnotationEditor
                      defaultValues={{
                        note: item.myAnnotation?.note ?? "",
                        color: item.myAnnotation?.color ?? null,
                        cues: parseCues(item.myAnnotation?.cues),
                      }}
                      onSave={(data) => handleSaveAnnotation(item.id, data)}
                      compact
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="mt-3 space-y-2">
                {items.map((item, index) => (
                  <div key={item.id}>
                    <SortableRow
                      item={item}
                      index={index}
                      isExpanded={expandedItemId === item.id}
                      onToggleExpand={() =>
                        setExpandedItemId((current) => (current === item.id ? null : item.id))
                      }
                      onRemove={handleRemove}
                    />
                    {expandedItemId === item.id && (
                      <div className="mt-2 rounded-lg border border-border bg-surface-muted p-3">
                        <CueAnnotationEditor
                          defaultValues={{
                            note: item.myAnnotation?.note ?? "",
                            color: item.myAnnotation?.color ?? null,
                            cues: parseCues(item.myAnnotation?.cues),
                          }}
                          onSave={(data) => handleSaveAnnotation(item.id, data)}
                          compact
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {!readOnly && (
          <form onSubmit={handleAddCustom} className="mt-4 flex gap-2">
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={t("customPlaceholder")}
              className="flex-1"
            />
            <Button type="submit" variant="secondary" size="sm">
              <Plus className="h-4 w-4" />
              {t("add")}
            </Button>
          </form>
        )}
      </div>

      {!readOnly && (
        <div>
          <h2 className="font-semibold text-foreground">{t("library")}</h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="mt-2"
          />
          <div className="mt-2 max-h-[500px] space-y-1.5 overflow-y-auto">
            {filteredLibrary.map((song) => (
              <button
                key={song.id}
                type="button"
                onClick={() => handleAddSong(song)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary hover:bg-surface-muted"
              >
                <span className="text-foreground">{song.title}</span>
                <Plus className="h-4 w-4 shrink-0 text-primary" />
              </button>
            ))}
            {filteredLibrary.length === 0 && (
              <p className="text-sm text-muted">{t("noSongsFound")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
