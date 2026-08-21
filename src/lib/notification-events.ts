/**
 * Reine Konstanten ohne Server-Abhaengigkeiten - bewusst getrennt von
 * notifications.ts (das Prisma und den Mailversand zieht), damit auch
 * Client-Komponenten die Labels nutzen koennen.
 *
 * Der Wert ist zugleich der Name des Schalter-Feldes auf Membership, so
 * bleiben Einstellungen und Versand synchron.
 */
export const notificationEvents = {
  NEW_EVENT: "notifyOnNewEvent",
  EVENT_CHANGE: "notifyOnEventChange",
  SONG_PROPOSAL: "notifyOnSongProposal",
  NEW_FILE: "notifyOnNewFile",
  FINANCE_ALLOCATION: "notifyOnFinanceAllocation",
} as const;

export type NotificationEvent = keyof typeof notificationEvents;

export function getNotificationEventLabels(
  t: (key: string) => string
): Record<NotificationEvent, string> {
  return Object.fromEntries(
    (Object.keys(notificationEvents) as NotificationEvent[]).map((event) => [
      event,
      t(`events.${event}.label`),
    ])
  ) as Record<NotificationEvent, string>;
}

export function getNotificationEventDescriptions(
  t: (key: string) => string
): Record<NotificationEvent, string> {
  return Object.fromEntries(
    (Object.keys(notificationEvents) as NotificationEvent[]).map((event) => [
      event,
      t(`events.${event}.description`),
    ])
  ) as Record<NotificationEvent, string>;
}
