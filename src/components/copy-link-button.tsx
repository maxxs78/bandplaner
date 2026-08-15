"use client";

import { useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import clsx from "clsx";

export function CopyLinkButton({ path, className }: { path: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${path}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={path}
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 text-xs text-muted hover:text-primary",
        className
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
      {copied ? "Kopiert" : "Link kopieren"}
    </button>
  );
}
