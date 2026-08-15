"use client";

import { useTransition } from "react";
import { Check, HelpCircle, X } from "lucide-react";
import clsx from "clsx";

const options = [
  { value: "YES", label: "Zusage", icon: Check, className: "data-[active=true]:bg-success data-[active=true]:text-white" },
  { value: "MAYBE", label: "Vielleicht", icon: HelpCircle, className: "data-[active=true]:bg-warning data-[active=true]:text-white" },
  { value: "NO", label: "Absage", icon: X, className: "data-[active=true]:bg-danger data-[active=true]:text-white" },
] as const;

export function AvailabilityButtons({
  action,
  current,
}: {
  action: (status: "YES" | "NO" | "MAYBE") => Promise<void>;
  current?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={pending}
          data-active={current === opt.value}
          onClick={() => startTransition(() => action(opt.value))}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-surface-muted disabled:opacity-50",
            opt.className
          )}
        >
          <opt.icon className="h-4 w-4" />
          {opt.label}
        </button>
      ))}
    </div>
  );
}
