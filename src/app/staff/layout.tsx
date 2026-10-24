import { canManageUsers, isSuperadmin, requireStaff } from "@/server/authz";
import { hasFullQueue } from "@/server/roles";
import { prisma } from "@/server/prisma";
import { readTheme } from "@/server/theme";
import { queueCounts } from "@/server/tickets";
import { StaffShell } from "./staff-shell";

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

  return <StaffShell nav={nav}>{children}</StaffShell>;
}
