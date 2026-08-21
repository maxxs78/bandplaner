"use server";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireMembership, canManageContent } from "@/lib/access";
import { getSetlistSchema } from "@/lib/validation";
import { serializeCues, type Cue } from "@/lib/setlist-cues";
import type { AnnotationValues } from "@/components/cue-annotation-editor";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type FormState = { error?: string } | undefined;

async function upsertOrPruneItemAnnotation(
  itemId: string,
  userId: string,
  patch: Partial<{ note: string | null; color: string | null; cues: string | null }>
) {
  const existing = await prisma.setlistItemAnnotation.findUnique({
    where: { itemId_userId: { itemId, userId } },
  });
  const merged = {
    note: patch.note !== undefined ? patch.note : (existing?.note ?? null),
    color: patch.color !== undefined ? patch.color : (existing?.color ?? null),
    cues: patch.cues !== undefined ? patch.cues : (existing?.cues ?? null),
  };
  const isEmpty = !merged.note && !merged.color && !merged.cues;

  if (isEmpty) {
    if (existing) await prisma.setlistItemAnnotation.delete({ where: { id: existing.id } });
    return;
  }

  await prisma.setlistItemAnnotation.upsert({
    where: { itemId_userId: { itemId, userId } },
    create: { itemId, userId, ...merged },
    update: merged,
  });
}

/**
 * Terminspezifisches Pendant zu upsertOrPruneItemAnnotation - genutzt, wenn im
 * Termin-Auswaehler auf der Setlist-Seite ein Termin aktiv gewaehlt ist (siehe
 * SetlistItemEventAnnotation in schema.prisma). Ohne aktiven Termin gilt
 * weiterhin die terminlose Variante oben.
 */
async function upsertOrPruneItemEventAnnotation(
  itemId: string,
  eventId: string,
  userId: string,
  patch: Partial<{ note: string | null; color: string | null; cues: string | null }>
) {
  const existing = await prisma.setlistItemEventAnnotation.findUnique({
    where: { itemId_eventId_userId: { itemId, eventId, userId } },
  });
  const merged = {
    note: patch.note !== undefined ? patch.note : (existing?.note ?? null),
    color: patch.color !== undefined ? patch.color : (existing?.color ?? null),
    cues: patch.cues !== undefined ? patch.cues : (existing?.cues ?? null),
  };
  const isEmpty = !merged.note && !merged.color && !merged.cues;

  if (isEmpty) {
    if (existing) await prisma.setlistItemEventAnnotation.delete({ where: { id: existing.id } });
    return;
  }

  await prisma.setlistItemEventAnnotation.upsert({
    where: { itemId_eventId_userId: { itemId, eventId, userId } },
    create: { itemId, eventId, userId, ...merged },
    update: merged,
  });
}

/**
 * Friert fuer jeden verknuepften Termin, der inzwischen in der Vergangenheit
 * liegt und noch keinen Snapshot hat, den aktuellen Listenstand ("wie
 * gespielt") ein. Wird VOR jeder Aenderung an der Song-Zusammensetzung/
 * -Reihenfolge aufgerufen (siehe SetlistEventSnapshot-Kommentar im Schema):
 * Solange niemand die Liste bearbeitet, entspricht der Live-Stand noch exakt
 * dem Stand beim Termin - ein Snapshot wird deshalb nicht "beim Termin
 * selbst", sondern spaetestens unmittelbar vor der ersten nachtraeglichen
 * Aenderung erzeugt, was ohne Hintergrundjob zum selben Ergebnis fuehrt.
 */
async function freezePastSetlistSnapshotsIfNeeded(setlistId: string) {
  const setlist = await prisma.setlist.findUnique({
    where: { id: setlistId },
    include: {
      events: { where: { startsAt: { lt: new Date() } }, select: { id: true } },
      items: {
        orderBy: { order: "asc" },
        include: { song: { select: { title: true, key: true, bpm: true, durationSec: true } } },
      },
    },
  });
  if (!setlist || setlist.events.length === 0) return;

  const existing = await prisma.setlistEventSnapshot.findMany({
    where: { setlistId, eventId: { in: setlist.events.map((e) => e.id) } },
    select: { eventId: true },
  });
  const alreadyFrozen = new Set(existing.map((s) => s.eventId));
  const toFreeze = setlist.events.filter((e) => !alreadyFrozen.has(e.id));
  if (toFreeze.length === 0) return;

  const itemsJson = JSON.stringify(
    setlist.items.map((item) => ({
      kind: item.kind,
      title: item.song?.title ?? item.customTitle ?? "",
      key: item.song?.key ?? null,
      bpm: item.song?.bpm ?? null,
      durationSec: item.song?.durationSec ?? item.durationSec ?? null,
      excludeFromNumbering: item.excludeFromNumbering,
    }))
  );

  await prisma.setlistEventSnapshot.createMany({
    data: toFreeze.map((e) => ({ setlistId, eventId: e.id, itemsJson })),
  });
}

export async function createSetlistAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  const t = await getTranslations("validation");
  if (!canManageContent(membership.role)) {
    const tSetlists = await getTranslations("setlists");
    return { error: tSetlists("guestsCannotCreate") };
  }

  const parsed = getSetlistSchema(t).safeParse({
    name: formData.get("name"),
    eventId: formData.get("eventId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  const copyFromId = formData.get("copyFromId") as string | null;

  const setlist = await prisma.setlist.create({
    data: {
      bandId,
      name: parsed.data.name,
      events: parsed.data.eventId ? { connect: { id: parsed.data.eventId } } : undefined,
    },
  });

  if (copyFromId) {
    const sourceItems = await prisma.setlistItem.findMany({
      where: { setlistId: copyFromId },
      orderBy: { order: "asc" },
    });
    if (sourceItems.length > 0) {
      await prisma.setlistItem.createMany({
        data: sourceItems.map((item) => ({
          setlistId: setlist.id,
          kind: item.kind,
          songId: item.songId,
          customTitle: item.customTitle,
          durationSec: item.durationSec,
          excludeFromNumbering: item.excludeFromNumbering,
          songDeleted: item.songDeleted,
          order: item.order,
        })),
      });
    }
  }

  if (parsed.data.eventId) {
    // Retroaktive Verknuepfung mit einem bereits vergangenen Termin: der Stand
    // direkt bei Anlage ist hier der einzig sinnvolle "wie gespielt"-Zeitpunkt.
    await freezePastSetlistSnapshotsIfNeeded(setlist.id);
  }

  revalidatePath(`/bands/${bandId}/setlists`);
  redirect(`/bands/${bandId}/setlists/${setlist.id}`);
}

export async function linkSetlistToEventAction(bandId: string, eventId: string, formData: FormData) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;

  const setlistId = formData.get("setlistId") as string;
  if (!setlistId) return;

  await prisma.setlist.update({
    where: { id: setlistId, bandId },
    data: { events: { connect: { id: eventId } } },
  });
  // Falls der frisch verknuepfte Termin bereits vergangen ist: sofort einfrieren,
  // analog zur retroaktiven Verknuepfung in createSetlistAction.
  await freezePastSetlistSnapshotsIfNeeded(setlistId);
  revalidatePath(`/bands/${bandId}/calendar/${eventId}`);
  revalidatePath(`/bands/${bandId}/setlists`);
}

export async function unlinkSetlistFromEventAction(bandId: string, setlistId: string, eventId: string) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;

  await prisma.setlist.update({
    where: { id: setlistId, bandId },
    data: { events: { disconnect: { id: eventId } } },
  });
  revalidatePath(`/bands/${bandId}/calendar/${eventId}`);
  revalidatePath(`/bands/${bandId}/setlists`);
}

export async function deleteSetlistAction(bandId: string, setlistId: string) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;

  await prisma.setlist.delete({ where: { id: setlistId, bandId } });
  revalidatePath(`/bands/${bandId}/setlists`);
  redirect(`/bands/${bandId}/setlists`);
}

export async function addSongToSetlistAction(bandId: string, setlistId: string, songId: string) {
  const { user, membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;
  await freezePastSetlistSnapshotsIfNeeded(setlistId);

  const [maxOrder, songNote] = await Promise.all([
    prisma.setlistItem.aggregate({ where: { setlistId }, _max: { order: true } }),
    prisma.songNote.findUnique({ where: { songId_userId: { songId, userId: user.id } } }),
  ]);

  const item = await prisma.setlistItem.create({
    data: {
      setlistId,
      songId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  if (songNote && (songNote.shortNote || songNote.color || songNote.cues)) {
    await prisma.setlistItemAnnotation.create({
      data: {
        itemId: item.id,
        userId: user.id,
        note: songNote.shortNote,
        color: songNote.color,
        cues: songNote.cues,
      },
    });
  }

  revalidatePath(`/bands/${bandId}/setlists/${setlistId}`);
}

export async function addCustomItemAction(bandId: string, setlistId: string, formData: FormData) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;

  const customTitle = (formData.get("customTitle") as string)?.trim();
  if (!customTitle) return;
  const durationMin = Number(formData.get("durationMin") || 0);
  const excludeFromNumbering = formData.get("excludeFromNumbering") === "on";
  await freezePastSetlistSnapshotsIfNeeded(setlistId);

  const maxOrder = await prisma.setlistItem.aggregate({
    where: { setlistId },
    _max: { order: true },
  });

  await prisma.setlistItem.create({
    data: {
      setlistId,
      kind: "CUSTOM",
      customTitle,
      durationSec: durationMin > 0 ? durationMin * 60 : null,
      excludeFromNumbering,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(`/bands/${bandId}/setlists/${setlistId}`);
}

export async function addCommentAction(bandId: string, setlistId: string, formData: FormData) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;

  const text = (formData.get("text") as string)?.trim();
  if (!text) return;
  await freezePastSetlistSnapshotsIfNeeded(setlistId);

  const maxOrder = await prisma.setlistItem.aggregate({ where: { setlistId }, _max: { order: true } });
  await prisma.setlistItem.create({
    data: {
      setlistId,
      kind: "COMMENT",
      customTitle: text,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(`/bands/${bandId}/setlists/${setlistId}`);
}

export async function addSectionAction(bandId: string, setlistId: string, formData: FormData) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;
  await freezePastSetlistSnapshotsIfNeeded(setlistId);

  const label = (formData.get("label") as string)?.trim() || null;
  const maxOrder = await prisma.setlistItem.aggregate({ where: { setlistId }, _max: { order: true } });
  await prisma.setlistItem.create({
    data: {
      setlistId,
      kind: "SECTION",
      customTitle: label,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(`/bands/${bandId}/setlists/${setlistId}`);
}

export async function setItemNumberingAction(
  bandId: string,
  setlistId: string,
  itemId: string,
  excludeFromNumbering: boolean
) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;
  await freezePastSetlistSnapshotsIfNeeded(setlistId);

  await prisma.setlistItem.update({
    where: { id: itemId, setlistId },
    data: { excludeFromNumbering },
  });
  revalidatePath(`/bands/${bandId}/setlists/${setlistId}`);
}

export async function removeSetlistItemAction(bandId: string, setlistId: string, itemId: string) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;
  await freezePastSetlistSnapshotsIfNeeded(setlistId);

  await prisma.setlistItem.delete({ where: { id: itemId, setlistId } });
  revalidatePath(`/bands/${bandId}/setlists/${setlistId}`);
}

export async function reorderSetlistItemsAction(
  bandId: string,
  setlistId: string,
  orderedItemIds: string[]
) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;
  await freezePastSetlistSnapshotsIfNeeded(setlistId);

  await prisma.$transaction(
    orderedItemIds.map((id, index) =>
      prisma.setlistItem.update({
        where: { id, setlistId },
        data: { order: index },
      })
    )
  );

  revalidatePath(`/bands/${bandId}/setlists/${setlistId}`);
}

export async function saveSetlistNoteAction(
  bandId: string,
  setlistId: string,
  eventId: string | null,
  formData: FormData
) {
  const { user } = await requireMembership(bandId);
  const content = ((formData.get("content") as string) ?? "").trim();

  if (eventId) {
    if (content === "") {
      await prisma.setlistEventNote.deleteMany({ where: { setlistId, eventId, userId: user.id } });
    } else {
      await prisma.setlistEventNote.upsert({
        where: { setlistId_eventId_userId: { setlistId, eventId, userId: user.id } },
        create: { setlistId, eventId, userId: user.id, content },
        update: { content },
      });
    }
  } else if (content === "") {
    await prisma.setlistNote.deleteMany({ where: { setlistId, userId: user.id } });
  } else {
    await prisma.setlistNote.upsert({
      where: { setlistId_userId: { setlistId, userId: user.id } },
      create: { setlistId, userId: user.id, content },
      update: { content },
    });
  }

  revalidatePath(`/bands/${bandId}/setlists/${setlistId}`);
}

export async function saveItemAnnotationAction(
  bandId: string,
  setlistId: string,
  itemId: string,
  eventId: string | null,
  data: AnnotationValues
): Promise<{ error?: string } | undefined> {
  const { user } = await requireMembership(bandId);

  const patch = {
    note: data.note.trim() || null,
    color: data.color,
    cues: serializeCues(data.cues as Cue[]),
  };
  if (eventId) {
    await upsertOrPruneItemEventAnnotation(itemId, eventId, user.id, patch);
  } else {
    await upsertOrPruneItemAnnotation(itemId, user.id, patch);
  }

  revalidatePath(`/bands/${bandId}/setlists/${setlistId}`);
  return undefined;
}
