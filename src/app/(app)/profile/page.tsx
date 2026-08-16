import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { ImageUploadForm } from "@/components/image-upload-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { updateAvatarAction, removeAvatarAction, changePasswordAction } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ passwordReset?: string }>;
}) {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  const { passwordReset } = await searchParams;

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

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Passwort ändern</h2>
        <Card className="mt-4">
          <ChangePasswordForm action={changePasswordAction} />
        </Card>
      </div>
    </div>
  );
}
