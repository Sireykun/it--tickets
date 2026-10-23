import { requireSuperadmin } from "@/server/authz";
import type { Metadata } from "next";
import { prisma } from "@/server/prisma";
import { SlaForm } from "../admin-forms";
import { AdminPage, editTarget } from "../entity-list";

export const metadata: Metadata = { title: "SLA policies" };

export default async function SlaPage({ searchParams }: PageProps<"/staff/admin/sla">) {
  await requireSuperadmin();
  const sp = await searchParams;
  const showInactive = sp.inactive === "1";
  const policies = await prisma.slaPolicy.findMany({
    orderBy: [{ isActive: "desc" }, { responseTimeHours: "asc" }],
    include: { _count: { select: { helpTopics: true } } },
  });
  const target = editTarget(sp.edit, policies);

  return (
    <AdminPage
      title="SLA policies"
      subtitle="Response and resolution targets, in wall-clock hours."
      newLabel="New policy"
      basePath="/staff/admin/sla"
      saved={sp.saved === "1"}
      deleted={sp.deleted === "1"}
      inactiveToggle={{ count: policies.filter((r) => !r.isActive).length, isShown: showInactive, href: showInactive ? "/staff/admin/sla" : "/staff/admin/sla?inactive=1" }}
      selectedId={target.item?.id}
      editTitle={target.item ? `Edit ${target.item.name}` : "New SLA policy"}
      form={target.show ? <SlaForm key={target.item?.id ?? "new"} sla={target.item} /> : undefined}
      rows={policies.filter((r) => showInactive || r.isActive).map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: `Respond within ${p.responseTimeHours}h · resolve within ${p.resolutionTimeHours}h`,
        meta: `Used by ${p._count.helpTopics} topic${p._count.helpTopics === 1 ? "" : "s"}`,
        inactive: !p.isActive,
      }))}
    />
  );
}
