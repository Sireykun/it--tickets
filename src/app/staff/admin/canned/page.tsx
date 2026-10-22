import { requireSuperadmin } from "@/server/authz";
import type { Metadata } from "next";
import { CANNED_VARIABLES } from "@/server/canned";
import { prisma } from "@/server/prisma";
import { CannedForm } from "../admin-forms";
import { AdminPage, editTarget } from "../entity-list";

export const metadata: Metadata = { title: "Canned replies" };

export default async function CannedPage({ searchParams }: PageProps<"/staff/admin/canned">) {
  await requireSuperadmin();
  const sp = await searchParams;
  const [replies, departments] = await Promise.all([
    prisma.cannedResponse.findMany({
      orderBy: [{ isActive: "desc" }, { title: "asc" }],
      include: { department: { select: { name: true } } },
    }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const target = editTarget(sp.edit, replies);

  return (
    <AdminPage
      title="Canned replies"
      subtitle="Saved answers agents can insert into a reply."
      newLabel="New reply"
      basePath="/staff/admin/canned"
      saved={sp.saved === "1"}
      editTitle={target.item ? `Edit ${target.item.title}` : "New canned reply"}
      form={
        target.show ? (
          <CannedForm
            key={target.item?.id ?? "new"}
            canned={target.item && { id: target.item.id, title: target.item.title, body: target.item.body, departmentId: target.item.departmentId, isActive: target.item.isActive }}
            departments={departments}
            variables={CANNED_VARIABLES}
          />
        ) : undefined
      }
      rows={replies.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.body.length > 90 ? `${r.body.slice(0, 90)}…` : r.body,
        meta: r.department?.name ?? "All departments",
        inactive: !r.isActive,
      }))}
    />
  );
}
