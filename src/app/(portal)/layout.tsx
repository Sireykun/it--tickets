import { Headset } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { isStaff, requireUser } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { DesktopNav, PortalSidebar, TabBar } from "./portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { avatarStorageKey: true, themePreference: true } });
  return (
    <div className="flex min-h-dvh bg-bg" data-portal-theme={profile.themePreference}>
      <PortalSidebar name={user.name} hasPhoto={Boolean(profile.avatarStorageKey)} staff={isStaff(user.role)} />
      <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:px-6">
          <Link href="/" className="mr-auto rounded-lg">
            <Brand />
          </Link>
          <div className="lg:hidden"><DesktopNav /></div>
          {isStaff(user.role) && (
            <Link
              href="/staff"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-bold text-primary transition-colors hover:bg-primary-soft md:ml-2"
            >
              <Headset className="size-4" aria-hidden /> Staff console
            </Link>
          )}
        </div>
      </header>
      <main className="pb-tabbar mx-auto max-w-7xl px-4 py-8 md:pb-12 lg:px-6 lg:pt-6">{children}</main>
      <TabBar />
      </div>
    </div>
  );
}
