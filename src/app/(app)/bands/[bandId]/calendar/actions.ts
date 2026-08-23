"use server";

import { getTranslations, getFormatter } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireMembership, canManageBandContent, canManageContent } from "@/lib/access";
import { getEventSchema } from "@/lib/validation";
import { getEnabledFeatures } from "@/lib/features";
import { notifyBand } from "@/lib/notifications";
import { uploadBandFileAction } from "../files/actions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import type { EventType, GigStatus, Role } from "@/generated/prisma/client";

export type FormState = { error?: string } | undefined;

function formatEventDate(format: Awaited<ReturnType<typeof getFormatter>>, date: Date) {
  return format.dateTime(date, { dateStyle: "full", timeStyle: "short" });
}

type LocationResolution = { location: string | null; locationId: string | null; label: string | null };

/**
 * EIN Ortsfeld im Terminformular: Freitext, Verknüpfung zu einem bestehenden Ort
 * oder Neuanlage eines Orts - je nach "locationMode" im Formular (fehlt dieses Feld,
 * z. B. weil das Orte-Feature für die Band deaktiviert ist, gilt Freitext als Fallback).
 */
async function resolveEventLocation(
  bandId: string,
  locationsEnabled: boolean,
  formData: FormData,
  textLocation: string | undefined
): Promise<LocationResolution | { error: string }> {
  const mode = locationsEnabled ? formData.get("locationMode") : null;

  if (mode === "existing") {
    const locationId = String(formData.get("locationId") || "");
    const location = await prisma.location.findUnique({ where: { id: locationId, bandId } });
    if (!location) {
      const t = await getTranslations("validation");
      return { error: t("invalidLocation") };
    }
    return { location: null, locationId: location.id, label: location.name };
  }

  if (mode === "new") {
    const name = String(formData.get("newLocationName") || "").trim();
    if (!name) {
      const t = await getTranslations("validation");
      return { error: t("nameRequired") };
    }
    const address = String(formData.get("newLocationAddress") || "").trim() || null;
    const created = await prisma.location.create({ data: { bandId, name, address } });
    return { location: null, locationId: created.id, label: created.name };
  }

  return { location: textLocation || null, locationId: null, label: textLocation || null };
}

async function parseEventForm(formData: FormData) {
  const t = await getTranslations("validation");
  return getEventSchema(t).safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    location: formData.get("location") || undefined,
    description: formData.get("description") || undefined,
    repeatWeekly: formData.get("repeatWeekly") === "on",
    repeatUntil: formData.get("repeatUntil") || undefined,
    arrivalAt: formData.get("arrivalAt") || undefined,
    soundcheckAt: formData.get("soundcheckAt") || undefined,
    technicalRequirements: formData.get("technicalRequirements") || undefined,
    gigStatus: formData.get("gigStatus") || undefined,
  });
}

export async function createEventAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership } = await requireMembership(bandId);
  const t = await getTranslations("calendar.actions");
  if (!canManageContent(membership.role)) {
    return { error: t("guestsCannotCreate") };
  }

  const parsed = await parseEventForm(formData);
  if (!parsed.success) {
    const tValidation = await getTranslations("validation");
    return { error: parsed.error.issues[0]?.message ?? tValidation("invalidInput") };
  }
  const data = parsed.data;
  const participantIds = formData.getAll("participantIds").map(String);

  const locationResult = await resolveEventLocation(
    bandId,
    getEnabledFeatures(membership.band).locations,
    formData,
    data.location
  );
  if ("error" in locationResult) {
    return { error: locationResult.error };
  }

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

  // Vorlage fuer die Besetzung: nur einmal vorab gelesen, damit alle Termine
  // einer wiederkehrenden Serie denselben Ausgangsstand erhalten.
  const lineupTemplate =
    data.type === "GIG"
      ? await prisma.bandLineupRole.findMany({ where: { bandId }, orderBy: { order: "asc" } })
      : [];

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
          location: locationResult.location,
          locationId: locationResult.locationId,
          description: data.description || null,
          seriesId,
          createdById: user.id,
          arrivalAt: data.arrivalAt ? new Date(data.arrivalAt) : null,
          soundcheckAt: data.soundcheckAt ? new Date(data.soundcheckAt) : null,
          technicalRequirements: data.technicalRequirements || null,
          gigStatus: data.type === "GIG" ? ((data.gigStatus as GigStatus | undefined) ?? "INQUIRY") : null,
        },
      });
      if (participantIds.length > 0) {
        await tx.eventParticipant.createMany({
          data: participantIds.map((userId) => ({ eventId: created.id, userId })),
        });
      }
      if (lineupTemplate.length > 0) {
        await tx.eventLineupEntry.createMany({
          data: lineupTemplate.map((role) => ({
            eventId: created.id,
            role: role.name,
            order: role.order,
            assignedToId: role.defaultAssigneeId,
          })),
        });
      }
      if (!first) first = created;
    }
    return first!;
  });

  await notifyBand({
    bandId,
    event: "NEW_EVENT",
    excludeUserId: user.id,
    namespace: "calendar.actions",
    buildMessage: (t, format) => ({
      subject: t("notifyNewEventSubject", { title: data.title }),
      body: t("notifyNewEventBody", {
        name: user.name ?? "",
        title: data.title,
        date: formatEventDate(format, start),
        locationSuffix: locationResult.label ? t("locationSuffix", { location: locationResult.label }) : "",
        seriesNote: occurrences.length > 1 ? t("weeklySeriesNote", { count: occurrences.length }) : "",
      }),
    }),
    path: `/bands/${bandId}/calendar/${firstEvent.id}`,
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
  const t = await getTranslations("calendar.actions");
  if (!(await canEditEvent(bandId, eventId, user.id, membership.role, isFinanceAdmin))) {
    return { error: t("noPermissionToEdit") };
  }

  const parsed = await parseEventForm(formData);
  if (!parsed.success) {
    const tValidation = await getTranslations("validation");
    return { error: parsed.error.issues[0]?.message ?? tValidation("invalidInput") };
  }
  const data = parsed.data;
  const participantIds = formData.getAll("participantIds").map(String);

  const locationResult = await resolveEventLocation(
    bandId,
    getEnabledFeatures(membership.band).locations,
    formData,
    data.location
  );
  if ("error" in locationResult) {
    return { error: locationResult.error };
  }

  // Beim (erneuten) Umstellen auf GIG die Besetzung aus dem globalen Katalog
  // vorbefuellen, aber nur, solange der Termin noch keine eigene Besetzung hat -
  // verhindert Doppel-Seeding beim mehrfachen Hin- und Herschalten der Terminart.
  const lineupTemplate =
    data.type === "GIG" && (await prisma.eventLineupEntry.count({ where: { eventId } })) === 0
      ? await prisma.bandLineupRole.findMany({ where: { bandId }, orderBy: { order: "asc" } })
      : [];

  // Die Gig-Felder werden nur bei type "GIG" ueberhaupt im Formular angezeigt.
  // Beim Wechsel zu einer anderen Terminart bleiben bereits gesetzte Werte in
  // der DB unangetastet (nur ausgeblendet, nicht geloescht) - analog zur
  // Besetzung (siehe lineupTemplate oben).
  const gigFieldUpdates =
    data.type === "GIG"
      ? {
          arrivalAt: data.arrivalAt ? new Date(data.arrivalAt) : null,
          soundcheckAt: data.soundcheckAt ? new Date(data.soundcheckAt) : null,
          technicalRequirements: data.technicalRequirements || null,
          gigStatus: (data.gigStatus as GigStatus | undefined) ?? "INQUIRY",
        }
      : {};

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId, bandId },
      data: {
        title: data.title,
        type: data.type as EventType,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        location: locationResult.location,
        locationId: locationResult.locationId,
        description: data.description || null,
        ...gigFieldUpdates,
      },
    }),
    prisma.eventParticipant.deleteMany({ where: { eventId } }),
    prisma.eventParticipant.createMany({
      data: participantIds.map((userId) => ({ eventId, userId })),
    }),
    ...(lineupTemplate.length > 0
      ? [
          prisma.eventLineupEntry.createMany({
            data: lineupTemplate.map((role) => ({
              eventId,
              role: role.name,
              order: role.order,
              assignedToId: role.defaultAssigneeId,
            })),
          }),
        ]
      : []),
  ]);

  await notifyBand({
    bandId,
    event: "EVENT_CHANGE",
    excludeUserId: user.id,
    namespace: "calendar.actions",
    buildMessage: (t, format) => ({
      subject: t("notifyEventChangedSubject", { title: data.title }),
      body: t("notifyEventChangedBody", {
        name: user.name ?? "",
        title: data.title,
        date: formatEventDate(format, new Date(data.startsAt)),
        locationSuffix: locationResult.label ? t("locationSuffix", { location: locationResult.label }) : "",
      }),
    }),
    path: `/bands/${bandId}/calendar/${eventId}`,
  });

  revalidatePath(`/bands/${bandId}/calendar`);
  redirect(`/bands/${bandId}/calendar/${eventId}`);
}

export async function deleteEventAction(bandId: string, eventId: string) {
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!(await canEditEvent(bandId, eventId, user.id, membership.role, isFinanceAdmin))) return;

  // Vor dem Loeschen lesen, damit die Benachrichtigung noch Titel/Datum kennt.
  const event = await prisma.event.findUnique({
    where: { id: eventId, bandId },
    select: { title: true, startsAt: true },
  });

  await prisma.event.delete({ where: { id: eventId, bandId } });

  if (event) {
    await notifyBand({
      bandId,
      event: "EVENT_CHANGE",
      excludeUserId: user.id,
      namespace: "calendar.actions",
      buildMessage: (t, format) => ({
        subject: t("notifyEventCancelledSubject", { title: event.title }),
        body: t("notifyEventCancelledBody", {
          name: user.name ?? "",
          title: event.title,
          date: formatEventDate(format, event.startsAt),
        }),
      }),
      path: `/bands/${bandId}/calendar`,
    });
  }

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

/**
 * Ersetzt die komplette Besetzung eines Gigs durch die im Formular uebermittelte
 * Liste (gleiches "alles ersetzen"-Muster wie bei updateLineupRolesAction fuer
 * den globalen Katalog) - einfacher und robuster als Einzel-Diffing bei einer
 * kurzen, gelegentlich bearbeiteten Liste.
 */
export async function saveLineupAction(
  bandId: string,
  eventId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return undefined;

  const event = await prisma.event.findUnique({ where: { id: eventId, bandId }, select: { id: true } });
  if (!event) return undefined;

  const roles = formData.getAll("role").map(String);
  const assignedToIds = formData.getAll("assignedToId").map(String);
  const assignedToNames = formData.getAll("assignedToName").map(String);

  const entries = roles
    .map((role, i) => ({
      role: role.trim(),
      assignedToId: assignedToIds[i] || null,
      assignedToName: assignedToNames[i]?.trim() || null,
    }))
    .filter((entry) => entry.role.length > 0);

  await prisma.$transaction([
    prisma.eventLineupEntry.deleteMany({ where: { eventId } }),
    prisma.eventLineupEntry.createMany({
      data: entries.map((entry, order) => ({
        eventId,
        order,
        role: entry.role,
        assignedToId: entry.assignedToId,
        assignedToName: entry.assignedToId ? null : entry.assignedToName,
      })),
    }),
  ]);

  revalidatePath(`/bands/${bandId}/calendar/${eventId}`);
  return undefined;
}
