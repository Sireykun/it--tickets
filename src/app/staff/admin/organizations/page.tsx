import { requireSuperadmin } from "@/server/authz";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/prisma";
import { OrganizationForm } from "../admin-forms";
import { AdminPage, editTarget } from "../entity-list";

export const metadata: Metadata = { title: "Organizations" };

export default async function OrganizationsPage({ searchParams }: PageProps<"/staff/admin/organizations">) {
  await requireSuperadmin();
  const sp = await searchParams;
  const orgs = await prisma.organization.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });
  const target = editTarget(sp.edit, orgs);

  return (
    <AdminPage
      title="Organizations"
      subtitle="Group users by campus, grade or staff. Filter the queue by organization."
      newLabel="New organization"
      basePath="/staff/admin/organizations"
      saved={sp.saved === "1"}
      editTitle={target.item ? `Edit ${target.item.name}` : "New organization"}
      form={
        target.show ? (
          <>
            <OrganizationForm
              key={target.item?.id ?? "new"}
              org={target.item && { id: target.item.id, name: target.item.name, domains: target.item.domains, notes: target.item.notes, isActive: target.item.isActive }}
            />
            {target.item && (
              <p className="mt-4 text-sm">
                <Link href={`/staff?view=all&org=${target.item.id}`} className="font-bold text-primary hover:underline">
                  View this organization's tickets
                </Link>{" "}
                ·{" "}
                <Link href={`/staff/admin/users?org=${target.item.id}`} className="font-bold text-primary hover:underline">
                  View its {target.item._count.users} users
                </Link>
              </p>
            )}
          </>
        ) : undefined
      }
      rows={orgs.map((o) => ({
        id: o.id,
        title: o.name,
        subtitle: o.domains.length ? o.domains.join(", ") : "No auto-join domains",
        meta: `${o._count.users} user${o._count.users === 1 ? "" : "s"}`,
        inactive: !o.isActive,
      }))}
    />
  );
}
