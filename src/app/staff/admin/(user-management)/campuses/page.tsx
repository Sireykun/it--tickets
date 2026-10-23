import { School, UserMinus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { ROLE_LABEL } from "@/lib/labels";
import { requireSuperadmin } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { removeFromCampusAction } from "../../actions";
import { CampusForm, CampusMemberForm } from "../../admin-forms";
import { AdminPage, IconTile, editTarget } from "../../entity-list";

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
  // Staff not yet working here, plus requesters with no home campus. Requesters moving
  // between campuses are handled with the Users page's bulk "Set home campus".
  const candidates = target.item
    ? await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { role: { in: ["AGENT", "ADMIN"] }, staffCampuses: { none: { campusId: target.item.id } } },
            { role: "USER", campusId: null },
          ],
        },
        orderBy: [{ role: "desc" }, { name: "asc" }],
        take: 300,
        select: { id: true, name: true, email: true, role: true },
      })
    : [];
  const memberError = typeof sp.memberError === "string" ? sp.memberError : null;

  return (
    <AdminPage
      title="Campuses"
      subtitle="Staff only see tickets from the campuses they work at. Give campus admins permissions on the Users page."
      newLabel="New campus"
      basePath="/staff/admin/campuses"
      saved={sp.saved === "1"}
      nested
      selectedId={target.item?.id}
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
                  <p className="text-muted">Nobody works here yet. Add someone below or from the Users page.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {staffOf(target.item).map((s) => (
                      <li key={s.userId} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <Link href={`/staff/admin/users?edit=${s.userId}`} className="font-bold text-primary hover:underline">
                            {s.user.name}
                          </Link>{" "}
                          <span className="text-muted">
                            · {ROLE_LABEL[s.user.role]}
                            {s.permissions.includes("users.manage") && " · manages users & agents"}
                          </span>
                        </span>
                        <form action={removeFromCampusAction}>
                          <input type="hidden" name="campusId" value={target.item!.id} />
                          <input type="hidden" name="userId" value={s.userId} />
                          <Button type="submit" variant="ghost" aria-label={`Remove ${s.user.name} from ${target.item!.name}`} className="px-3">
                            <UserMinus className="size-5" aria-hidden />
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                {memberError && (
                  <div className="mt-3">
                    <Alert>{memberError}</Alert>
                  </div>
                )}
                <h3 className="mt-4 mb-2 font-bold">Add someone to {target.item.name}</h3>
                <CampusMemberForm campusId={target.item.id} candidates={candidates} />
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
          leading: (
            <IconTile>
              <School aria-hidden />
            </IconTile>
          ),
          subtitle: `${admins} campus admin${admins === 1 ? "" : "s"} · ${agents} agent${agents === 1 ? "" : "s"}${c.emailDomains.length ? ` · ${c.emailDomains.join(", ")}` : ""}`,
          meta: `${c._count.tickets} tickets · ${c._count.users} users`,
          inactive: !c.isActive,
        };
      })}
    />
  );
}
