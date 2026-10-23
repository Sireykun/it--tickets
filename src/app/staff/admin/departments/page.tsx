import { Building2 } from "lucide-react";
import { requireSuperadmin } from "@/server/authz";
import type { Metadata } from "next";
import { prisma } from "@/server/prisma";
import { DepartmentForm } from "../admin-forms";
import { AdminPage, IconTile, editTarget } from "../entity-list";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage({ searchParams }: PageProps<"/staff/admin/departments">) {
  await requireSuperadmin();
  const sp = await searchParams;
  const departments = await prisma.department.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { tickets: true, teams: true } } },
  });
  const target = editTarget(sp.edit, departments);

  return (
    <AdminPage
      title="Departments"
      subtitle="Every ticket belongs to one department, such as IT or Facilities. Help topics route tickets here, and canned replies can be limited to one."
      newLabel="New department"
      basePath="/staff/admin/departments"
      saved={sp.saved === "1"}
      selectedId={target.item?.id}
      editTitle={target.item ? `Edit ${target.item.name}` : "New department"}
      form={target.show ? <DepartmentForm key={target.item?.id ?? "new"} department={target.item} /> : undefined}
      rows={departments.map((d) => ({
        id: d.id,
        title: d.name,
        leading: (
          <IconTile>
            <Building2 aria-hidden />
          </IconTile>
        ),
        subtitle: d.description,
        meta: `${d._count.teams} teams · ${d._count.tickets} tickets`,
        inactive: !d.isActive,
      }))}
    />
  );
}
