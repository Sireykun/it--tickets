import type { Metadata } from "next";
import Link from "next/link";
import { ROLE_LABEL } from "@/lib/labels";
import { requireSuperadmin } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { CampusForm } from "../admin-forms";
import { AdminPage, editTarget } from "../entity-list";

export const metadata: Metadata = { title: "Campuses" };

export default async function CampusesPage({ searchParams }: PageProps<"/staff/admin/campuses">) {
  await requireSuperadmin();
  const sp = await searchParams;
  const campuses = await prisma.campus.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { tickets: true, users: true } },
      staff: { include: { user: { select: { id: true, name: true, role: true, isActive: true } } } },
    },
  });
  const target = editTarget(sp.edit, campuses);
  const staffOf = (c: (typeof campuses)[number]) => c.staff.filter((s) => s.user.isActive);

  return (
    <AdminPage
      title="Campuses"
      subtitle="Staff only see tickets from the campuses they work at. Give campus admins permissions on the Users page."
      newLabel="New campus"
      basePath="/staff/admin/campuses"
      saved={sp.saved === "1"}
      editTitle={target.item ? `Edit ${target.item.name}` : "New campus"}
      form={
        target.show ? (
          <>
            <CampusForm
              key={target.item?.id ?? "new"}
              campus={target.item && { id: target.item.id, name: target.item.name, emailDomains: target.item.emailDomains, isActive: target.item.isActive }}
            />
            {target.item && (
              <section aria-labelledby="campus-staff" className="mt-5 border-t border-border pt-4 text-sm">
                <h3 id="campus-staff" className="mb-2 font-bold">
                  Staff at {target.item.name}
                </h3>
                {staffOf(target.item).length === 0 ? (
                  <p className="text-muted">Nobody works here yet. Add people from the Users page.</p>
                ) : (
                  <ul className="space-y-1">
                    {staffOf(target.item).map((s) => (
                      <li key={s.userId}>
                        <Link href={`/staff/admin/users?edit=${s.userId}`} className="font-bold text-primary hover:underline">
                          {s.user.name}
                        </Link>{" "}
                        <span className="text-muted">
                          · {ROLE_LABEL[s.user.role]}
                          {s.permissions.includes("users.manage") && " · manages users & agents"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3">
                  <Link href={`/staff?view=all&campus=${target.item.id}`} className="font-bold text-primary hover:underline">
                    View this campus's tickets
                  </Link>{" "}
                  ·{" "}
                  <Link href={`/staff/admin/users?campus=${target.item.id}`} className="font-bold text-primary hover:underline">
                    View its users
                  </Link>
                </p>
              </section>
            )}
          </>
        ) : undefined
      }
      rows={campuses.map((c) => {
        const admins = staffOf(c).filter((s) => s.user.role === "ADMIN").length;
        const agents = staffOf(c).filter((s) => s.user.role === "AGENT").length;
        return {
          id: c.id,
          title: c.name,
          subtitle: `${admins} campus admin${admins === 1 ? "" : "s"} · ${agents} agent${agents === 1 ? "" : "s"}${c.emailDomains.length ? ` · ${c.emailDomains.join(", ")}` : ""}`,
          meta: `${c._count.tickets} tickets · ${c._count.users} users`,
          inactive: !c.isActive,
        };
      })}
    />
  );
}
