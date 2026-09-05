"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { ClipboardList, CornerDownRight, FileText, GripVertical, Plus, RefreshCcw, Tag, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  addSongToSetlistAction,
  addCustomItemAction,
  addCommentAction,
  addSectionAction,
  removeSetlistItemAction,
  reorderSetlistItemsAction,
  saveItemAnnotationAction,
  saveItemTechNoteAction,
  setItemNumberingAction,
  toggleSegueAction,
  syncItemFromSongNoteAction,
} from "@/app/(app)/bands/[bandId]/setlists/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CueAnnotationEditor, type AnnotationValues, type EquipmentOption } from "@/components/cue-annotation-editor";
import { CueBadges, EquipmentIconStrip } from "@/components/cue-badges";
import type { EquipmentIconDisplay } from "@/lib/setlist-cues";
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
  /** Segue/Medley: Uebergang ohne Pause zum naechsten Eintrag. */
  segueToNext: boolean;
  song: {
    id: string;
    title: string;
    key: string | null;
    bpm: number | null;
    durationSec: number | null;
    status: string;
    /** Fuer alle sichtbare bzw. eigene Song-Dokumente (Downloads) - siehe Setlist-Detailseite. */
    files?: { id: string; filename: string }[];
    /** Aktuelle persoenliche Song-Notiz des Nutzers (Vorgabewerte fuer die Sync-Funktion). */
    myNote?: { shortNote: string | null; color: string | null; cues: string | null } | null;
  } | null;
  myAnnotation?: MyAnnotation;
  /** Geteilter technischer Zusatzhinweis (FOH/Licht/Technik) nur fuer diese Setlist. */
  techNotes: string | null;
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
  seguedFromPrev,
  isExpanded,
  onToggleExpand,
  onSetNumbering,
  equipmentIconDisplay,
}: {
  item: SetlistItem;
  number: number | null;
  seguedFromPrev?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSetNumbering?: (exclude: boolean) => void;
  equipmentIconDisplay: EquipmentIconDisplay;
}) {
  const t = useTranslations("setlists.builder");
  const { title, meta } = itemTitleAndMeta(item, t);
  const isArchived = item.song?.status === "ARCHIVED";
  const annotation = item.myAnnotation;
  const cues = parseCues(annotation?.cues);

  return (
    <>
      <span className="w-6 shrink-0 text-sm text-muted">
        {seguedFromPrev ? "↳" : number !== null ? `${number}.` : ""}
      </span>
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
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-xs text-muted">{meta}</p>
          {equipmentIconDisplay === "LARGE" && <EquipmentIconStrip cues={cues} />}
        </div>
        {(annotation?.note || cues.length > 0) && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {annotation?.note && <p className="text-xs italic text-foreground">{annotation.note}</p>}
            <CueBadges cues={cues} showEquipmentIcon={equipmentIconDisplay === "IN_TAG"} />
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
  seguedFromPrev,
  isExpanded,
  onToggleExpand,
  onSetNumbering,
  equipmentIconDisplay,
}: {
  item: SetlistItem;
  number: number | null;
  seguedFromPrev?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSetNumbering?: (exclude: boolean) => void;
  equipmentIconDisplay: EquipmentIconDisplay;
}) {
  if (item.kind === "COMMENT") return <CommentContent item={item} />;
  if (item.kind === "SECTION") return <SectionContent item={item} />;
  return (
    <RowContent
      item={item}
      number={number}
      seguedFromPrev={seguedFromPrev}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onSetNumbering={onSetNumbering}
      equipmentIconDisplay={equipmentIconDisplay}
    />
  );
}

function ReadOnlyRow({
  item,
  number,
  seguedFromPrev,
  isExpanded,
  onToggleExpand,
  equipmentIconDisplay,
}: {
  item: SetlistItem;
  number: number | null;
  seguedFromPrev?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  equipmentIconDisplay: EquipmentIconDisplay;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5",
        item.songDeleted ? "bg-surface-muted" : "bg-surface"
      )}
      style={item.myAnnotation?.color ? { borderLeft: `4px solid ${item.myAnnotation.color}` } : undefined}
    >
      <ItemContent
        item={item}
        number={number}
        seguedFromPrev={seguedFromPrev}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        equipmentIconDisplay={equipmentIconDisplay}
      />
    </div>
  );
}

function SortableRow({
  item,
  number,
  seguedFromPrev,
  isExpanded,
  onToggleExpand,
  onRemove,
  onSetNumbering,
  equipmentIconDisplay,
}: {
  item: SetlistItem;
  number: number | null;
  seguedFromPrev?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: (id: string) => void;
  onSetNumbering: (itemId: string, exclude: boolean) => void;
  equipmentIconDisplay: EquipmentIconDisplay;
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
        seguedFromPrev={seguedFromPrev}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onSetNumbering={(exclude) => onSetNumbering(item.id, exclude)}
        equipmentIconDisplay={equipmentIconDisplay}
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

/** Geteilter (nicht personenbezogener) technischer Zusatzhinweis fuer diesen
 * Eintrag - editierbar von Content-Managern, analog zur persoenlichen
 * Notiz oben, aber fuer alle sichtbar (FOH/Licht/Technik-Ausdruck). */
function ItemTechNoteForm({
  defaultValue,
  onSave,
}: {
  defaultValue: string;
  onSave: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("setlists.builder");

  return (
    <form action={onSave} className="mt-3 space-y-1.5 border-t border-border pt-3">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <ClipboardList className="h-3.5 w-3.5" />
        {t("techNoteLabel")}
      </label>
      <Input name="techNotes" defaultValue={defaultValue} placeholder={t("techNotePlaceholder")} className="text-xs" />
      <Button type="submit" size="sm" variant="secondary">
        {t("techNoteSave")}
      </Button>
    </form>
  );
}

/** Zusatzbereich im aufgeklappten SONG-Eintrag: Dokumente des Songs, Sync aus
 * der Song-Notiz und (nur bearbeitbar) der Segue-Schalter. */
function SongItemExtras({
  item,
  readOnly,
  syncing,
  onSync,
  onToggleSegue,
}: {
  item: SetlistItem;
  readOnly: boolean;
  syncing: boolean;
  onSync: () => void;
  onToggleSegue: (segueToNext: boolean) => void;
}) {
  const t = useTranslations("setlists.builder");
  const files = item.song?.files ?? [];

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
      {files.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 font-medium text-muted">
            <FileText className="h-3.5 w-3.5" />
            {t("songDocuments", { count: files.length })}
          </p>
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f.id}>
                <a
                  href={`/api/song-files/${f.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {f.filename}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onSync} disabled={syncing}>
          <RefreshCcw className="h-3.5 w-3.5" />
          {syncing ? t("syncing") : t("syncFromSong")}
        </Button>
        {!readOnly && (
          <label className="flex items-center gap-1.5 text-muted">
            <input
              type="checkbox"
              checked={item.segueToNext}
              onChange={(e) => onToggleSegue(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            <CornerDownRight className="h-3.5 w-3.5" />
            {t("segueToggle")}
          </label>
        )}
      </div>
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
  equipmentIconDisplay = "IN_TAG",
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
  /** Setlist.equipmentIconDisplay - steuert, wie Equipment-Icons an den Zeilen dargestellt werden. */
  equipmentIconDisplay?: EquipmentIconDisplay;
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
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const optimisticIdCounter = useRef(0);
  const router = useRouter();
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

  function handleToggleSegue(itemId: string, segueToNext: boolean) {
    setItems((current) =>
      current.map((i) => (i.id === itemId ? { ...i, segueToNext } : i))
    );
    startTransition(() => toggleSegueAction(bandId, setlistId, itemId, segueToNext));
  }

  /** Uebernimmt die aktuellen Song-Notiz-Vorgaben (Kurznotiz/Farbe/Cues) lokal
   * und serverseitig in die persoenliche Annotation dieses Eintrags. */
  function handleSyncFromSongNote(itemId: string) {
    setSyncingItemId(itemId);
    setItems((current) =>
      current.map((i) => {
        if (i.id !== itemId) return i;
        const n = i.song?.myNote;
        return {
          ...i,
          myAnnotation: {
            note: n?.shortNote ?? null,
            color: n?.color ?? null,
            cues: n?.cues ?? null,
          },
        };
      })
    );
    startTransition(async () => {
      await syncItemFromSongNoteAction(bandId, setlistId, itemId, eventId);
      setSyncingItemId(null);
      router.refresh();
    });
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
        segueToNext: false,
        techNotes: null,
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
        segueToNext: false,
        techNotes: null,
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
        segueToNext: false,
        techNotes: null,
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
        segueToNext: false,
        techNotes: null,
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
  const isPlayable = (i?: SetlistItem) => Boolean(i && i.kind !== "COMMENT" && i.kind !== "SECTION");
  const seguedFromPrev = (index: number) =>
    Boolean(items[index - 1]?.segueToNext && isPlayable(items[index - 1]) && isPlayable(items[index]));
  // Zusammenhaengende Segue-Laeufe fuer die optische Buendelung: jeder Eintrag
  // bildet eine eigene Einheit, ausser er haengt per Segue am Vorgaenger.
  const segueUnits: number[][] = [];
  items.forEach((_, index) => {
    if (index > 0 && seguedFromPrev(index)) segueUnits[segueUnits.length - 1].push(index);
    else segueUnits.push([index]);
  });

  const expandedPanel = (item: SetlistItem, editable: boolean) =>
    expandedItemId === item.id && item.kind !== "COMMENT" && item.kind !== "SECTION" ? (
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
        {item.kind === "SONG" && (
          <>
            {editable && (
              <ItemTechNoteForm
                key={item.id}
                defaultValue={item.techNotes ?? ""}
                onSave={(formData) => saveItemTechNoteAction(bandId, setlistId, item.id, formData)}
              />
            )}
            <SongItemExtras
              item={item}
              readOnly={!editable}
              syncing={syncingItemId === item.id}
              onSync={() => handleSyncFromSongNote(item.id)}
              onToggleSegue={(v) => handleToggleSegue(item.id, v)}
            />
          </>
        )}
      </div>
    ) : null;

  // Rendert eine Segue-Einheit: einzelner Eintrag oder - bei einem Segue-Lauf -
  // ein gemeinsam umrahmter Block mit Klammer-Balken und "Segue"-Markierung.
  const renderUnit = (unit: number[], editable: boolean) => {
    const rows = unit.map((index) => {
      const item = items[index];
      const toggleExpand = () =>
        setExpandedItemId((current) => (current === item.id ? null : item.id));
      return (
        <div key={item.id}>
          {editable ? (
            <SortableRow
              item={item}
              number={numbers[index]}
              seguedFromPrev={seguedFromPrev(index)}
              isExpanded={expandedItemId === item.id}
              onToggleExpand={toggleExpand}
              onRemove={handleRemove}
              onSetNumbering={handleSetNumbering}
              equipmentIconDisplay={equipmentIconDisplay}
            />
          ) : (
            <ReadOnlyRow
              item={item}
              number={numbers[index]}
              seguedFromPrev={seguedFromPrev(index)}
              isExpanded={expandedItemId === item.id}
              onToggleExpand={toggleExpand}
              equipmentIconDisplay={equipmentIconDisplay}
            />
          )}
          {expandedPanel(item, editable)}
        </div>
      );
    });
    if (unit.length === 1) return rows[0];
    return (
      <div
        key={`seg-${items[unit[0]].id}`}
        className="space-y-1.5 rounded-lg border border-l-[3px] border-primary/30 border-l-primary bg-primary/5 p-2"
      >
        <p className="flex items-center gap-1 pl-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          <CornerDownRight className="h-3 w-3" />
          {t("segueGroupLabel")}
        </p>
        {rows}
      </div>
    );
  };

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
            {segueUnits.map((unit) => renderUnit(unit, false))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="mt-3 space-y-2">
                {segueUnits.map((unit) => renderUnit(unit, true))}
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
