import crypto from "crypto";

/** Gueltigkeitsdauer eines Reset-Links. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Mindestabstand zwischen zwei angeforderten Reset-Mails fuer dasselbe Konto,
 * um Missbrauch (Zuspammen eines fremden Postfachs) zu erschweren. */
export const RESET_REQUEST_COOLDOWN_MS = 2 * 60 * 1000;

/** Zufaelliger, im Mail-Link verschickter Klartext-Token. */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** SHA-256-Hash des Tokens fuer die Speicherung - siehe PasswordResetToken.tokenHash. */
export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
