import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { type AppUser, isStaff, isSuperadmin } from "@/server/roles";
import { loadAppUser } from "@/server/users";

export { type AppUser, canViewTicket, isStaff, isSuperadmin } from "@/server/roles";

// Re-read from the database on every request so role, campus and permission changes apply immediately.
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  return id ? loadAppUser(id) : null;
});

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireStaff(): Promise<AppUser> {
  const user = await requireUser();
  if (!isStaff(user.role)) redirect("/");
  return user;
}

// All shared settings (teams, topics, SLAs, canned, email, organizations, campuses, export).
export async function requireSuperadmin(): Promise<AppUser> {
  const user = await requireUser();
  if (!isSuperadmin(user)) redirect("/staff");
  return user;
}

export function canManageUsers(user: Pick<AppUser, "manageCampusIds">): boolean {
  return user.manageCampusIds === "all" || user.manageCampusIds.length > 0;
}

// The Users page: superadmins, and campus admins granted "Manage users & agents" somewhere.
export async function requireUserManager(): Promise<AppUser> {
  const user = await requireUser();
  if (!canManageUsers(user)) redirect("/staff");
  return user;
}
