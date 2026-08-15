import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/avatar";
import { signOutAction } from "./actions";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { name: true, avatarUrl: true },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              B
            </span>
            <span className="font-semibold text-foreground">Bandplaner</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/profile" className="flex items-center gap-2">
              <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
              <Avatar src={user.avatarUrl} name={user.name} size="sm" />
            </Link>
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                <LogOut className="h-4 w-4" />
                Abmelden
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
