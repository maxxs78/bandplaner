"use client";

import { useActionState, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Select, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/settings/actions";

type Role = { key: number; name: string; defaultAssigneeId: string | null };

export function LineupRolesForm({
  action,
  initialRoles,
  members,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  initialRoles: { name: string; defaultAssigneeId: string | null }[];
  members: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const nextKey = useRef(initialRoles.length);
  const [roles, setRoles] = useState<Role[]>(() =>
    initialRoles.map((role, key) => ({ key, ...role }))
  );
  const t = useTranslations("bandSettings.lineupRoles");

  function updateRole(index: number, patch: Partial<Role>) {
    setRoles((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRole(index: number) {
    setRoles((current) => current.filter((_, i) => i !== index));
  }

  function moveRole(index: number, direction: -1 | 1) {
    setRoles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addRole() {
    setRoles((current) => [...current, { key: nextKey.current++, name: "", defaultAssigneeId: null }]);
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        {roles.map((role, index) => (
          <div key={role.key} className="flex flex-wrap items-center gap-2">
            <Input
              name="roleName"
              value={role.name}
              onChange={(e) => updateRole(index, { name: e.target.value })}
              placeholder={t("rolePlaceholder")}
              className="min-w-0 flex-1 basis-32"
            />
            <Select
              name="defaultAssigneeId"
              value={role.defaultAssigneeId ?? ""}
              onChange={(e) => updateRole(index, { defaultAssigneeId: e.target.value || null })}
              className="min-w-0 flex-1 basis-32"
            >
              <option value="">{t("noDefaultAssignee")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => moveRole(index, -1)}
              disabled={index === 0}
              className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground disabled:opacity-30"
              aria-label={t("moveUp")}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => moveRole(index, 1)}
              disabled={index === roles.length - 1}
              className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground disabled:opacity-30"
              aria-label={t("moveDown")}
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => removeRole(index)}
              className="rounded-lg border border-border p-1.5 text-muted hover:text-danger"
              aria-label={t("remove")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {roles.length === 0 && <p className="text-sm text-muted">{t("noRoles")}</p>}
      </div>

      <button
        type="button"
        onClick={addRole}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <Plus className="h-4 w-4" />
        {t("addRole")}
      </button>

      <FieldError>{state?.error}</FieldError>
      <div>
        <Button type="submit" disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
