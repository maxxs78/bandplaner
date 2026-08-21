import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("profile.page");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>

      {(passwordReset || user.mustChangePassword) && (
        <Card className="mt-4 border-warning/40 bg-warning/10 text-sm text-foreground">
          {t("passwordResetNotice")}
        </Card>
      )}

      <Card className="mt-4">
        <p className="mb-4 text-sm text-muted">{t("avatarLabel")}</p>
        <ImageUploadForm
          action={updateAvatarAction}
          removeAction={removeAvatarAction}
          currentSrc={user.avatarUrl}
          name={user.name}
        />
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-muted">{t("name")}</dt>
            <dd className="text-foreground">{user.name}</dd>
          </div>
          <div>
            <dt className="text-muted">{t("email")}</dt>
            <dd className="text-foreground">{user.email}</dd>
          </div>
        </dl>
      </Card>

      {memberships.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">{t("notificationsTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("notificationsHint")}</p>
          {!mailConfigured && (
            <Card className="mt-4 border-warning/40 bg-warning/10 text-sm text-foreground">
              {t("mailNotConfigured")}
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
        <h2 className="text-lg font-semibold text-foreground">{t("changePasswordTitle")}</h2>
        <Card className="mt-4">
          <ChangePasswordForm action={changePasswordAction} />
        </Card>
      </div>
    </div>
  );
}
