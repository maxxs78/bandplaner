"use server";

import { prisma } from "@/lib/prisma";
import { requireMembership, canManageContent } from "@/lib/access";
import { getEnabledFeatures } from "@/lib/features";
import { equipmentVisibleInBand } from "@/lib/equipment-visibility";
import { equipmentSchema, packlistSchema } from "@/lib/validation";
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
  if (!getEnabledFeatures(membership.band).equipment) {
    return { error: "Equipment ist für diese Band deaktiviert" };
  }
  if (!canManageContent(membership.role)) {
    return { error: "Gäste können kein Equipment anlegen" };
  }

  const parsed = equipmentSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    ownerId: formData.get("ownerId") || undefined,
    responsibleId: formData.get("responsibleId") || undefined,
    category: formData.get("category") || "OTHER",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const ownerUserId = parsed.data.ownerId || null;
  const responsibleId = parsed.data.responsibleId || null;
  for (const userId of [ownerUserId, responsibleId].filter((id): id is string => Boolean(id))) {
    const member = await prisma.membership.findUnique({ where: { userId_bandId: { userId, bandId } } });
    if (!member) return { error: "Ungültiges Mitglied" };
  }

  await prisma.equipment.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      category: parsed.data.category,
      ownerUserId,
      ownerBandId: ownerUserId ? null : bandId,
      responsibleId,
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
  if (!getEnabledFeatures(membership.band).equipment) {
    return { error: "Equipment ist für diese Band deaktiviert" };
  }
  if (!(await canEditEquipment(bandId, equipmentId, user.id, membership.role))) {
    return { error: "Keine Berechtigung, dieses Equipment zu bearbeiten" };
  }

  const parsed = equipmentSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    ownerId: formData.get("ownerId") || undefined,
    responsibleId: formData.get("responsibleId") || undefined,
    category: formData.get("category") || "OTHER",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const ownerUserId = parsed.data.ownerId || null;
  const responsibleId = parsed.data.responsibleId || null;
  for (const userId of [ownerUserId, responsibleId].filter((id): id is string => Boolean(id))) {
    const member = await prisma.membership.findUnique({ where: { userId_bandId: { userId, bandId } } });
    if (!member) return { error: "Ungültiges Mitglied" };
  }

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

export async function createPacklistAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) {
    return { error: "Packlisten sind für diese Band deaktiviert" };
  }
  if (!canManageContent(membership.role)) {
    return { error: "Gäste können keine Packlisten erstellen" };
  }

  const parsed = packlistSchema.safeParse({
    name: formData.get("name"),
    eventId: formData.get("eventId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const packlist = await prisma.packlist.create({
    data: {
      bandId,
      name: parsed.data.name,
      eventId: parsed.data.eventId || null,
    },
  });

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

  await prisma.packlist.update({ where: { id: packlistId, bandId }, data: { eventId } });
  revalidatePath(`/bands/${bandId}/calendar/${eventId}`);
  revalidatePath(`/bands/${bandId}/equipment/packlists`);
}

export async function unlinkPacklistFromEventAction(bandId: string, packlistId: string, eventId: string) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;

  await prisma.packlist.update({ where: { id: packlistId, bandId }, data: { eventId: null } });
  revalidatePath(`/bands/${bandId}/calendar/${eventId}`);
  revalidatePath(`/bands/${bandId}/equipment/packlists`);
}

export async function addPacklistEquipmentAction(bandId: string, packlistId: string, equipmentId: string) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;

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

  await prisma.packlistItem.delete({ where: { id: itemId, packlistId } });
  revalidatePath(`/bands/${bandId}/equipment/packlists/${packlistId}`);
}

export async function togglePacklistItemAction(
  bandId: string,
  packlistId: string,
  itemId: string,
  checked: boolean
) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;

  await prisma.packlistItem.update({
    where: { id: itemId, packlistId },
    data: { checked },
  });
  revalidatePath(`/bands/${bandId}/equipment/packlists/${packlistId}`);
}

export async function assignPacklistItemAction(
  bandId: string,
  packlistId: string,
  itemId: string,
  assignedToId: string
) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) return;
  if (!canManageContent(membership.role)) return;

  await prisma.packlistItem.update({
    where: { id: itemId, packlistId },
    data: { assignedToId: assignedToId || null },
  });
  revalidatePath(`/bands/${bandId}/equipment/packlists/${packlistId}`);
}

export async function uploadEquipmentFileAction(
  bandId: string,
  equipmentId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).equipment) {
    return { error: "Equipment ist für diese Band deaktiviert" };
  }
  if (!(await canEditEquipment(bandId, equipmentId, user.id, membership.role))) {
    return { error: "Keine Berechtigung, Dateien für dieses Equipment hochzuladen" };
  }

  formData.set("equipmentId", equipmentId);
  const result = await uploadBandFileAction(bandId, prevState, formData);
  revalidatePath(`/bands/${bandId}/equipment/${equipmentId}/edit`);
  return result;
}
