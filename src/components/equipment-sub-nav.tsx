import Link from "next/link";
import clsx from "clsx";
import { useTranslations } from "next-intl";

export function EquipmentSubNav({
  bandId,
  active,
  showPacklists = true,
}: {
  bandId: string;
  active: "catalog" | "packlists";
  showPacklists?: boolean;
}) {
  const t = useTranslations("equipment");
  const allTabs = [
    { key: "catalog", label: t("catalogTab"), href: `/bands/${bandId}/equipment` },
    { key: "packlists", label: t("packlistsTab"), href: `/bands/${bandId}/equipment/packlists` },
  ] as const;
  const tabs = allTabs.filter((tab) => showPacklists || tab.key !== "packlists");

  return (
    <div className="flex gap-1 rounded-lg border border-border p-1">
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href}>
          <span
            className={clsx(
              "inline-block rounded-md px-3 py-1 text-sm",
              active === tab.key ? "bg-primary text-primary-foreground" : "text-muted"
            )}
          >
            {tab.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
