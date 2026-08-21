import { z } from "zod";

export function getRegisterSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("nameTooShort")),
    email: z.string().email(t("invalidEmail")),
    password: z.string().min(8, t("passwordTooShort")),
  });
}

export function getChangePasswordSchema(t: (key: string) => string) {
  return z.object({
    currentPassword: z.string().min(1, t("currentPasswordRequired")),
    newPassword: z.string().min(8, t("newPasswordTooShort")),
    confirmPassword: z.string().min(1, t("confirmPasswordRequired")),
  });
}

/**
 * Generische, modulübergreifend geteilte Meldungen (Namespace "validation" in
 * den messages/*.json) - siehe getSongSchema() als Beispiel für die Verwendung.
 */
export function getBandCreateSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("bandNameTooShort")),
  });
}

export function getBandProfileSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("bandNameTooShort")),
    genre: z.string().optional(),
    bio: z.string().optional(),
    location: z.string().optional(),
    contactEmail: z.string().email(t("invalidEmail")).optional().or(z.literal("")),
    websiteUrl: z.string().url(t("invalidUrl")).optional().or(z.literal("")),
    instagramUrl: z.string().url(t("invalidUrl")).optional().or(z.literal("")),
    facebookUrl: z.string().url(t("invalidUrl")).optional().or(z.literal("")),
    spotifyUrl: z.string().url(t("invalidUrl")).optional().or(z.literal("")),
  });
}

export function getInviteSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("invalidEmail")),
    role: z.enum(["ADMIN", "FINANCE_ADMIN", "MEMBER", "GUEST"]),
    guestUntil: z.string().optional(),
  });
}

export const guestAccessSchema = z.object({
  guestUntil: z.string().optional(),
});

export function getEventSchema(t: (key: string) => string) {
  return z
    .object({
      title: z.string().min(2, t("titleRequired")),
      type: z.enum(["REHEARSAL", "GIG", "MEETING", "OTHER"]),
      startsAt: z.string().min(1, t("startTimeRequired")),
      endsAt: z.string().min(1, t("endTimeRequired")),
      location: z.string().optional(),
      description: z.string().optional(),
      repeatWeekly: z.boolean().optional(),
      repeatUntil: z.string().optional(),
    })
    .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
      message: t("endAfterStart"),
      path: ["endsAt"],
    });
}

export function getAbsenceSchema(t: (key: string) => string) {
  return z
    .object({
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      reason: z.string().optional(),
    })
    .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
      message: t("endNotBeforeStart"),
      path: ["endDate"],
    });
}

export function getSongSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t("titleRequired")),
    key: z.string().optional(),
    bpm: z.coerce.number().int().positive().optional().or(z.literal("")),
    timeSignature: z.string().optional(),
    durationSec: z.coerce.number().int().positive().optional().or(z.literal("")),
    genre: z.string().optional(),
    artist: z.string().optional(),
    album: z.string().optional(),
    releaseYear: z.coerce.number().int().min(1000).max(9999).optional().or(z.literal("")),
    status: z.enum(["PROPOSED", "NEW", "IN_PROGRESS", "STAGE_READY", "ACTIVE", "ARCHIVED"]),
    lyrics: z.string().optional(),
    remarks: z.string().optional(),
  });
}

export function getSongLinkSchema(t: (key: string) => string) {
  return z.object({
    url: z.string().url(t("invalidUrl")),
    label: z.string().optional(),
  });
}

export function getSongVoteSchema(t: (key: string) => string) {
  return z.object({
    vote: z.enum(["UP", "DOWN"]),
    comment: z.string().max(280, t("commentTooLong")).optional(),
  });
}

export function getSetlistSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t("nameRequired")),
    eventId: z.string().optional(),
  });
}

export function getEquipmentSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t("nameRequired")),
    description: z.string().optional(),
    location: z.string().optional(),
    ownerId: z.string().optional(),
    responsibleId: z.string().optional(),
    category: z.enum([
      "INSTRUMENTS",
      "INSTRUMENT_ACCESSORIES",
      "AMPS_PEDALBOARD",
      "STAGE_EQUIPMENT",
      "PA",
      "MONITORING",
      "PERSONAL",
      "OTHER",
    ]),
  });
}

export function getPacklistSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t("nameRequired")),
    eventId: z.string().optional(),
  });
}
