import type { Role } from "@/generated/prisma/enums";
import type { Theme } from "@/lib/theme";

// "all" for superadmins; otherwise the campus ids the user works at / may manage users in.
export type CampusScope = "all" | string[];

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  departmentId: string | null;
  hasPassword: boolean;
  campusId: string | null; // home campus
  colorMode: Theme | null; // saved light/dark choice; null until they pick one
  campusScope: CampusScope; // campuses whose tickets they can work (staff only; [] for requesters)
  manageCampusIds: CampusScope; // campuses where they may manage users & agents
};

// Permissions a superadmin can grant a campus admin, per campus (StaffCampus.permissions).
export const CAMPUS_PERMISSIONS = {
  "users.manage": "Manage users & agents",
} as const;
export type CampusPermission = keyof typeof CAMPUS_PERMISSIONS;

export function isStaff(role: Role): boolean {
  return role === "AGENT" || role === "ADMIN" || role === "SUPERADMIN";
}

// Admins work the shared queues (unassigned, teams, overdue…). Agents only see their own open tickets.
export function hasFullQueue(role: Role): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export function isSuperadmin(user: Pick<AppUser, "role">): boolean {
  return user.role === "SUPERADMIN";
}

export function inScope(scope: CampusScope, campusId: string | null): boolean {
  return scope === "all" || (campusId !== null && scope.includes(campusId));
}

// Builds the scope fields from a user's role and StaffCampus rows.
export function campusAccess(role: Role, memberships: { campusId: string; permissions: string[] }[]) {
  if (role === "SUPERADMIN") return { campusScope: "all" as const, manageCampusIds: "all" as const };
  if (!isStaff(role)) return { campusScope: [], manageCampusIds: [] };
  return {
    campusScope: memberships.map((m) => m.campusId),
    manageCampusIds: role === "ADMIN" ? memberships.filter((m) => m.permissions.includes("users.manage")).map((m) => m.campusId) : [],
  };
}

// Requester and CC'd collaborators are the ticket's "participants".
export function isParticipant(userId: string, ticket: { requesterId: string; collaborators?: { userId: string }[] }): boolean {
  return ticket.requesterId === userId || (ticket.collaborators?.some((c) => c.userId === userId) ?? false);
}

// Participants always see their ticket; staff only when it belongs to one of their campuses.
export function canViewTicket(
  user: Pick<AppUser, "id" | "role" | "campusScope">,
  ticket: { requesterId: string; campusId: string | null; collaborators?: { userId: string }[] },
): boolean {
  return isParticipant(user.id, ticket) || (isStaff(user.role) && inScope(user.campusScope, ticket.campusId));
}

// Staff who may act on (reply to, update) a ticket: in scope for its campus.
export function canWorkTicket(user: Pick<AppUser, "role" | "campusScope">, ticket: { campusId: string | null }): boolean {
  return isStaff(user.role) && inScope(user.campusScope, ticket.campusId);
}
