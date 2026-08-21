import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SetlistsPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { membership } = await requireMembership(bandId);
  const canCreate = canManageContent(membership.role);
  const t = await getTranslations("setlists");

  const setlists = await prisma.setlist.findMany({
    where: { bandId },
    include: { event: true, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        {canCreate && (
          <Link href={`/bands/${bandId}/setlists/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t("newButton")}
            </Button>
          </Link>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {setlists.length === 0 && <Card className="text-sm text-muted">{t("noSetlists")}</Card>}
        {setlists.map((s) => (
          <Link key={s.id} href={`/bands/${bandId}/setlists/${s.id}`}>
            <Card className="flex items-center justify-between transition hover:border-primary">
              <div>
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="text-sm text-muted">
                  {t("songCount", { count: s._count.items })}
                  {s.event ? t("linkedWith", { title: s.event.title }) : ""}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
