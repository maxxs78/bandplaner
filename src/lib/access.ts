import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Membership, Role } from "@/generated/prisma/client";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

/**
 * Wie requireUser(), erzwingt aber zusaetzlich eine ausstehende Passwortaenderung
 * (siehe User.mustChangePassword, z. B. nach einem Admin-Reset) - schickt die
 * Person auf /profile, bevor sie sonst irgendetwas in der App tun kann. Wird
 * bewusst nicht in requireUser() selbst oder im (app)-Layout geprueft, damit
 * /profile weiterhin erreichbar bleibt, ohne eine Redirect-Schleife zu bauen.
 */
export async function requireActiveUser() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { mustChangePassword: true },
  });
  if (dbUser.mustChangePassword) {
    redirect("/profile?passwordReset=1");
  }
  return user;
}

export function isGuestAccessExpired(membership: Pick<Membership, "role" | "guestUntil">) {
  return (
    membership.role === "GUEST" &&
    membership.guestUntil !== null &&
    membership.guestUntil < new Date()
  );
}

export async function requireMembership(bandId: string) {
  const user = await requireActiveUser();
  const [membership, financeAdmin] = await Promise.all([
    prisma.membership.findUnique({
      where: { userId_bandId: { userId: user.id, bandId } },
      include: { band: true },
    }),
    prisma.bandFinanceAdmin.findUnique({
      where: { bandId_userId: { bandId, userId: user.id } },
      select: { id: true },
    }),
  ]);
  if (!membership) {
    redirect("/dashboard");
  }
  if (isGuestAccessExpired(membership)) {
    redirect("/dashboard?accessExpired=1");
  }
  return { user, membership, isFinanceAdmin: financeAdmin !== null };
}

const ROLE_RANK: Record<Role, number> = {
  GUEST: 0,
  MEMBER: 1,
  ADMIN: 2,
};

export function canManageBand(role: Role) {
  return role === "ADMIN";
}

/**
 * Finanzberechtigt (siehe BandFinanceAdmin) - bewusst losgelöst von Role, damit
 * dieselbe Person gleichzeitig Admin und Finanzadmin sein kann und mehrere
 * Personen gleichzeitig finanzberechtigt sein können. Nur diese Personen sehen
 * die vollständige Finanzübersicht der Band; alle anderen (auch normale Admins)
 * sehen ausschließlich ihre eigenen Gagen.
 */
export function canManageFinance(isFinanceAdmin: boolean) {
  return isFinanceAdmin;
}

/**
 * "Admin-Rechte ohne Governance": Finanzadmins dürfen wie echte Admins Inhalte
 * verwalten/überschreiben (Songs, Equipment, Dateien, Termine), aber keine
 * Mitgliederrollen ändern, niemanden entfernen oder Funktions-Schalter setzen -
 * das bleibt canManageBand (echten Admins) vorbehalten.
 */
export function canManageBandContent(role: Role, isFinanceAdmin: boolean) {
  return canManageBand(role) || isFinanceAdmin;
}

/** Termine, Songs und Setlisten anlegen/bearbeiten/löschen — Gäste sind ausgeschlossen. */
export function canManageContent(role: Role) {
  return role !== "GUEST";
}

export function hasAtLeastRole(role: Role, minimum: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
