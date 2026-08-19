import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/**
 * SMTP-Versand ist optional: Ohne konfigurierte Zugangsdaten laeuft die App
 * unveraendert weiter, Benachrichtigungen werden dann still uebersprungen
 * (siehe sendMail). So bleibt eine Installation ohne Mailserver nutzbar.
 */
function readConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM ?? user;
  if (!host || !from) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    host,
    port,
    // Port 465 ist implizites TLS, alles andere startet unverschluesselt und
    // wechselt per STARTTLS - explizit setzbar ueber SMTP_SECURE.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: user && pass ? { user, pass } : undefined,
    from,
  };
}

export function isMailConfigured() {
  return readConfig() !== null;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(config: NonNullable<ReturnType<typeof readConfig>>) {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }
  return cachedTransporter;
}

/**
 * Verschickt eine Mail, sofern SMTP konfiguriert ist. Wirft bewusst nicht:
 * ein fehlgeschlagener Versand darf die ausloesende Nutzeraktion (Termin
 * anlegen o. ae.) nie abbrechen. Rueckgabe sagt, ob versendet wurde.
 */
export async function sendMail(options: {
  to: string | string[];
  subject: string;
  text: string;
}): Promise<boolean> {
  const config = readConfig();
  if (!config) return false;

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  if (recipients.length === 0) return false;

  try {
    await getTransporter(config).sendMail({
      from: config.from,
      // Empfaenger bewusst als BCC: bei Rundmails an die Band sollen die
      // Adressen der anderen Mitglieder nicht offengelegt werden.
      bcc: recipients,
      subject: options.subject,
      text: options.text,
    });
    return true;
  } catch (error) {
    console.error("[mail] Versand fehlgeschlagen:", error);
    return false;
  }
}
