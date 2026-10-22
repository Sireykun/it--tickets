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
  const [counts, tasks, theme] = await Promise.all([
    queueCounts(user),
    prisma.task.count({ where: { status: "OPEN", assignedAgentId: user.id } }),
    readTheme(),
  ]);
  const admin = isSuperadmin(user) ? "super" : canManageUsers(user) ? "users" : null;
  const nav = {
    counts: { ...counts, tasks },
    fullQueue: hasFullQueue(user.role),
    admin,
    user: { name: user.name, email: user.email },
    theme,
  } as const;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-border bg-surface lg:block">
        <StaffSidebar {...nav} />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface/85 px-2 backdrop-blur-md lg:hidden">
          <StaffMobileNav {...nav} />
          <Link href="/staff" className="mr-auto">
            <Brand subtitle="Staff console" />
          </Link>
          <UserMenu name={user.name} email={user.email} theme={theme} switchTo="portal" />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
