import { requireSuperadmin } from "@/server/authz";
import type { Metadata } from "next";
import { prisma } from "@/server/prisma";
import { TeamForm } from "../admin-forms";
import { AdminPage, editTarget } from "../entity-list";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage({ searchParams }: PageProps<"/staff/admin/teams">) {
  await requireSuperadmin();
  const sp = await searchParams;
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
      subtitle="Groups of agents that tickets are assigned to. Add members from the Users page."
      newLabel="New team"
      basePath="/staff/admin/teams"
      saved={sp.saved === "1"}
      editTitle={target.item ? `Edit ${target.item.name}` : "New team"}
      form={target.show ? <TeamForm key={target.item?.id ?? "new"} team={target.item} departments={departments} /> : undefined}
      rows={teams.map((t) => ({
        id: t.id,
        title: t.name,
        subtitle: t.department?.name ?? "No department",
        meta: `${t._count.members} member${t._count.members === 1 ? "" : "s"}`,
        inactive: !t.isActive,
      }))}
    />
  );
}
