"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { saveUploadedImage, deleteUploadedFile } from "@/lib/uploads";
import { changePasswordSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import type { ImageFormState } from "@/components/image-upload-form";

export type PasswordFormState = { error?: string; success?: string } | undefined;

export async function changePasswordAction(
  _prevState: PasswordFormState,
  formData: FormData
): Promise<PasswordFormState> {
  const sessionUser = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }
  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return { error: "Die neuen Passwörter stimmen nicht überein" };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Aktuelles Passwort ist falsch" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  revalidatePath("/", "layout");
  return { success: "Passwort geändert." };
}

export async function updateAvatarAction(
  _prevState: ImageFormState,
  formData: FormData
): Promise<ImageFormState> {
  const user = await requireUser();

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) {
    return { error: "Bitte ein Bild auswählen" };
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
