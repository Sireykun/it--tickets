import { UsersRound } from "lucide-react";
import { requireSuperadmin } from "@/server/authz";
import type { Metadata } from "next";
import { prisma } from "@/server/prisma";
import { TeamForm } from "../admin-forms";
import { AdminPage, IconTile, editTarget } from "../entity-list";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage({ searchParams }: PageProps<"/staff/admin/teams">) {
  await requireSuperadmin();
  const sp = await searchParams;
  const showInactive = sp.inactive === "1";
  const [teams, departments] = await Promise.all([
    prisma.team.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { department: { select: { name: true } }, _count: { select: { members: true } } },
    }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const target = editTarget(sp.edit, teams);

  return (
    <AdminPage
      title="Teams"
      subtitle="Groups of agents who share tickets. Members see their team's tickets under My teams. Add members on a user's page in User management."
      newLabel="New team"
      basePath="/staff/admin/teams"
      saved={sp.saved === "1"}
      deleted={sp.deleted === "1"}
      inactiveToggle={{ count: teams.filter((r) => !r.isActive).length, isShown: showInactive, href: showInactive ? "/staff/admin/teams" : "/staff/admin/teams?inactive=1" }}
      selectedId={target.item?.id}
      editTitle={target.item ? `Edit ${target.item.name}` : "New team"}
      form={target.show ? <TeamForm key={target.item?.id ?? "new"} team={target.item} departments={departments} /> : undefined}
      rows={teams.filter((r) => showInactive || r.isActive).map((t) => ({
        id: t.id,
        title: t.name,
        leading: (
          <IconTile>
            <UsersRound aria-hidden />
          </IconTile>
        ),
        subtitle: t.department?.name ?? "No department",
        meta: `${t._count.members} member${t._count.members === 1 ? "" : "s"}`,
        inactive: !t.isActive,
      }))}
    />
  );
}
