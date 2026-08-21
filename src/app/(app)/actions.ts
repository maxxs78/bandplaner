"use server";

import { signOut } from "@/lib/auth";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/i18n/config";
import { revalidatePath } from "next/cache";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

/** Speichert die Sprachwahl dauerhaft im Konto - wirkt kontobezogen ueber alle Geraete. */
export async function updateLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath("/", "layout");
}
