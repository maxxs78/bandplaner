"use server";

import { prisma } from "@/lib/prisma";
import { requireMembership, canManageContent } from "@/lib/access";
import { setlistSchema } from "@/lib/validation";
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

export async function createSetlistAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) {
    return { error: "Gäste können keine Setlisten erstellen" };
  }

  const parsed = setlistSchema.safeParse({
    name: formData.get("name"),
    eventId: formData.get("eventId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const copyFromId = formData.get("copyFromId") as string | null;

  const setlist = await prisma.setlist.create({
    data: {
      bandId,
      name: parsed.data.name,
      eventId: parsed.data.eventId || null,
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
          songId: item.songId,
          customTitle: item.customTitle,
          songDeleted: item.songDeleted,
          order: item.order,
        })),
      });
    }
  }

  revalidatePath(`/bands/${bandId}/setlists`);
  redirect(`/bands/${bandId}/setlists/${setlist.id}`);
}

export async function linkSetlistToEventAction(bandId: string, eventId: string, formData: FormData) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;

  const setlistId = formData.get("setlistId") as string;
  if (!setlistId) return;

  await prisma.setlist.update({ where: { id: setlistId, bandId }, data: { eventId } });
  revalidatePath(`/bands/${bandId}/calendar/${eventId}`);
  revalidatePath(`/bands/${bandId}/setlists`);
}

export async function unlinkSetlistFromEventAction(bandId: string, setlistId: string, eventId: string) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;

  await prisma.setlist.update({ where: { id: setlistId, bandId }, data: { eventId: null } });
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

  const maxOrder = await prisma.setlistItem.aggregate({
    where: { setlistId },
    _max: { order: true },
  });

  await prisma.setlistItem.create({
    data: {
      setlistId,
      customTitle,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(`/bands/${bandId}/setlists/${setlistId}`);
}

export async function removeSetlistItemAction(bandId: string, setlistId: string, itemId: string) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;

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

export async function saveSetlistNoteAction(bandId: string, setlistId: string, formData: FormData) {
  const { user } = await requireMembership(bandId);
  const content = ((formData.get("content") as string) ?? "").trim();

  if (content === "") {
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
  data: AnnotationValues
): Promise<{ error?: string } | undefined> {
  const { user } = await requireMembership(bandId);

  await upsertOrPruneItemAnnotation(itemId, user.id, {
    note: data.note.trim() || null,
    color: data.color,
    cues: serializeCues(data.cues as Cue[]),
  });

  revalidatePath(`/bands/${bandId}/setlists/${setlistId}`);
  return undefined;
}
