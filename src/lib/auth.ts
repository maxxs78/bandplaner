import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Nach so vielen fehlgeschlagenen Versuchen in Folge wird das Konto gesperrt.
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
// Sperrdauer - danach ist ohne weiteres Zutun (kein Hintergrundjob) wieder
// ein Loginversuch moeglich, da lockedUntil einfach in der Vergangenheit liegt.
const LOCKOUT_DURATION_MS = 2 * 24 * 60 * 60 * 1000;

/** Eigener Fehlertyp, damit die Login-Seite eine klare Meldung statt der generischen "falsches Passwort" zeigen kann. */
export class AccountLockedError extends CredentialsSignin {
  static type = "AccountLockedError";
  code = "account_locked";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Fest im Code statt nur per AUTH_TRUST_HOST-Umgebungsvariable, da sich
  // Umgebungsvariablen-Änderungen in Container Manager (Synology) ohne
  // vollständigen Image-Rebuild als unzuverlässig erwiesen haben. Ohne dies
  // lehnt NextAuth im Produktionsmodus (NODE_ENV=production) Requests unter
  // vom localhost abweichenden Hostnamen mit "UntrustedHost" ab.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const identifier = (credentials?.email as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;
        if (!identifier || !password) return null;

        // Login-Feld erlaubt wahlweise E-Mail oder Benutzername (Name ist nicht
        // eindeutig - bei mehreren Treffern lehnen wir ab statt eine Person zu
        // erraten, statt z.B. den erstbesten Treffer zu nehmen).
        let user;
        if (identifier.includes("@")) {
          user = await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } });
        } else {
          const matches = await prisma.user.findMany({ where: { name: identifier } });
          user = matches.length === 1 ? matches[0] : null;
        }
        if (!user) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new AccountLockedError();
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          const lockedOut = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: lockedOut ? 0 : attempts,
              lockedUntil: lockedOut ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
            },
          });
          if (lockedOut) throw new AccountLockedError();
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
