"use server";

import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireMembership, canManageBand } from "@/lib/access";
import { inviteSchema, bandProfileSchema, guestAccessSchema } from "@/lib/validation";
import { saveUploadedImage, deleteUploadedFile } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import type { Role } from "@/generated/prisma/client";
import type { ImageFormState } from "@/components/image-upload-form";

export type FormState = { error?: string; success?: string } | undefined;
export type PasswordResetState = { error?: string; success?: string; tempPassword?: string } | undefined;

/** Vermeidet leicht verwechselbare Zeichen (0/O, 1/l/I), damit das Passwort sich mündlich/schriftlich sauber weitergeben laesst. */
function generateTempPassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars[randomInt(chars.length)];
  }
  return password;
}

export async function inviteAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Nur Administrator:innen können einladen" };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    guestUntil: formData.get("guestUntil") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const email = parsed.data.email.toLowerCase().trim();

  const existingMember = await prisma.membership.findFirst({
    where: { bandId, user: { email } },
  });
  if (existingMember) {
    return { error: "Diese Person ist bereits Mitglied" };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const guestUntil =
    parsed.data.role === "GUEST" && parsed.data.guestUntil
      ? new Date(parsed.data.guestUntil)
      : null;

  await prisma.invitation.create({
    data: {
      bandId,
      email,
      role: parsed.data.role as Role,
      guestUntil,
      expiresAt,
      invitedById: user.id,
    },
  });

  revalidatePath(`/bands/${bandId}/members`);
  return { success: "Einladung erstellt" };
}

export async function revokeInvitationAction(bandId: string, invitationId: string) {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) return;

  await prisma.invitation.delete({
    where: { id: invitationId, bandId },
  });
  revalidatePath(`/bands/${bandId}/members`);
}

export async function updateRoleAction(
  bandId: string,
  membershipId: string,
  role: Role
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Keine Berechtigung" };
  }

  const target = await prisma.membership.findUnique({
    where: { id: membershipId, bandId },
  });
  if (!target) return { error: "Mitglied nicht gefunden" };

  if (target.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await prisma.membership.count({
      where: { bandId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return {
        error:
          "Die Band braucht mindestens eine:n Administrator:in. Ernenne zuerst eine andere Person zum Admin.",
      };
    }
  }

  await prisma.membership.update({
    where: { id: membershipId, bandId },
    data: { role, guestUntil: role === "GUEST" ? target.guestUntil : null },
  });
  revalidatePath(`/bands/${bandId}/members`);
}

export async function updateGuestAccessAction(
  bandId: string,
  membershipId: string,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Keine Berechtigung" };
  }

  const target = await prisma.membership.findUnique({
    where: { id: membershipId, bandId },
  });
  if (!target) return { error: "Mitglied nicht gefunden" };
  if (target.role !== "GUEST") {
    return { error: "Zugriffsbeschränkung gilt nur für Gäste" };
  }

  const parsed = guestAccessSchema.safeParse({
    guestUntil: formData.get("guestUntil") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  await prisma.membership.update({
    where: { id: membershipId, bandId },
    data: { guestUntil: parsed.data.guestUntil ? new Date(parsed.data.guestUntil) : null },
  });
  revalidatePath(`/bands/${bandId}/members`);
  return { success: "Zugriffszeitraum gespeichert" };
}

export async function removeMemberAction(
  bandId: string,
  membershipId: string
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Keine Berechtigung" };
  }
  if (membership.id === membershipId) {
    return { error: "Du kannst dich nicht selbst entfernen" };
  }

  const target = await prisma.membership.findUnique({
    where: { id: membershipId, bandId },
  });
  if (!target) return { error: "Mitglied nicht gefunden" };

  if (target.role === "ADMIN") {
    const adminCount = await prisma.membership.count({
      where: { bandId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return {
        error:
          "Die Band braucht mindestens eine:n Administrator:in und kann nicht entfernt werden.",
      };
    }
  }

  const band = await prisma.band.findUnique({ where: { id: bandId }, select: { financeEnabled: true } });
  if (band?.financeEnabled) {
    const isTargetFinanceAdmin = await prisma.bandFinanceAdmin.findUnique({
      where: { bandId_userId: { bandId, userId: target.userId } },
    });
    if (isTargetFinanceAdmin) {
      const financeAdminCount = await prisma.bandFinanceAdmin.count({ where: { bandId } });
      if (financeAdminCount <= 1) {
        return {
          error:
            "Die Band braucht mindestens eine:n Finanzadmin:in, solange das Finanzmodul aktiviert ist. Weise die Rolle zuerst jemand anderem zu.",
        };
      }
    }
  }

  await prisma.$transaction([
    prisma.bandFinanceAdmin.deleteMany({ where: { bandId, userId: target.userId } }),
    prisma.membership.delete({ where: { id: membershipId, bandId } }),
  ]);
  revalidatePath(`/bands/${bandId}/members`);
}

/**
 * Vergibt ein neues initiales Passwort fuer ein Mitglied (z. B. wenn jemand sein
 * Passwort vergessen hat - es gibt noch keinen Self-Service-Reset, siehe
 * requireActiveUser()). Das Klartext-Passwort wird nur in dieser Antwort
 * zurueckgegeben, nirgends gespeichert, und muss von der Person beim naechsten
 * Login geaendert werden (mustChangePassword).
 */
export async function resetMemberPasswordAction(
  bandId: string,
  membershipId: string
): Promise<PasswordResetState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Keine Berechtigung" };
  }

  const target = await prisma.membership.findUnique({
    where: { id: membershipId, bandId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!target) return { error: "Mitglied nicht gefunden" };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: target.userId },
    data: { passwordHash, mustChangePassword: true },
  });

  return {
    success: `Neues Passwort für ${target.user.name} gesetzt.`,
    tempPassword,
  };
}

export async function updateBandProfileAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Nur Administrator:innen können das Bandprofil bearbeiten" };
  }

  const parsed = bandProfileSchema.safeParse({
    name: formData.get("name"),
    genre: formData.get("genre") || undefined,
    bio: formData.get("bio") || undefined,
    location: formData.get("location") || undefined,
    contactEmail: formData.get("contactEmail") || "",
    websiteUrl: formData.get("websiteUrl") || "",
    instagramUrl: formData.get("instagramUrl") || "",
    facebookUrl: formData.get("facebookUrl") || "",
    spotifyUrl: formData.get("spotifyUrl") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }
  const d = parsed.data;

  await prisma.band.update({
    where: { id: bandId },
    data: {
      name: d.name.trim(),
      genre: d.genre || null,
      bio: d.bio || null,
      location: d.location || null,
      contactEmail: d.contactEmail || null,
      websiteUrl: d.websiteUrl || null,
      instagramUrl: d.instagramUrl || null,
      facebookUrl: d.facebookUrl || null,
      spotifyUrl: d.spotifyUrl || null,
    },
  });

  revalidatePath(`/bands/${bandId}`, "layout");
  return { success: "Bandprofil gespeichert" };
}

export async function updateBandImageAction(
  bandId: string,
  _prevState: ImageFormState,
  formData: FormData
): Promise<ImageFormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Nur Administrator:innen können das Bandbild ändern" };
  }

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) {
    return { error: "Bitte ein Bild auswählen" };
  }

  const result = await saveUploadedImage(file, "bands");
  if ("error" in result) return { error: result.error };

  const previous = await prisma.band.findUnique({
    where: { id: bandId },
    select: { imageUrl: true },
  });

  await prisma.band.update({
    where: { id: bandId },
    data: { imageUrl: result.url },
  });
  await deleteUploadedFile(previous?.imageUrl);

  revalidatePath(`/bands/${bandId}`, "layout");
  return { success: true };
}

export async function removeBandImageAction(bandId: string) {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) return;

  const previous = await prisma.band.findUnique({
    where: { id: bandId },
    select: { imageUrl: true },
  });

  await prisma.band.update({
    where: { id: bandId },
    data: { imageUrl: null },
  });
  await deleteUploadedFile(previous?.imageUrl);

  revalidatePath(`/bands/${bandId}`, "layout");
}
