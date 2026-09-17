import { getTranslations } from "next-intl/server";
import { requireActiveUser } from "@/lib/access";
import { Card } from "@/components/ui/card";
import { RestoreBandForm } from "./restore-band-form";

export default async function RestoreBandPage() {
  await requireActiveUser();
  const t = await getTranslations("bandsNew.restore");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("hint")}</p>
      <Card className="mt-6">
        <RestoreBandForm />
      </Card>
    </div>
  );
}
