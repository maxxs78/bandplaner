"use server";

import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { signOut } from "@/lib/auth";
import { saveUploadedImage, deleteUploadedFile } from "@/lib/uploads";
import { getChangePasswordSchema, getDeleteAccountSchema } from "@/lib/validation";
import { notificationEvents, type NotificationEvent } from "@/lib/notification-events";
import { revalidatePath } from "next/cache";
import type { ImageFormState } from "@/components/image-upload-form";

export type PasswordFormState = { error?: string; success?: string } | undefined;
export type NotificationFormState = { error?: string; success?: string } | undefined;
export type DeleteAccountState = { error?: string } | undefined;

export async function updateNotificationPreferencesAction(
  bandId: string,
  _prevState: NotificationFormState,
  formData: FormData
): Promise<NotificationFormState> {
  const user = await requireUser();

  const t = await getTranslations("profile.notificationPreferences");
  const membership = await prisma.membership.findUnique({
    where: { userId_bandId: { userId: user.id, bandId } },
    select: { id: true, band: { select: { communicationEnabled: true } } },
  });
  if (!membership) return { error: t("noMembership") };
  if (!membership.band.communicationEnabled) {
    return { error: t("disabled") };
  }

  const data = Object.fromEntries(
    (Object.keys(notificationEvents) as NotificationEvent[]).map((event) => [
      notificationEvents[event],
      formData.get(notificationEvents[event]) === "on",
    ])
  );

  await prisma.membership.update({ where: { id: membership.id }, data });

  revalidatePath("/profile");
  return { success: t("saved") };
}

export async function changePasswordAction(
  _prevState: PasswordFormState,
  formData: FormData
): Promise<PasswordFormState> {
  const sessionUser = await requireUser();
  const t = await getTranslations("profile.changePassword");

  const parsed = getChangePasswordSchema(t).safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }
  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return { error: t("mismatch") };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { error: t("currentPasswordWrong") };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null },
  });

  revalidatePath("/", "layout");
  return { success: t("success") };
}

export async function updateAvatarAction(
  _prevState: ImageFormState,
  formData: FormData
): Promise<ImageFormState> {
  const user = await requireUser();

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) {
    const t = await getTranslations("imageUpload");
    return { error: t("imageRequired") };
  }

  const result = await saveUploadedImage(file, "avatars");
  if ("error" in result) return { error: result.error };

  const previous = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: result.url },
  });
  await deleteUploadedFile(previous?.avatarUrl);

  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeAvatarAction() {
  const user = await requireUser();

  const previous = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: null },
  });
  await deleteUploadedFile(previous?.avatarUrl);

  revalidatePath("/", "layout");
}

/**
 * Endgueltige Selbstloeschung des Kontos (DSGVO Art. 17). Persoenliche Inhalte
 * (Notizen, Buehnen-Hinweise, Verfuegbarkeiten/Abwesenheiten, Abstimmungen,
 * eigenes Equipment, Mitgliedschaften) werden per Cascade mitgeloescht.
 * Bandweit geteilte Objekte, an denen die Person nur als Ersteller:in/
 * Hochladende beteiligt war (Termine, Songvorschlaege, Finanzeintraege,
 * hochgeladene Dateien, versendete Einladungen), bleiben dagegen erhalten -
 * die entsprechende User-Referenz wird stattdessen per SetNull entfernt
 * (siehe schema.prisma), damit diese Objekte fuer die Band nutzbar bleiben,
 * aber ohne jeden Hinweis auf die geloeschte Person.
 */
export async function deleteAccountAction(
  _prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const sessionUser = await requireUser();
  const t = await getTranslations("profile.deleteAccount");

  const parsed = getDeleteAccountSchema(t).safeParse({
    password: formData.get("password"),
    confirmEmail: formData.get("confirmEmail"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });

  if (parsed.data.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { error: t("emailMismatch") };
  }

  const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!validPassword) {
    return { error: t("wrongPassword") };
  }

  // Blockiert die Loeschung, wenn die Person in irgendeiner Band die letzte
  // Administratorperson ist - sonst wuerde diese Band unverwaltbar (analog
  // zur Pruefung in removeMemberAction).
  const adminMemberships = await prisma.membership.findMany({
    where: { userId: user.id, role: "ADMIN" },
    select: { bandId: true, band: { select: { name: true } } },
  });
  const blockedBandNames: string[] = [];
  for (const m of adminMemberships) {
    const otherAdmins = await prisma.membership.count({
      where: { bandId: m.bandId, role: "ADMIN", userId: { not: user.id } },
    });
    if (otherAdmins === 0) blockedBandNames.push(m.band.name);
  }
  if (blockedBandNames.length > 0) {
    return { error: t("soleAdminBlocked", { bands: blockedBandNames.join(", ") }) };
  }

  await deleteUploadedFile(user.avatarUrl);
  await prisma.user.delete({ where: { id: user.id } });

  await signOut({ redirectTo: "/login?accountDeleted=1" });
}
