"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, CalendarCheck, Music, ListMusic, Folder, Package, Wallet, Users } from "lucide-react";
import clsx from "clsx";

const tabs = [
  { href: "", label: "Übersicht", icon: LayoutDashboard },
  { href: "/calendar", label: "Kalender", icon: Calendar },
  { href: "/availability", label: "Verfügbarkeit", icon: CalendarCheck },
  { href: "/songs", label: "Songs", icon: Music },
  { href: "/setlists", label: "Setlisten", icon: ListMusic },
  { href: "/files", label: "Dateien", icon: Folder },
  { href: "/equipment", label: "Equipment", icon: Package },
  { href: "/finance", label: "Finanzen", icon: Wallet },
  { href: "/members", label: "Band", icon: Users },
];

export function BandNav({
  bandId,
  showEquipment = true,
  showFinance = false,
}: {
  bandId: string;
  showEquipment?: boolean;
  showFinance?: boolean;
}) {
  const pathname = usePathname();
  const base = `/bands/${bandId}`;
  const visibleTabs = tabs.filter(
    (tab) => (showEquipment || tab.href !== "/equipment") && (showFinance || tab.href !== "/finance")
  );

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border">
      {visibleTabs.map((tab) => {
        const href = `${base}${tab.href}`;
        const active =
          tab.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={tab.href}
            href={href}
            className={clsx(
              "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
