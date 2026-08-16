import type { Prisma } from "@/generated/prisma/client";

/**
 * Bedingung, unter der ein Equipment-Eintrag in einer bestimmten Band nutzbar ist:
 * entweder Band-Equipment dieser Band, oder persönliches Equipment einer Person,
 * die aktuell Mitglied dieser Band ist. Zentrale Stelle, damit die Regel überall
 * (Kataloge, Packlisten, Datei-Verknüpfung) gleich ausgewertet wird.
 */
export function equipmentVisibleInBand(bandId: string): Prisma.EquipmentWhereInput {
  return {
    OR: [{ ownerBandId: bandId }, { ownerUser: { memberships: { some: { bandId } } } }],
  };
}
