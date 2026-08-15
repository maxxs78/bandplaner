import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { ImageUploadForm } from "@/components/image-upload-form";
import { updateAvatarAction, removeAvatarAction } from "./actions";

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-foreground">Mein Profil</h1>
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
    </div>
  );
}
