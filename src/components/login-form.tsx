"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-xl font-semibold text-foreground">Willkommen zurück</h1>
      <p className="mt-1 text-sm text-muted">Melde dich bei deinem Bandplaner-Konto an</p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div>
          <Label htmlFor="email">E-Mail oder Benutzername</Label>
          <Input id="email" name="email" type="text" autoComplete="username" required />
        </div>
        <div>
          <Label htmlFor="password">Passwort</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <FieldError>{state?.error}</FieldError>
        <Button type="submit" className="w-full" disabled={pending}>
          <LogIn className="h-4 w-4" />
          {pending ? "Wird angemeldet…" : "Anmelden"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Noch kein Konto?{" "}
        <Link
          href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-primary hover:underline"
        >
          Registrieren
        </Link>
      </p>
    </Card>
  );
}
