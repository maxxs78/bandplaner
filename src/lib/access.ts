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

export function isGuestAccessExpired(membership: Pick<Membership, "role" | "guestUntil">) {
  return (
    membership.role === "GUEST" &&
    membership.guestUntil !== null &&
    membership.guestUntil < new Date()
  );
}

export async function requireMembership(bandId: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { userId_bandId: { userId: user.id, bandId } },
    include: { band: true },
  });
  if (!membership) {
    redirect("/dashboard");
  }
  if (isGuestAccessExpired(membership)) {
    redirect("/dashboard?accessExpired=1");
  }
  return { user, membership };
}

const ROLE_RANK: Record<Role, number> = {
  GUEST: 0,
  MEMBER: 1,
  FINANCE_ADMIN: 2,
  ADMIN: 3,
};

export function canManageBand(role: Role) {
  return role === "ADMIN";
}

export function canManageFinance(role: Role) {
  return role === "ADMIN" || role === "FINANCE_ADMIN";
}

/** Termine, Songs und Setlisten anlegen/bearbeiten/löschen — Gäste sind ausgeschlossen. */
export function canManageContent(role: Role) {
  return role !== "GUEST";
}

export function hasAtLeastRole(role: Role, minimum: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
