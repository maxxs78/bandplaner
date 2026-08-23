"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Select, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/calendar/actions";

const FREE_TEXT = "__free_text__";

type LineupRow = {
  key: number;
  role: string;
  assignedToId: string | null;
  assignedToName: string | null;
};

export function LineupEditor({
  action,
  initialEntries,
  members,
  readOnly = false,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  initialEntries: { role: string; assignedToId: string | null; assignedToName: string | null }[];
  members: { id: string; name: string }[];
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const nextKey = useRef(initialEntries.length);
  const [rows, setRows] = useState<LineupRow[]>(() =>
    initialEntries.map((e, key) => ({ key, ...e }))
  );
  const t = useTranslations("calendar.detail.lineup");

  if (readOnly) {
    return (
      <div className="space-y-2">
        {initialEntries.map((entry, index) => {
          const memberName = entry.assignedToId
            ? members.find((m) => m.id === entry.assignedToId)?.name
            : entry.assignedToName;
          return (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{entry.role}</span>
              <span className="text-muted">{memberName || t("unassigned")}</span>
            </div>
          );
        })}
        {initialEntries.length === 0 && <p className="text-sm text-muted">{t("noEntries")}</p>}
      </div>
    );
  }

  function updateRow(index: number, patch: Partial<LineupRow>) {
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((current) => [...current, { key: nextKey.current++, role: "", assignedToId: null, assignedToName: null }]);
  }

  function assigneeValue(row: LineupRow) {
    if (row.assignedToId) return row.assignedToId;
    if (row.assignedToName != null) return FREE_TEXT;
    return "";
  }

  function handleAssigneeChange(index: number, value: string) {
    if (value === FREE_TEXT) {
      updateRow(index, { assignedToId: null, assignedToName: "" });
    } else if (value === "") {
      updateRow(index, { assignedToId: null, assignedToName: null });
    } else {
      updateRow(index, { assignedToId: value, assignedToName: null });
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={row.key} className="flex flex-wrap items-center gap-2">
            <Input
              name="role"
              value={row.role}
              onChange={(e) => updateRow(index, { role: e.target.value })}
              placeholder={t("rolePlaceholder")}
              className="min-w-0 flex-1 basis-40"
            />
            <Select
              value={assigneeValue(row)}
              onChange={(e) => handleAssigneeChange(index, e.target.value)}
              className="min-w-0 flex-1 basis-40"
            >
              <option value="">{t("unassigned")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value={FREE_TEXT}>{t("freeText")}</option>
            </Select>
            {row.assignedToName != null && !row.assignedToId && (
              <Input
                value={row.assignedToName}
                onChange={(e) => updateRow(index, { assignedToName: e.target.value })}
                placeholder={t("freeTextPlaceholder")}
                className="min-w-0 flex-1 basis-32"
              />
            )}
            <input type="hidden" name="assignedToId" value={row.assignedToId ?? ""} />
            <input type="hidden" name="assignedToName" value={row.assignedToName ?? ""} />
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="rounded-lg border border-border p-1.5 text-muted hover:text-danger"
              aria-label={t("remove")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">{t("noEntries")}</p>}
      </div>

      <button
        type="button"
        onClick={addRow}
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
