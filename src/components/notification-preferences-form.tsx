"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";
import { ToggleRow } from "@/components/ui/toggle-row";
import {
  notificationEvents,
  getNotificationEventLabels,
  getNotificationEventDescriptions,
  type NotificationEvent,
} from "@/lib/notification-events";
import type { NotificationFormState } from "@/app/(app)/profile/actions";

const events = Object.keys(notificationEvents) as NotificationEvent[];

export function NotificationPreferencesForm({
  action,
  initialValues,
}: {
  action: (prevState: NotificationFormState, formData: FormData) => Promise<NotificationFormState>;
  initialValues: Record<string, boolean>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState(initialValues);
  const t = useTranslations("profile.notificationPreferences");
  const notificationEventLabels = getNotificationEventLabels(t);
  const notificationEventDescriptions = getNotificationEventDescriptions(t);

  return (
    <form action={formAction} className="space-y-3">
      {events.map((event) => {
        const field = notificationEvents[event];
        return (
          <ToggleRow
            key={event}
            name={field}
            label={notificationEventLabels[event]}
            description={notificationEventDescriptions[event]}
            checked={values[field] ?? false}
            onChange={(checked) => setValues((prev) => ({ ...prev, [field]: checked }))}
          />
        );
      })}
      <FieldError>{state?.error}</FieldError>
      {state?.success && <p className="text-sm text-success">{state.success}</p>}
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
