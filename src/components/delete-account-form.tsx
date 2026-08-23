"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteAccountAction, type DeleteAccountState } from "@/app/(app)/profile/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

/**
 * Zweistufige Bestaetigung fuer die unwiderrufliche Konto-Loeschung: der
 * eigentliche Button erscheint erst nach Klick auf "Konto loeschen" (Stufe 1),
 * und erfordert dann sowohl die getippte E-Mail-Adresse als auch das aktuelle
 * Passwort (Stufe 2) - server-seitig nochmals gegengeprueft, siehe
 * deleteAccountAction. Nach Erfolg meldet die Server Action selbst ab und
 * leitet weiter, daher kein eigener Erfolgs-Zustand hier noetig.
 */
export function DeleteAccountForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccountAction,
    undefined
  );
  const [confirming, setConfirming] = useState(false);
  const t = useTranslations("profile.deleteAccount");

  if (!confirming) {
    return (
      <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" />
        {t("startButton")}
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-danger/40 bg-danger/5 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
        <div className="text-sm text-foreground">
          <p className="font-semibold">{t("warningTitle")}</p>
          <p className="mt-1">{t("warningBody")}</p>
          <p className="mt-2 text-muted">{t("warningKept")}</p>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="confirmEmail">{t("confirmEmailLabel", { email })}</Label>
          <Input id="confirmEmail" name="confirmEmail" type="email" autoComplete="off" required />
        </div>
        <div>
          <Label htmlFor="deletePassword">{t("passwordLabel")}</Label>
          <Input id="deletePassword" name="password" type="password" autoComplete="current-password" required />
        </div>
        <FieldError>{state?.error}</FieldError>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="danger" disabled={pending}>
            <Trash2 className="h-4 w-4" />
            {pending ? t("submitting") : t("confirmButton")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
