import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { isGuestAccessExpired } from "@/lib/access";
import { getEnabledFeatures } from "@/lib/features";
import { notificationEvents, type NotificationEvent } from "@/lib/notification-events";

export { notificationEvents };
export type { NotificationEvent };

function appUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

/**
 * Gemeinsamer Versandweg fuer alle Benachrichtigungen. Prueft zentral, ob das
 * Kommunikationsmodul der Band ueberhaupt aktiv ist - damit kann keine
 * Aufrufstelle das versehentlich umgehen. Empfaenger sind nur Mitglieder mit
 * passendem Schalter; Gaeste mit abgelaufenem Zugriff und die ausloesende
 * Person selbst fallen raus. Fehler werden geschluckt: eine fehlgeschlagene
 * Benachrichtigung darf die ausloesende Aktion nie abbrechen.
 */
async function dispatch(options: {
  bandId: string;
  event: NotificationEvent;
  userIds?: string[];
  excludeUserId?: string;
  subject: string;
  body: string;
  path?: string;
}) {
  try {
    const band = await prisma.band.findUnique({
      where: { id: options.bandId },
      select: {
        name: true,
        equipmentEnabled: true,
        packlistsEnabled: true,
        financeEnabled: true,
        communicationEnabled: true,
        mediaPlayerEnabled: true,
        keyDetectionEnabled: true,
      },
    });
    if (!band || !getEnabledFeatures(band).communication) return;

    const memberships = await prisma.membership.findMany({
      where: {
        bandId: options.bandId,
        [notificationEvents[options.event]]: true,
        ...(options.userIds ? { userId: { in: options.userIds } } : {}),
        ...(options.excludeUserId ? { userId: { not: options.excludeUserId } } : {}),
      },
      include: { user: { select: { email: true } } },
    });

    const recipients = memberships
      .filter((m) => !isGuestAccessExpired(m))
      .map((m) => m.user.email);
    if (recipients.length === 0) return;

    const link = options.path ? `\n\n${appUrl(options.path)}` : "";
    await sendMail({
      to: recipients,
      subject: `[${band.name}] ${options.subject}`,
      text: `${options.body}${link}\n\nDu kannst diese Benachrichtigungen in deinem Profil abschalten:\n${appUrl("/profile")}\n`,
    });
  } catch (error) {
    console.error("[notifications] Versand fehlgeschlagen:", error);
  }
}

/** Benachrichtigt alle passend eingestellten Mitglieder der Band. */
export async function notifyBand(options: {
  bandId: string;
  event: NotificationEvent;
  excludeUserId?: string;
  subject: string;
  body: string;
  path?: string;
}) {
  await dispatch(options);
}

/** Wie notifyBand, aber gezielt an einzelne Personen (z. B. eigene Gagen). */
export async function notifyUsers(options: {
  bandId: string;
  userIds: string[];
  event: NotificationEvent;
  excludeUserId?: string;
  subject: string;
  body: string;
  path?: string;
}) {
  if (options.userIds.length === 0) return;
  await dispatch(options);
}
