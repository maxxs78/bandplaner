"use server";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireMembership, canManageContent } from "@/lib/access";
import { getEnabledFeatures } from "@/lib/features";
import { equipmentVisibleInBand } from "@/lib/equipment-visibility";
import { getEquipmentSchema, getPacklistSchema } from "@/lib/validation";
import { isEquipmentIconKey } from "@/lib/equipment-icons";
import { uploadBandFileAction } from "../files/actions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Role } from "@/generated/prisma/client";

export type FormState = { error?: string } | undefined;

/**
 * Band-Equipment darf von jeder inhalte-berechtigten Person dieser Band gepflegt
 * werden. Persönliches Equipment gehört einer Person und ist bandunabhängig -
 * es darf ausschließlich diese Person selbst bearbeiten, unabhängig davon, in
 * welcher Band man sich gerade befindet (kein Admin-Override, da das Item nicht
 * "der Band" gehört).
 */
async function canEditEquipment(bandId: string, equipmentId: string, userId: string, role: Role) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { ownerBandId: true, ownerUserId: true },
  });
  if (!equipment) return false;

  if (equipment.ownerUserId) return equipment.ownerUserId === userId;
  if (equipment.ownerBandId !== bandId) return false;
  return canManageContent(role);
}

export async function createEquipmentAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  const ta = await getTranslations("equipment.actions");
  if (!getEnabledFeatures(membership.band).equipment) {
    return { error: ta("disabledForBand") };
  }
  if (!canManageContent(membership.role)) {
    return { error: ta("guestsCannotCreate") };
  }

  const t = await getTranslations("validation");
  const parsed = getEquipmentSchema(t).safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    ownerId: formData.get("ownerId") || undefined,
    responsibleId: formData.get("responsibleId") || undefined,
    category: formData.get("category") || "OTHER",
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  const ownerUserId = parsed.data.ownerId || null;
  const responsibleId = parsed.data.responsibleId || null;
  for (const userId of [ownerUserId, responsibleId].filter((id): id is string => Boolean(id))) {
    const member = await prisma.membership.findUnique({ where: { userId_bandId: { userId, bandId } } });
    if (!member) return { error: ta("invalidMember") };
  }

  const icon = isEquipmentIconKey(parsed.data.icon) ? parsed.data.icon : null;

  await prisma.equipment.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      category: parsed.data.category,
      ownerUserId,
      ownerBandId: ownerUserId ? null : bandId,
      responsibleId,
      icon,
      color: icon ? parsed.data.color || null : null,
    },
  });

  revalidatePath(`/bands/${bandId}/equipment`);
  return undefined;
}

export async function updateEquipmentAction(
  bandId: string,
  equipmentId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership } = await requireMembership(bandId);
  const ta = await getTranslations("equipment.actions");
  if (!getEnabledFeatures(membership.band).equipment) {
    return { error: ta("disabledForBand") };
  }
  if (!(await canEditEquipment(bandId, equipmentId, user.id, membership.role))) {
    return { error: ta("noPermissionToEdit") };
  }

  const t = await getTranslations("validation");
  const parsed = getEquipmentSchema(t).safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    ownerId: formData.get("ownerId") || undefined,
    responsibleId: formData.get("responsibleId") || undefined,
    category: formData.get("category") || "OTHER",
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  const ownerUserId = parsed.data.ownerId || null;
  const responsibleId = parsed.data.responsibleId || null;
  for (const userId of [ownerUserId, responsibleId].filter((id): id is string => Boolean(id))) {
    const member = await prisma.membership.findUnique({ where: { userId_bandId: { userId, bandId } } });
    if (!member) return { error: ta("invalidMember") };
  }

  const icon = isEquipmentIconKey(parsed.data.icon) ? parsed.data.icon : null;

  await prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      category: parsed.data.category,
      ownerUserId,
      ownerBandId: ownerUserId ? null : bandId,
      responsibleId,
      icon,
      color: icon ? parsed.data.color || null : null,
    },
  });

  revalidatePath(`/bands/${bandId}/equipment`);
  return undefined;
}

export async function deleteEquipmentAction(bandId: string, equipmentId: string) {
  const { user, membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).equipment) return;
  if (!(await canEditEquipment(bandId, equipmentId, user.id, membership.role))) return;

  await prisma.equipment.delete({ where: { id: equipmentId } });
  revalidatePath(`/bands/${bandId}/equipment`);
}

/**
 * Analoges "wie gepackt"-Pendant zu freezePastSetlistSnapshotsIfNeeded (siehe
 * dortigen Kommentar in setlists/actions.ts) - wird vor jeder Aenderung an der
 * Zusammensetzung der Packliste aufgerufen. checked/assignedToName werden je
 * verknuepftem Termin aus PacklistItemEventStatus geloest (sonst dem globalen
 * PacklistItem-Stand), da diese Zeilen beim spaeteren Entfernen des Eintrags
 * kaskadierend mitgeloescht wuerden.
 */
async function freezePastPacklistSnapshotsIfNeeded(packlistId: string) {
  const packlist = await prisma.packlist.findUnique({
    where: { id: packlistId },
    include: {
      events: { where: { startsAt: { lt: new Date() } }, select: { id: true } },
      items: {
        orderBy: { order: "asc" },
        include: {
          equipment: { select: { name: true } },
          assignedTo: { select: { name: true } },
          eventStatuses: { include: { assignedTo: { select: { name: true } } } },
        },
      },
    },
  });
  if (!packlist || packlist.events.length === 0) return;

  const existing = await prisma.packlistEventSnapshot.findMany({
    where: { packlistId, eventId: { in: packlist.events.map((e) => e.id) } },
    select: { eventId: true },
  });
  const alreadyFrozen = new Set(existing.map((s) => s.eventId));
  const toFreeze = packlist.events.filter((e) => !alreadyFrozen.has(e.id));
  if (toFreeze.length === 0) return;

  await prisma.packlistEventSnapshot.createMany({
    data: toFreeze.map((e) => {
      const itemsJson = JSON.stringify(
        packlist.items.map((item) => {
          const status = item.eventStatuses.find((s) => s.eventId === e.id);
          return {
            name: item.equipment?.name ?? item.customName ?? "",
            checked: status ? status.checked : item.checked,
            assignedToName: status ? (status.assignedTo?.name ?? null) : (item.assignedTo?.name ?? null),
          };
        })
      );
      return { packlistId, eventId: e.id, itemsJson };
    }),
  });
}

export async function createPacklistAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  const ta = await getTranslations("equipment.actions");
  if (!getEnabledFeatures(membership.band).packlists) {
    return { error: ta("packlistsDisabled") };
  }
  if (!canManageContent(membership.role)) {
    return { error: ta("guestsCannotCreatePacklist") };
  }

  const t = await getTranslations("validation");
  const parsed = getPacklistSchema(t).safeParse({
    name: formData.get("name"),
    eventId: formData.get("eventId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  const packlist = await prisma.packlist.create({
    data: {
      bandId,
      name: parsed.data.name,
      events: parsed.data.eventId ? { connect: { id: parsed.data.eventId } } : undefined,
    },
  });

  if (parsed.data.eventId) {
    // Retroaktive Verknuepfung mit einem bereits vergangenen Termin: der Stand
    // direkt bei Anlage ist hier der einzig sinnvolle "wie gepackt"-Zeitpunkt.
    await freezePastPacklistSnapshotsIfNeeded(packlist.id);
  }

  revalidatePath(`/bands/${bandId}/equipment/packlists`);
  redirect(`/bands/${bandId}/equipment/packlists/${packlist.id}`);
}

export async function deletePacklistAction(bandId: string, packlistId: string) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;

  await prisma.packlist.delete({ where: { id: packlistId, bandId } });
  revalidatePath(`/bands/${bandId}/equipment/packlists`);
  redirect(`/bands/${bandId}/equipment/packlists`);
}

export async function linkPacklistToEventAction(bandId: string, eventId: string, formData: FormData) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;

  const packlistId = formData.get("packlistId") as string;
  if (!packlistId) return;

  await prisma.packlist.update({
    where: { id: packlistId, bandId },
    data: { events: { connect: { id: eventId } } },
  });
  // Falls der frisch verknuepfte Termin bereits vergangen ist: sofort einfrieren,
  // analog zur retroaktiven Verknuepfung in createPacklistAction.
  await freezePastPacklistSnapshotsIfNeeded(packlistId);
  revalidatePath(`/bands/${bandId}/calendar/${eventId}`);
  revalidatePath(`/bands/${bandId}/equipment/packlists`);
}

export async function unlinkPacklistFromEventAction(bandId: string, packlistId: string, eventId: string) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;

  await prisma.packlist.update({
    where: { id: packlistId, bandId },
    data: { events: { disconnect: { id: eventId } } },
  });
  revalidatePath(`/bands/${bandId}/calendar/${eventId}`);
  revalidatePath(`/bands/${bandId}/equipment/packlists`);
}

export async function addPacklistEquipmentAction(bandId: string, packlistId: string, equipmentId: string) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;
  await freezePastPacklistSnapshotsIfNeeded(packlistId);

  const [maxOrder, equipment] = await Promise.all([
    prisma.packlistItem.aggregate({ where: { packlistId }, _max: { order: true } }),
    prisma.equipment.findFirst({
      where: { id: equipmentId, ...equipmentVisibleInBand(bandId) },
      select: { responsibleId: true, ownerUserId: true },
    }),
  ]);
  if (!equipment) return;

  // Verantwortliche:r wird vorbelegt (bleibt danach frei änderbar): zuerst das
  // fest hinterlegte Equipment-Verantwortlichkeit, sonst der/die Eigentümer:in.
  const assignedToId = equipment.responsibleId ?? equipment.ownerUserId ?? null;

  await prisma.packlistItem.create({
    data: {
      packlistId,
      equipmentId,
      assignedToId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(`/bands/${bandId}/equipment/packlists/${packlistId}`);
}

export async function addPacklistCustomItemAction(bandId: string, packlistId: string, formData: FormData) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;

  const customName = (formData.get("customName") as string)?.trim();
  if (!customName) return;
  await freezePastPacklistSnapshotsIfNeeded(packlistId);

  const maxOrder = await prisma.packlistItem.aggregate({
    where: { packlistId },
    _max: { order: true },
  });

  await prisma.packlistItem.create({
    data: {
      packlistId,
      customName,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(`/bands/${bandId}/equipment/packlists/${packlistId}`);
}

export async function removePacklistItemAction(bandId: string, packlistId: string, itemId: string) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;
  await freezePastPacklistSnapshotsIfNeeded(packlistId);

  await prisma.packlistItem.delete({ where: { id: itemId, packlistId } });
  revalidatePath(`/bands/${bandId}/equipment/packlists/${packlistId}`);
}

export async function togglePacklistItemAction(
  bandId: string,
  packlistId: string,
  itemId: string,
  eventId: string | null,
  checked: boolean
) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;

  if (eventId) {
    await prisma.packlistItemEventStatus.upsert({
      where: { itemId_eventId: { itemId, eventId } },
      create: { itemId, eventId, checked },
      update: { checked },
    });
  } else {
    await prisma.packlistItem.update({
      where: { id: itemId, packlistId },
      data: { checked },
    });
  }
  revalidatePath(`/bands/${bandId}/equipment/packlists/${packlistId}`);
}

export async function assignPacklistItemAction(
  bandId: string,
  packlistId: string,
  itemId: string,
  eventId: string | null,
  assignedToId: string
) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;

  if (eventId) {
    await prisma.packlistItemEventStatus.upsert({
      where: { itemId_eventId: { itemId, eventId } },
      create: { itemId, eventId, assignedToId: assignedToId || null },
      update: { assignedToId: assignedToId || null },
    });
  } else {
    await prisma.packlistItem.update({
      where: { id: itemId, packlistId },
      data: { assignedToId: assignedToId || null },
    });
  }
  revalidatePath(`/bands/${bandId}/equipment/packlists/${packlistId}`);
}

export async function uploadEquipmentFileAction(
  bandId: string,
  equipmentId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership } = await requireMembership(bandId);
  const ta = await getTranslations("equipment.actions");
  if (!getEnabledFeatures(membership.band).equipment) {
    return { error: ta("disabledForBand") };
  }
  if (!(await canEditEquipment(bandId, equipmentId, user.id, membership.role))) {
    return { error: ta("noPermissionToUpload") };
  }

  formData.set("equipmentId", equipmentId);
  const result = await uploadBandFileAction(bandId, prevState, formData);
  revalidatePath(`/bands/${bandId}/equipment/${equipmentId}/edit`);
  return result;
}
