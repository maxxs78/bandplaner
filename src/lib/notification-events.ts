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

export const notificationEventLabels: Record<NotificationEvent, string> = {
  NEW_EVENT: "Neuer Termin",
  EVENT_CHANGE: "Termin geändert oder abgesagt",
  SONG_PROPOSAL: "Neuer Songvorschlag",
  NEW_FILE: "Neue Datei",
  FINANCE_ALLOCATION: "Meine Gagen und Kostenanteile",
};

export const notificationEventDescriptions: Record<NotificationEvent, string> = {
  NEW_EVENT: "Wenn ein neuer Termin für diese Band angelegt wird.",
  EVENT_CHANGE: "Wenn sich Datum, Zeit oder Ort eines Termins ändern oder er gelöscht wird.",
  SONG_PROPOSAL: "Wenn jemand einen Song zur Abstimmung vorschlägt.",
  NEW_FILE: "Wenn eine Datei für die Band hochgeladen wird.",
  FINANCE_ALLOCATION: "Wenn dir ein Betrag zugeordnet wird oder eine Bestätigung aussteht.",
};
