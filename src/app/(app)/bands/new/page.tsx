"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createBandAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function NewBandPage() {
  const [state, formAction, pending] = useActionState(createBandAction, undefined);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold text-foreground">Neue Band anlegen</h1>
      <p className="mt-1 text-sm text-muted">
        Du wirst automatisch Administrator:in dieser Band.
      </p>
      <Card className="mt-6">
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="name">Bandname</Label>
            <Input id="name" name="name" type="text" required autoFocus />
          </div>
          <FieldError>{state?.error}</FieldError>
          <Button type="submit" className="w-full" disabled={pending}>
            <Plus className="h-4 w-4" />
            {pending ? "Wird erstellt…" : "Band erstellen"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
