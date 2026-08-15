"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { saveUploadedImage, deleteUploadedFile } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import type { ImageFormState } from "@/components/image-upload-form";

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
