/** Baut eine absolute URL zu einem App-Pfad, z. B. fuer Links in E-Mails. */
export function appUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
