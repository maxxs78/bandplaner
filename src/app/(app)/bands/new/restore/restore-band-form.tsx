"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Upload, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

type ImportResult = {
  bandId: string;
  bandName: string;
  rowCounts: Record<string, number>;
  droppedRows: Record<string, number>;
  filesCopied: number;
  totalBytes: number;
};

export function RestoreBandForm() {
  const t = useTranslations("bandsNew.restore");
  const [status, setStatus] = useState<"idle" | "uploading" | "error" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setError(null);
    try {
      const res = await fetch("/api/bands/import", {
        method: "POST",
        body: file,
        headers: { "Content-Type": "application/zip" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("genericError"));
        setStatus("error");
        return;
      }
      setResult(data as ImportResult);
      setStatus("done");
    } catch {
      setError(t("genericError"));
      setStatus("error");
    }
  }

  if (status === "done" && result) {
    const totalRows = Object.values(result.rowCounts).reduce((sum, n) => sum + n, 0);
    const totalDropped = Object.values(result.droppedRows).reduce((sum, n) => sum + n, 0);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">{t("resultTitle", { name: result.bandName })}</p>
        </div>
        <p className="text-sm text-muted">{t("rowsImported", { count: totalRows })}</p>
        {totalDropped > 0 && <p className="text-sm text-warning">{t("rowsDropped", { count: totalDropped })}</p>}
        <p className="text-sm text-muted">{t("filesCopied", { count: result.filesCopied })}</p>
        <Link href={`/bands/${result.bandId}`}>
          <Button className="w-full">
            {t("goToBand")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="file">{t("fileLabel")}</Label>
        <Input id="file" name="file" type="file" accept=".zip,application/zip" required disabled={status === "uploading"} />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" className="w-full" disabled={status === "uploading"}>
        <Upload className="h-4 w-4" />
        {status === "uploading" ? t("uploading") : t("submit")}
      </Button>
    </form>
  );
}
