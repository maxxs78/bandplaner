import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { isMailConfigured } from "@/lib/mail";
import { Card } from "@/components/ui/card";
import { ImageUploadForm } from "@/components/image-upload-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { NotificationPreferencesForm } from "@/components/notification-preferences-form";
import {
  updateAvatarAction,
  removeAvatarAction,
  changePasswordAction,
  updateNotificationPreferencesAction,
} from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ passwordReset?: string }>;
}) {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  const { passwordReset } = await searchParams;

  // Nur Bands mit aktivem Kommunikationsmodul - die gespeicherten Einstellungen
  // bleiben beim Abschalten erhalten und tauchen wieder auf, sobald es wieder an ist.
  const memberships = await prisma.membership.findMany({
    where: { userId: sessionUser.id, band: { communicationEnabled: true } },
    include: { band: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const mailConfigured = isMailConfigured();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-foreground">Mein Profil</h1>

      {(passwordReset || user.mustChangePassword) && (
        <Card className="mt-4 border-warning/40 bg-warning/10 text-sm text-foreground">
          Dein Passwort wurde von einer Administratorperson zurückgesetzt. Bitte lege unten ein
          neues Passwort fest, bevor du die App weiter nutzt.
        </Card>
      )}

      <Card className="mt-4">
        <p className="mb-4 text-sm text-muted">Profilbild</p>
        <ImageUploadForm
          action={updateAvatarAction}
          removeAction={removeAvatarAction}
          currentSrc={user.avatarUrl}
          name={user.name}
        />
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-muted">Name</dt>
            <dd className="text-foreground">{user.name}</dd>
          </div>
          <div>
            <dt className="text-muted">E-Mail</dt>
            <dd className="text-foreground">{user.email}</dd>
          </div>
        </dl>
      </Card>

      {memberships.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">E-Mail-Benachrichtigungen</h2>
          <p className="mt-1 text-sm text-muted">
            Lege je Band fest, worüber du per E-Mail informiert werden möchtest.
          </p>
          {!mailConfigured && (
            <Card className="mt-4 border-warning/40 bg-warning/10 text-sm text-foreground">
              Für diese Installation ist noch kein Mailversand eingerichtet. Deine Einstellungen
              werden gespeichert, es werden aber noch keine E-Mails verschickt.
            </Card>
          )}
          {memberships.map((m) => (
            <div key={m.id} className="mt-4">
              <p className="mb-2 text-sm font-medium text-foreground">{m.band.name}</p>
              <Card>
                <NotificationPreferencesForm
                  action={updateNotificationPreferencesAction.bind(null, m.bandId)}
                  initialValues={{
                    notifyOnNewEvent: m.notifyOnNewEvent,
                    notifyOnEventChange: m.notifyOnEventChange,
                    notifyOnSongProposal: m.notifyOnSongProposal,
                    notifyOnNewFile: m.notifyOnNewFile,
                    notifyOnFinanceAllocation: m.notifyOnFinanceAllocation,
                  }}
                />
              </Card>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Passwort ändern</h2>
        <Card className="mt-4">
          <ChangePasswordForm action={changePasswordAction} />
        </Card>
      </div>
    </div>
  );
}
