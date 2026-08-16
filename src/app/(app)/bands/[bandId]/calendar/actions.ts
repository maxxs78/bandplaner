"use server";

import { prisma } from "@/lib/prisma";
import { requireMembership, canManageBandContent, canManageContent } from "@/lib/access";
import { eventSchema } from "@/lib/validation";
import { uploadBandFileAction } from "../files/actions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import type { EventType, Role } from "@/generated/prisma/client";

export type FormState = { error?: string } | undefined;

function parseEventForm(formData: FormData) {
  return eventSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    location: formData.get("location") || undefined,
    description: formData.get("description") || undefined,
    repeatWeekly: formData.get("repeatWeekly") === "on",
    repeatUntil: formData.get("repeatUntil") || undefined,
  });
}

export async function createEventAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) {
    return { error: "Gäste können keine Termine erstellen" };
  }

  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }
  const data = parsed.data;
  const participantIds = formData.getAll("participantIds").map(String);

  const start = new Date(data.startsAt);
  const end = new Date(data.endsAt);
  const durationMs = end.getTime() - start.getTime();

  const seriesId = data.repeatWeekly ? randomUUID() : null;

  const occurrences: { startsAt: Date; endsAt: Date }[] = [{ startsAt: start, endsAt: end }];

  if (data.repeatWeekly && data.repeatUntil) {
    const until = new Date(data.repeatUntil);
    let cursor = new Date(start);
    for (let i = 0; i < 104; i++) {
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (cursor > until) break;
      occurrences.push({
        startsAt: cursor,
        endsAt: new Date(cursor.getTime() + durationMs),
      });
    }
  }

  const firstEvent = await prisma.$transaction(async (tx) => {
    let first: { id: string } | null = null;
    for (const occ of occurrences) {
      const created = await tx.event.create({
        data: {
          bandId,
          title: data.title,
          type: data.type as EventType,
          startsAt: occ.startsAt,
          endsAt: occ.endsAt,
          location: data.location || null,
          description: data.description || null,
          seriesId,
          createdById: user.id,
        },
      });
      if (participantIds.length > 0) {
        await tx.eventParticipant.createMany({
          data: participantIds.map((userId) => ({ eventId: created.id, userId })),
        });
      }
      if (!first) first = created;
    }
    return first!;
  });

  revalidatePath(`/bands/${bandId}/calendar`);
  redirect(`/bands/${bandId}/calendar/${firstEvent.id}`);
}

async function canEditEvent(
  bandId: string,
  eventId: string,
  userId: string,
  role: Role,
  isFinanceAdmin: boolean
) {
  if (canManageBandContent(role, isFinanceAdmin)) return true;
  if (!canManageContent(role)) return false;

  const event = await prisma.event.findUnique({
    where: { id: eventId, bandId },
    select: { createdById: true },
  });
  return event?.createdById === userId;
}

export async function updateEventAction(
  bandId: string,
  eventId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!(await canEditEvent(bandId, eventId, user.id, membership.role, isFinanceAdmin))) {
    return { error: "Keine Berechtigung, diesen Termin zu bearbeiten" };
  }

  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }
  const data = parsed.data;
  const participantIds = formData.getAll("participantIds").map(String);

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId, bandId },
      data: {
        title: data.title,
        type: data.type as EventType,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        location: data.location || null,
        description: data.description || null,
      },
    }),
    prisma.eventParticipant.deleteMany({ where: { eventId } }),
    prisma.eventParticipant.createMany({
      data: participantIds.map((userId) => ({ eventId, userId })),
    }),
  ]);

  revalidatePath(`/bands/${bandId}/calendar`);
  redirect(`/bands/${bandId}/calendar/${eventId}`);
}

export async function deleteEventAction(bandId: string, eventId: string) {
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!(await canEditEvent(bandId, eventId, user.id, membership.role, isFinanceAdmin))) return;

  await prisma.event.delete({ where: { id: eventId, bandId } });
  revalidatePath(`/bands/${bandId}/calendar`);
  redirect(`/bands/${bandId}/calendar`);
}

export async function respondAvailabilityAction(
  bandId: string,
  eventId: string,
  status: "YES" | "NO" | "MAYBE"
) {
  const { user } = await requireMembership(bandId);

  await prisma.availability.upsert({
    where: { eventId_userId: { eventId, userId: user.id } },
    create: { eventId, userId: user.id, status },
    update: { status, respondedAt: new Date() },
  });

  revalidatePath(`/bands/${bandId}/calendar/${eventId}`);
}

export async function uploadEventFileAction(
  bandId: string,
  eventId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  formData.set("eventId", eventId);
  const result = await uploadBandFileAction(bandId, prevState, formData);
  revalidatePath(`/bands/${bandId}/calendar/${eventId}`);
  return result;
}
