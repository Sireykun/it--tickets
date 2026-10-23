import Link from "next/link";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/ui/user-menu";
import { ROLE_LABEL } from "@/lib/labels";
import { isStaff, requireUser } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { readTheme } from "@/server/theme";
import { PortalSidebar, TabBar } from "./portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [user, theme] = await Promise.all([requireUser(), readTheme()]);
  const profile = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { avatarStorageKey: true, themePreference: true } });
  const hasPhoto = Boolean(profile.avatarStorageKey);
  return (
    <div className="flex min-h-dvh bg-bg" data-portal-layout data-portal-theme={profile.themePreference}>
      <PortalSidebar name={user.name} roleLabel={ROLE_LABEL[user.role]} hasPhoto={hasPhoto} staff={isStaff(user.role)} />
      <div className="min-w-0 flex-1">
        <header data-portal-header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:px-6">
            <Link href="/" className="mr-auto rounded-lg">
              <Brand />
            </Link>
            <UserMenu name={user.name} email={user.email} hasPhoto={hasPhoto} theme={theme} switchTo={isStaff(user.role) ? "staff" : null} />
          </div>
        </header>
        <main data-portal-main className="pb-tabbar mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:pb-12 lg:pt-6">{children}</main>
        <TabBar />
      </div>
    </div>
  );
}
