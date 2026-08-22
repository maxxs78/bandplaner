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
  addCommentAction,
  addSectionAction,
  removeSetlistItemAction,
  reorderSetlistItemsAction,
  saveItemAnnotationAction,
  setItemNumberingAction,
} from "@/app/(app)/bands/[bandId]/setlists/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CueAnnotationEditor, type AnnotationValues, type EquipmentOption } from "@/components/cue-annotation-editor";
import { CueBadges } from "@/components/cue-badges";
import { parseCues } from "@/lib/setlist-cues";
import { computeSetlistNumbers, type SetlistItemKind } from "@/lib/setlist-items";
import clsx from "clsx";

type MyAnnotation = { note: string | null; color: string | null; cues: string | null } | null;

type SetlistItem = {
  id: string;
  kind: SetlistItemKind;
  songId: string | null;
  customTitle: string | null;
  /** Nur bei kind=CUSTOM gesetzt (z. B. Pausenlänge). */
  durationSec: number | null;
  /** Nur bei kind=CUSTOM relevant - siehe computeNumbers(). */
  excludeFromNumbering: boolean;
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
  const duration = formatDuration(item.song?.durationSec ?? item.durationSec ?? null);
  const meta =
    item.kind === "SONG"
      ? item.songDeleted
        ? t("songDeleted")
        : [item.song?.key, item.song?.bpm ? `${item.song.bpm} BPM` : null, duration].filter(Boolean).join(" · ")
      : [t("customEntry"), duration].filter(Boolean).join(" · ");
  return { title, meta };
}

function RowContent({
  item,
  number,
  isExpanded,
  onToggleExpand,
  onSetNumbering,
}: {
  item: SetlistItem;
  number: number | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSetNumbering?: (exclude: boolean) => void;
}) {
  const t = useTranslations("setlists.builder");
  const { title, meta } = itemTitleAndMeta(item, t);
  const isArchived = item.song?.status === "ARCHIVED";
  const annotation = item.myAnnotation;
  const cues = parseCues(annotation?.cues);

  return (
    <>
      <span className="w-6 shrink-0 text-sm text-muted">{number !== null ? `${number}.` : ""}</span>
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
        {item.kind === "CUSTOM" && onSetNumbering && (
          <label className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={!item.excludeFromNumbering}
              onChange={(e) => onSetNumbering(!e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            {t("countInNumbering")}
          </label>
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

function CommentContent({ item }: { item: SetlistItem }) {
  return <p className="flex-1 text-xs italic text-foreground">{item.customTitle}</p>;
}

function SectionContent({ item }: { item: SetlistItem }) {
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      {item.customTitle && (
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
          {item.customTitle}
        </span>
      )}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function ItemContent({
  item,
  number,
  isExpanded,
  onToggleExpand,
  onSetNumbering,
}: {
  item: SetlistItem;
  number: number | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSetNumbering?: (exclude: boolean) => void;
}) {
  if (item.kind === "COMMENT") return <CommentContent item={item} />;
  if (item.kind === "SECTION") return <SectionContent item={item} />;
  return (
    <RowContent
      item={item}
      number={number}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onSetNumbering={onSetNumbering}
    />
  );
}

function ReadOnlyRow({
  item,
  number,
  isExpanded,
  onToggleExpand,
}: {
  item: SetlistItem;
  number: number | null;
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
      <ItemContent item={item} number={number} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
    </div>
  );
}

function SortableRow({
  item,
  number,
  isExpanded,
  onToggleExpand,
  onRemove,
  onSetNumbering,
}: {
  item: SetlistItem;
  number: number | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: (id: string) => void;
  onSetNumbering: (itemId: string, exclude: boolean) => void;
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
      <ItemContent
        item={item}
        number={number}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onSetNumbering={(exclude) => onSetNumbering(item.id, exclude)}
      />
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
  eventId = null,
  initialItems,
  librarySongs,
  readOnly = false,
  equipmentOptions,
}: {
  bandId: string;
  setlistId: string;
  /** Aktiver Termin-Kontext (siehe EventContextSelector) - steuert, ob persönliche Hinweise termin- oder allgemein gespeichert werden. */
  eventId?: string | null;
  initialItems: SetlistItem[];
  librarySongs: LibrarySong[];
  readOnly?: boolean;
  /** Katalog an waehlbarem Equipment fuer den INSTRUMENT_CHANGE-Hinweis - siehe CueAnnotationEditor. */
  equipmentOptions?: EquipmentOption[];
}) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customDurationMin, setCustomDurationMin] = useState("");
  const [customExcludeFromNumbering, setCustomExcludeFromNumbering] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sectionLabel, setSectionLabel] = useState("");
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

  function handleSetNumbering(itemId: string, exclude: boolean) {
    setItems((current) =>
      current.map((i) => (i.id === itemId ? { ...i, excludeFromNumbering: exclude } : i))
    );
    startTransition(() => setItemNumberingAction(bandId, setlistId, itemId, exclude));
  }

  function handleAddSong(song: LibrarySong) {
    const optimisticId = `optimistic-${optimisticIdCounter.current++}`;
    setItems((current) => [
      ...current,
      {
        id: optimisticId,
        kind: "SONG",
        songId: song.id,
        customTitle: null,
        durationSec: null,
        excludeFromNumbering: false,
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
    formData.set("durationMin", customDurationMin);
    if (customExcludeFromNumbering) formData.set("excludeFromNumbering", "on");
    const durationSec = Number(customDurationMin) > 0 ? Number(customDurationMin) * 60 : null;
    const optimisticId = `optimistic-${optimisticIdCounter.current++}`;
    setItems((current) => [
      ...current,
      {
        id: optimisticId,
        kind: "CUSTOM",
        songId: null,
        customTitle,
        durationSec,
        excludeFromNumbering: customExcludeFromNumbering,
        songDeleted: false,
        song: null,
      },
    ]);
    setCustomTitle("");
    setCustomDurationMin("");
    setCustomExcludeFromNumbering(false);
    startTransition(async () => {
      await addCustomItemAction(bandId, setlistId, formData);
    });
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const formData = new FormData();
    formData.set("text", commentText);
    const optimisticId = `optimistic-${optimisticIdCounter.current++}`;
    setItems((current) => [
      ...current,
      {
        id: optimisticId,
        kind: "COMMENT",
        songId: null,
        customTitle: commentText,
        durationSec: null,
        excludeFromNumbering: false,
        songDeleted: false,
        song: null,
      },
    ]);
    setCommentText("");
    startTransition(async () => {
      await addCommentAction(bandId, setlistId, formData);
    });
  }

  function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("label", sectionLabel);
    const optimisticId = `optimistic-${optimisticIdCounter.current++}`;
    setItems((current) => [
      ...current,
      {
        id: optimisticId,
        kind: "SECTION",
        songId: null,
        customTitle: sectionLabel.trim() || null,
        durationSec: null,
        excludeFromNumbering: false,
        songDeleted: false,
        song: null,
      },
    ]);
    setSectionLabel("");
    startTransition(async () => {
      await addSectionAction(bandId, setlistId, formData);
    });
  }

  async function handleSaveAnnotation(itemId: string, data: AnnotationValues) {
    const result = await saveItemAnnotationAction(bandId, setlistId, itemId, eventId, data);
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
  const numbers = computeSetlistNumbers(items);

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
                  number={numbers[index]}
                  isExpanded={expandedItemId === item.id}
                  onToggleExpand={() =>
                    setExpandedItemId((current) => (current === item.id ? null : item.id))
                  }
                />
                {expandedItemId === item.id && item.kind !== "COMMENT" && item.kind !== "SECTION" && (
                  <div className="mt-2 rounded-lg border border-border bg-surface-muted p-3">
                    <CueAnnotationEditor
                      defaultValues={{
                        note: item.myAnnotation?.note ?? "",
                        color: item.myAnnotation?.color ?? null,
                        cues: parseCues(item.myAnnotation?.cues),
                      }}
                      onSave={(data) => handleSaveAnnotation(item.id, data)}
                      compact
                      equipmentOptions={equipmentOptions}
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
                      number={numbers[index]}
                      isExpanded={expandedItemId === item.id}
                      onToggleExpand={() =>
                        setExpandedItemId((current) => (current === item.id ? null : item.id))
                      }
                      onRemove={handleRemove}
                      onSetNumbering={handleSetNumbering}
                    />
                    {expandedItemId === item.id && item.kind !== "COMMENT" && item.kind !== "SECTION" && (
                      <div className="mt-2 rounded-lg border border-border bg-surface-muted p-3">
                        <CueAnnotationEditor
                          defaultValues={{
                            note: item.myAnnotation?.note ?? "",
                            color: item.myAnnotation?.color ?? null,
                            cues: parseCues(item.myAnnotation?.cues),
                          }}
                          onSave={(data) => handleSaveAnnotation(item.id, data)}
                          compact
                          equipmentOptions={equipmentOptions}
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
          <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
            <form onSubmit={handleAddCustom} className="flex flex-wrap items-center gap-2">
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={t("customPlaceholder")}
                className="min-w-0 flex-1"
              />
              <Input
                type="number"
                min={0}
                value={customDurationMin}
                onChange={(e) => setCustomDurationMin(e.target.value)}
                placeholder={t("customDurationPlaceholder")}
                className="w-24 shrink-0"
              />
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={!customExcludeFromNumbering}
                  onChange={(e) => setCustomExcludeFromNumbering(!e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                {t("countInNumbering")}
              </label>
              <Button type="submit" variant="secondary" size="sm">
                <Plus className="h-4 w-4" />
                {t("add")}
              </Button>
            </form>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t("commentPlaceholder")}
                className="min-w-0 flex-1"
              />
              <Button type="submit" variant="secondary" size="sm">
                <Plus className="h-4 w-4" />
                {t("addComment")}
              </Button>
            </form>

            <form onSubmit={handleAddSection} className="flex gap-2">
              <Input
                value={sectionLabel}
                onChange={(e) => setSectionLabel(e.target.value)}
                placeholder={t("sectionPlaceholder")}
                className="min-w-0 flex-1"
              />
              <Button type="submit" variant="secondary" size="sm">
                <Plus className="h-4 w-4" />
                {t("addSection")}
              </Button>
            </form>
          </div>
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
