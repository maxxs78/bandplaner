import { prisma } from "@/lib/prisma";

/**
 * Offene Selbstregistrierung unter `/register` (ohne Einladung). Betreiber
 * schalten sie mit `REGISTRATION_ENABLED=true` frei. Standard ist geschlossen:
 * Dann koennen nur das allererste Konto (Erstinbetriebnahme) sowie Personen
 * mit einer offenen Einladung ein Konto anlegen - neue Mitglieder kommen sonst
 * ausschliesslich ueber einen Einladungslink einer Band-Administration dazu.
 */
export function isOpenRegistrationEnabled(): boolean {
  return process.env.REGISTRATION_ENABLED?.toLowerCase() === "true";
}

/** true, solange ueberhaupt noch kein Konto existiert (Erstinbetriebnahme). */
export async function isFirstAccount(): Promise<boolean> {
  return (await prisma.user.count()) === 0;
}

/**
 * Darf fuer `email` gerade ein Konto angelegt werden? `email` muss bereits
 * normalisiert sein (lowercase, getrimmt) - genau so wird sie auch bei
 * Einladungen und Konten gespeichert.
 */
export async function canRegister(email: string): Promise<boolean> {
  if (isOpenRegistrationEnabled()) return true;
  if (await isFirstAccount()) return true;

  const invitation = await prisma.invitation.findFirst({
    where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return invitation !== null;
}
