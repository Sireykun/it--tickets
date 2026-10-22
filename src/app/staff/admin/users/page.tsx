import { Search } from "lucide-react";
import type { Metadata } from "next";
import { Input, Select } from "@/components/ui/field";
import { FilterChips, FiltersPopover } from "@/components/ui/list-controls";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { formatRelative } from "@/lib/format";
import { ROLES, ROLE_LABEL } from "@/lib/labels";
import { isSuperadmin, requireUserManager } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { UserForm } from "../admin-forms";
import { AdminPage } from "../entity-list";

export const metadata: Metadata = { title: "Users" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function UsersPage({ searchParams }: PageProps<"/staff/admin/users">) {
  const actor = await requireUserManager();
  const superadmin = isSuperadmin(actor);
  // Campus admins only see requesters and agents of the campuses they manage.
  const managed = actor.manageCampusIds === "all" ? null : actor.manageCampusIds;
  const reach: Prisma.UserWhereInput = managed
    ? { role: { in: ["USER", "AGENT"] }, OR: [{ campusId: { in: managed } }, { staffCampuses: { some: { campusId: { in: managed } } } }] }
    : {};
  const roles: Role[] = superadmin ? ROLES : ["USER", "AGENT"];

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const role = roles.includes(sp.role as Role) ? (sp.role as Role) : undefined;
  const orgId = typeof sp.org === "string" && UUID.test(sp.org) ? sp.org : undefined;
  const campusId = typeof sp.campus === "string" && UUID.test(sp.campus) ? sp.campus : undefined;

  const [users, departments, teams, organizations, campuses] = await Promise.all([
    prisma.user.findMany({
      where: {
        AND: [
          reach,
          { role, organizationId: orgId },
          campusId ? { OR: [{ campusId }, { staffCampuses: { some: { campusId } } }] } : {},
          q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
        ],
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: 200,
      include: {
        organization: { select: { name: true } },
        campus: { select: { name: true } },
        staffCampuses: { select: { campusId: true, permissions: true, campus: { select: { name: true } } } },
        teamMemberships: { select: { teamId: true, team: { select: { name: true } } } },
      },
    }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.team.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.organization.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.campus.findMany({
      where: { isActive: true, ...(managed ? { id: { in: managed } } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Editing a user outside the current filter still works, within the editor's reach.
  let target: { show: boolean; item?: Parameters<typeof UserForm>[0]["user"] } = { show: sp.edit === "new" };
  if (typeof sp.edit === "string" && UUID.test(sp.edit)) {
    const u = await prisma.user.findFirst({
      where: { AND: [{ id: sp.edit }, reach] },
      include: { teamMemberships: true, staffCampuses: true },
    });
    if (u) {
      // Pick fields explicitly: this goes to a client component, so never spread the row (password hash).
      target = {
        show: true,
        item: {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          departmentId: u.departmentId,
          organizationId: u.organizationId,
          campusId: u.campusId,
          staffCampusIds: u.staffCampuses.map((s) => s.campusId),
          manageCampusIds: u.staffCampuses.filter((s) => s.permissions.includes("users.manage")).map((s) => s.campusId),
          isActive: u.isActive,
          hasPassword: u.passwordHash !== null,
          teamIds: u.teamMemberships.map((m) => m.teamId),
        },
      };
    }
  }

  const hrefWith = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (role) p.set("role", role);
    if (campusId) p.set("campus", campusId);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `/staff/admin/users${p.size ? `?${p}` : ""}`;
  };
  const campusName = campuses.find((c) => c.id === campusId)?.name;
  const chips = [
    ...(role ? [{ label: ROLE_LABEL[role], href: hrefWith({ role: null }) }] : []),
    ...(campusName ? [{ label: campusName, href: hrefWith({ campus: null }) }] : []),
  ];

  return (
    <AdminPage
      title="Users"
      subtitle={superadmin ? "Requesters, agents and admins at every campus." : `Requesters and agents at ${campuses.map((c) => c.name).join(", ")}.`}
      newLabel="New user"
      basePath="/staff/admin/users"
      saved={sp.saved === "1"}
      editTitle={target.item ? `Edit ${target.item.name}` : "New user"}
      form={
        target.show ? (
          <UserForm
            key={target.item?.id ?? "new"}
            user={target.item}
            departments={departments}
            teams={teams}
            organizations={organizations}
            campuses={campuses}
            roles={roles}
            superadmin={superadmin}
          />
        ) : undefined
      }
      toolbar={
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <form method="get" className="relative min-w-0 flex-1 basis-56">
              {role && <input type="hidden" name="role" value={role} />}
              {campusId && <input type="hidden" name="campus" value={campusId} />}
              <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden />
              <Input name="q" type="search" defaultValue={q} placeholder="Search name or email" aria-label="Search users" className="pl-10" />
            </form>
            <FiltersPopover action="/staff/admin/users" hidden={{ q: q || undefined }} activeCount={chips.length} clearHref={hrefWith({ role: null, campus: null })}>
              <Select name="role" defaultValue={role ?? ""} aria-label="Role">
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
              {campuses.length > 1 && (
                <Select name="campus" defaultValue={campusId ?? ""} aria-label="Campus">
                  <option value="">All campuses</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </FiltersPopover>
          </div>
          <FilterChips chips={chips} />
        </div>
      }
      rows={users.map((u) => {
        const works = u.staffCampuses.map((s) => s.campus.name + (s.permissions.includes("users.manage") ? " (manages users)" : ""));
        const where = u.role === "USER" ? u.campus?.name : works.length ? works.join(", ") : u.role === "SUPERADMIN" ? "All campuses" : "No campus";
        return {
          id: u.id,
          title: u.name,
          subtitle: [u.email, ROLE_LABEL[u.role], where, u.organization?.name].filter(Boolean).join(" · "),
          meta: u.lastLoginAt ? `Last sign-in ${formatRelative(u.lastLoginAt)}` : "Never signed in",
          inactive: !u.isActive,
        };
      })}
    />
  );
}
