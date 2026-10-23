import Link from "next/link";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/ui/user-menu";
import { canManageUsers, isSuperadmin, requireStaff } from "@/server/authz";
import { hasFullQueue } from "@/server/roles";
import { prisma } from "@/server/prisma";
import { readTheme } from "@/server/theme";
import { queueCounts } from "@/server/tickets";
import { StaffMobileNav, StaffSidebar } from "./staff-nav";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const [counts, tasks, theme, profile] = await Promise.all([
    queueCounts(user),
    prisma.task.count({ where: { status: "OPEN", assignedAgentId: user.id } }),
    readTheme(),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { avatarStorageKey: true } }),
  ]);
  const admin = isSuperadmin(user) ? "super" : canManageUsers(user) ? "users" : null;
  const nav = {
    counts: { ...counts, tasks },
    fullQueue: hasFullQueue(user.role),
    admin,
    user: { name: user.name, email: user.email, hasPhoto: Boolean(profile.avatarStorageKey) },
    theme,
  } as const;

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r border-border bg-surface/70 lg:block">
        <StaffSidebar {...nav} />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface/85 px-2 backdrop-blur-md lg:hidden">
          <StaffMobileNav {...nav} />
          <Link href="/staff" className="mr-auto">
            <Brand subtitle="Staff console" />
          </Link>
          <UserMenu name={user.name} email={user.email} hasPhoto={Boolean(profile.avatarStorageKey)} theme={theme} switchTo="portal" />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:pb-12 lg:pt-6">{children}</main>
      </div>
    </div>
  );
}
