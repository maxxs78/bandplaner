import { requireMembership, canManageBand } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { ImageUploadForm } from "@/components/image-upload-form";
import { BandProfileForm } from "@/components/band-profile-form";
import { InviteForm } from "@/components/invite-form";
import { MemberRowActions } from "@/components/member-row-actions";
import { RevokeInvitationButton } from "@/components/revoke-invitation-button";
import {
  updateBandImageAction,
  removeBandImageAction,
  updateBandProfileAction,
} from "./actions";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrator",
  FINANCE_ADMIN: "Finanz-Administrator",
  MEMBER: "Mitglied",
  GUEST: "Gast",
};

export default async function MembersPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { user, membership } = await requireMembership(bandId);
  const isAdmin = canManageBand(membership.role);

  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { bandId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    isAdmin
      ? prisma.invitation.findMany({
          where: { bandId, acceptedAt: null },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="space-y-8">
      {isAdmin && (
        <div>
          <h2 className="font-semibold text-foreground">Bandprofil</h2>
          <Card className="mt-3">
            <ImageUploadForm
              action={updateBandImageAction.bind(null, bandId)}
              removeAction={removeBandImageAction.bind(null, bandId)}
              currentSrc={membership.band.imageUrl}
              name={membership.band.name}
              size="lg"
            />
            <div className="mt-6 border-t border-border pt-4">
              <BandProfileForm
                action={updateBandProfileAction.bind(null, bandId)}
                defaultValues={membership.band}
              />
            </div>
          </Card>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-foreground">Mitglieder</h2>
        <div className="mt-3 space-y-2">
          {members.map((m) => (
            <Card key={m.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar src={m.user.avatarUrl} name={m.user.name} size="sm" />
                <div>
                  <p className="font-medium text-foreground">{m.user.name}</p>
                  <p className="text-sm text-muted">{m.user.email}</p>
                </div>
              </div>
              {isAdmin ? (
                <MemberRowActions
                  bandId={bandId}
                  membershipId={m.id}
                  role={m.role}
                  guestUntil={m.guestUntil ? m.guestUntil.toISOString() : null}
                  isSelf={m.userId === user.id}
                />
              ) : (
                <Badge variant="accent">
                  {roleLabels[m.role]}
                  {m.role === "GUEST" && m.guestUntil
                    ? ` · bis ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(m.guestUntil)}`
                    : ""}
                </Badge>
              )}
            </Card>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div>
          <h2 className="font-semibold text-foreground">Person einladen</h2>
          <Card className="mt-3">
            <InviteForm bandId={bandId} />
          </Card>
        </div>
      )}

      {isAdmin && invitations.length > 0 && (
        <div>
          <h2 className="font-semibold text-foreground">Offene Einladungen</h2>
          <div className="mt-3 space-y-2">
            {invitations.map((inv) => (
              <Card key={inv.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{inv.email}</p>
                    <p className="text-sm text-muted">
                      Rolle: {roleLabels[inv.role]} · Gültig bis{" "}
                      {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
                        inv.expiresAt
                      )}
                    </p>
                  </div>
                  <RevokeInvitationButton bandId={bandId} invitationId={inv.id} />
                </div>
                <p className="mt-2 truncate rounded-md bg-surface-muted px-2 py-1.5 font-mono text-xs text-muted">
                  {appUrl}/invite/{inv.token}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
