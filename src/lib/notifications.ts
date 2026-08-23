import { getTranslations, getFormatter } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { isGuestAccessExpired } from "@/lib/access";
import { getEnabledFeatures } from "@/lib/features";
import { notificationEvents, type NotificationEvent } from "@/lib/notification-events";
import { isLocale, defaultLocale } from "@/i18n/config";
import { appUrl } from "@/lib/app-url";

export { notificationEvents };
export type { NotificationEvent };

type MessageBuilder = (
  t: Awaited<ReturnType<typeof getTranslations>>,
  format: Awaited<ReturnType<typeof getFormatter>>
) => { subject: string; body: string };

/**
 * Gemeinsamer Versandweg fuer alle Benachrichtigungen. Prueft zentral, ob das
 * Kommunikationsmodul der Band ueberhaupt aktiv ist - damit kann keine
 * Aufrufstelle das versehentlich umgehen. Empfaenger sind nur Mitglieder mit
 * passendem Schalter; Gaeste mit abgelaufenem Zugriff und die ausloesende
 * Person selbst fallen raus. Betreff/Text werden je Empfaenger-Sprache neu
 * gerendert (gruppiert nach Sprache, damit nicht pro Person einzeln versendet
 * werden muss). Fehler werden geschluckt: eine fehlgeschlagene Benachrichtigung
 * darf die ausloesende Aktion nie abbrechen.
 */
async function dispatch(options: {
  bandId: string;
  event: NotificationEvent;
  userIds?: string[];
  excludeUserId?: string;
  namespace: string;
  buildMessage: MessageBuilder;
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
        locationsEnabled: true,
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
      include: { user: { select: { email: true, locale: true } } },
    });

    const recipients = memberships.filter((m) => !isGuestAccessExpired(m));
    if (recipients.length === 0) return;

    const emailsByLocale = new Map<string, string[]>();
    for (const m of recipients) {
      const locale = isLocale(m.user.locale) ? m.user.locale : defaultLocale;
      const list = emailsByLocale.get(locale) ?? [];
      list.push(m.user.email);
      emailsByLocale.set(locale, list);
    }

    const link = options.path ? `\n\n${appUrl(options.path)}` : "";

    await Promise.all(
      Array.from(emailsByLocale.entries()).map(async ([locale, emails]) => {
        const [t, format, tCommon] = await Promise.all([
          getTranslations({ locale, namespace: options.namespace }),
          getFormatter({ locale }),
          getTranslations({ locale, namespace: "notifications" }),
        ]);
        const { subject, body } = options.buildMessage(t, format);
        await sendMail({
          to: emails,
          subject: `[${band.name}] ${subject}`,
          text: `${body}${link}\n\n${tCommon("unsubscribeHint")}\n${appUrl("/profile")}\n`,
        });
      })
    );
  } catch (error) {
    console.error("[notifications] Versand fehlgeschlagen:", error);
  }
}

/** Benachrichtigt alle passend eingestellten Mitglieder der Band. */
export async function notifyBand(options: {
  bandId: string;
  event: NotificationEvent;
  excludeUserId?: string;
  namespace: string;
  buildMessage: MessageBuilder;
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
  namespace: string;
  buildMessage: MessageBuilder;
  path?: string;
}) {
  if (options.userIds.length === 0) return;
  await dispatch(options);
}
