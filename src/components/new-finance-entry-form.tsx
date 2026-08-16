"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/finance/actions";

const CUSTOM_CATEGORY = "__custom__";

export function NewFinanceEntryForm({
  action,
  events,
  categorySuggestions,
  allowBalanceTypes,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  events: { id: string; title: string }[];
  categorySuggestions: string[];
  allowBalanceTypes: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [categorySelect, setCategorySelect] = useState(categorySuggestions[0] ?? CUSTOM_CATEGORY);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="type">Typ</Label>
          <Select id="type" name="type" defaultValue="INCOME">
            <option value="INCOME">Einnahme</option>
            <option value="EXPENSE">Ausgabe</option>
            {allowBalanceTypes && (
              <>
                <option value="BALANCE_PAYOUT">Auszahlung aus dem Bandkonto</option>
                <option value="BALANCE_DEPOSIT">Einzahlung ins Bandkonto</option>
              </>
            )}
          </Select>
        </div>
        <div>
          <Label htmlFor="amount">Betrag (€)</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
        </div>
        <div>
          <Label htmlFor="categorySelect">Kategorie</Label>
          <Select
            id="categorySelect"
            value={categorySelect}
            onChange={(e) => setCategorySelect(e.target.value)}
          >
            {categorySuggestions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={CUSTOM_CATEGORY}>Eigene Kategorie…</option>
          </Select>
          {categorySelect === CUSTOM_CATEGORY ? (
            <Input name="category" placeholder="Eigene Kategorie" required className="mt-2" />
          ) : (
            <input type="hidden" name="category" value={categorySelect} />
          )}
        </div>
        <div>
          <Label htmlFor="date">Datum</Label>
          <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <Label htmlFor="eventId">Verknüpfter Termin</Label>
          <Select id="eventId" name="eventId" defaultValue="">
            <option value="">– keiner –</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="description">Beschreibung (optional)</Label>
        <Input id="description" name="description" />
      </div>
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? "Wird angelegt…" : "Anlegen"}
      </Button>
    </form>
  );
}
