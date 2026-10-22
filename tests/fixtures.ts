import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/server/prisma";
import type { AppUser } from "@/server/roles";
import { loadAppUser } from "@/server/users";

export async function allCampusIds(): Promise<string[]> {
  return (await prisma.campus.findMany({ orderBy: { createdAt: "asc" }, select: { id: true } })).map((c) => c.id);
}

// Creates a user and returns them as the app sees them (with campus scope).
// Staff work at every campus unless `campusIds` says otherwise.
export async function makeUser(
  tag: string,
  name: string,
  role: Role,
  opts: { campusIds?: string[]; manage?: string[]; campusId?: string | null; emailAlerts?: boolean } = {},
): Promise<AppUser> {
  const u = await prisma.user.create({
    data: {
      email: `${name.toLowerCase().replace(/\s+/g, "-")}-${tag}@ciaschool.edu.kh`,
      name,
      role,
      campusId: opts.campusId ?? null,
      ...(opts.emailAlerts === undefined ? {} : { emailAlerts: opts.emailAlerts }),
    },
  });
  if (role === "AGENT" || role === "ADMIN") {
    const campusIds = opts.campusIds ?? (await allCampusIds());
    await prisma.staffCampus.createMany({
      data: campusIds.map((campusId) => ({
        userId: u.id,
        campusId,
        permissions: opts.manage?.includes(campusId) ? ["users.manage"] : [],
      })),
    });
  }
  return (await loadAppUser(u.id))!;
}
