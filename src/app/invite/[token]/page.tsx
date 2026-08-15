import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acceptInvitationAction } from "./actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrator",
  FINANCE_ADMIN: "Finanz-Administrator",
  MEMBER: "Mitglied",
  GUEST: "Gast",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { band: true },
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm text-center">
        {!invitation || invitation.acceptedAt || invitation.expiresAt < new Date() ? (
          <>
            <h1 className="text-lg font-semibold text-foreground">
              Einladung nicht gültig
            </h1>
            <p className="mt-2 text-sm text-muted">
              Diese Einladung wurde bereits verwendet, zurückgezogen oder ist abgelaufen.
            </p>
          </>
        ) : invitation.email.toLowerCase() !== session.user.email?.toLowerCase() ? (
          <>
            <h1 className="text-lg font-semibold text-foreground">
              Falsches Konto angemeldet
            </h1>
            <p className="mt-2 text-sm text-muted">
              Diese Einladung wurde an {invitation.email} gesendet. Bitte melde dich mit
              diesem Konto an.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-foreground">
              Einladung zu &bdquo;{invitation.band.name}&ldquo;
            </h1>
            <p className="mt-2 text-sm text-muted">
              Du wurdest als {roleLabels[invitation.role]} eingeladen.
            </p>
            <form action={acceptInvitationAction.bind(null, token)} className="mt-6">
              <Button type="submit" className="w-full">
                <Check className="h-4 w-4" />
                Einladung annehmen
              </Button>
            </form>
          </>
        )}
      </Card>
    </main>
  );
}
