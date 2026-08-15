"use client";

import { useState, useTransition } from "react";
import { UserMinus, X } from "lucide-react";
import {
  updateRoleAction,
  updateGuestAccessAction,
  removeMemberAction,
} from "@/app/(app)/bands/[bandId]/members/actions";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Role } from "@/generated/prisma/client";

const roleOptions: { value: Role; label: string }[] = [
  { value: "MEMBER", label: "Mitglied" },
  { value: "FINANCE_ADMIN", label: "Finanz-Administrator" },
  { value: "ADMIN", label: "Administrator" },
  { value: "GUEST", label: "Gast" },
];

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
  const [pending, startTransition] = useTransition();

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
              title="Zugriff bis (leer = unbegrenzt)"
              className="w-auto text-xs"
            />
            {currentGuestUntil && (
              <button
                type="button"
                aria-label="Zugriff unbegrenzt setzen"
                title="Zugriff unbegrenzt setzen"
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending || isSelf}
          onClick={handleRemove}
        >
          <UserMinus className="h-4 w-4" />
          Entfernen
        </Button>
      </div>
      {error && <p className="max-w-[220px] text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
