"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { revokeInvitationAction } from "@/app/(app)/bands/[bandId]/members/actions";
import { Button } from "@/components/ui/button";

export function RevokeInvitationButton({
  bandId,
  invitationId,
}: {
  bandId: string;
  invitationId: string;
}) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("bandMembers");
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => revokeInvitationAction(bandId, invitationId))}
    >
      <X className="h-4 w-4" />
      {t("revoke")}
    </Button>
  );
}
