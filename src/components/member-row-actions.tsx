"use client";

import { useState, useTransition } from "react";
import { UserMinus, X, KeyRound, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  updateRoleAction,
  updateGuestAccessAction,
  removeMemberAction,
  resetMemberPasswordAction,
} from "@/app/(app)/bands/[bandId]/members/actions";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Role } from "@/generated/prisma/client";

function toDateInputValue(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

export function MemberRowActions({
  bandId,
  membershipId,
  role,
  guestUntil,
  isSelf,
}: {
  bandId: string;
  membershipId: string;
  role: Role;
  guestUntil: string | null;
  isSelf: boolean;
}) {
  const [currentRole, setCurrentRole] = useState(role);
  const [currentGuestUntil, setCurrentGuestUntil] = useState(toDateInputValue(guestUntil));
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("bandMembers.rowActions");
  const tRoles = useTranslations("dashboard.roles");
  const roleOptions: { value: Role; label: string }[] = [
    { value: "MEMBER", label: tRoles("MEMBER") },
    { value: "ADMIN", label: tRoles("ADMIN") },
    { value: "GUEST", label: tRoles("GUEST") },
  ];

  function handleRoleChange(newRole: Role) {
    const previousRole = currentRole;
    setCurrentRole(newRole);
    setError(null);
    startTransition(async () => {
      const result = await updateRoleAction(bandId, membershipId, newRole);
      if (result?.error) {
        setCurrentRole(previousRole);
        setError(result.error);
      }
    });
  }

  function handleGuestUntilChange(value: string) {
    const previous = currentGuestUntil;
    setCurrentGuestUntil(value);
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      if (value) formData.set("guestUntil", value);
      const result = await updateGuestAccessAction(bandId, membershipId, formData);
      if (result?.error) {
        setCurrentGuestUntil(previous);
        setError(result.error);
      }
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(bandId, membershipId);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  function handleResetPassword() {
    if (!confirm(t("resetPasswordConfirm"))) {
      return;
    }
    setError(null);
    setTempPassword(null);
    startTransition(async () => {
      const result = await resetMemberPasswordAction(bandId, membershipId);
      if (result?.error) {
        setError(result.error);
      } else if (result?.tempPassword) {
        setTempPassword(result.tempPassword);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {currentRole === "GUEST" && (
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={currentGuestUntil}
              disabled={pending}
              onChange={(e) => handleGuestUntilChange(e.target.value)}
              title={t("guestUntilTitle")}
              className="w-auto text-xs"
            />
            {currentGuestUntil && (
              <button
                type="button"
                aria-label={t("setUnlimitedAria")}
                title={t("setUnlimitedAria")}
                disabled={pending}
                onClick={() => handleGuestUntilChange("")}
                className="text-muted hover:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <Select
          value={currentRole}
          disabled={pending}
          onChange={(e) => handleRoleChange(e.target.value as Role)}
          className="w-auto"
        >
          {roleOptions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleResetPassword}>
          <KeyRound className="h-4 w-4" />
          {t("resetPassword")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending || isSelf}
          onClick={handleRemove}
        >
          <UserMinus className="h-4 w-4" />
          {t("remove")}
        </Button>
      </div>
      {error && <p className="max-w-[220px] text-right text-xs text-danger">{error}</p>}
      {tempPassword && (
        <div className="max-w-[280px] rounded-lg border border-warning/40 bg-warning/10 p-2 text-right text-xs text-foreground">
          <p>{t("newPasswordNotice")}</p>
          <div className="mt-1 flex items-center justify-end gap-1.5">
            <code className="select-all rounded bg-surface px-1.5 py-0.5 font-mono text-sm">{tempPassword}</code>
            <button
              type="button"
              aria-label={t("copyPasswordAria")}
              title={t("copyPasswordAria")}
              onClick={() => navigator.clipboard.writeText(tempPassword)}
              className="text-muted hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1">{t("mustChangeNotice")}</p>
        </div>
      )}
    </div>
  );
}
