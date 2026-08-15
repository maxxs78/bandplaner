"use client";

import { useRouter } from "next/navigation";

export function BandSwitcher({
  bands,
  currentBandId,
}: {
  bands: { id: string; name: string }[];
  currentBandId: string;
}) {
  const router = useRouter();

  return (
    <select
      value={currentBandId}
      onChange={(e) => router.push(`/bands/${e.target.value}`)}
      className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
    >
      {bands.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
