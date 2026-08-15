"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

export type FileEditData = { filename: string; category?: string; visibility: string };

export function FileEditButton({
  filename,
  category,
  categoryOptions,
  visibility,
  visibilityOptions,
  action,
}: {
  filename: string;
  category?: string;
  categoryOptions?: { value: string; label: string }[];
  visibility: string;
  visibilityOptions: { value: string; label: string }[];
  action: (data: FileEditData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const filenameRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const visibilityRef = useRef<HTMLSelectElement>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Datei bearbeiten"
        className="shrink-0 text-muted hover:text-primary"
      >
        <Pencil className="h-4 w-4" />
      </button>
    );
  }

  return (
    <form
      className="mt-2 w-full basis-full rounded-lg border border-border bg-surface-muted p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const newFilename = filenameRef.current?.value.trim();
        if (!newFilename) return;
        startTransition(async () => {
          await action({
            filename: newFilename,
            category: categoryRef.current?.value,
            visibility: visibilityRef.current?.value ?? visibility,
          });
          setEditing(false);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={categoryOptions ? "" : "sm:col-span-2"}>
          <Label htmlFor="edit-filename">Dateiname</Label>
          <Input id="edit-filename" ref={filenameRef} defaultValue={filename} disabled={pending} />
        </div>
        {categoryOptions && (
          <div>
            <Label htmlFor="edit-category">Kategorie</Label>
            <Select id="edit-category" ref={categoryRef} defaultValue={category} disabled={pending}>
              {categoryOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="edit-visibility">Sichtbarkeit</Label>
          <Select id="edit-visibility" ref={visibilityRef} defaultValue={visibility} disabled={pending}>
            {visibilityOptions.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Wird gespeichert…" : "Speichern"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={pending}>
          <X className="h-4 w-4" />
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
