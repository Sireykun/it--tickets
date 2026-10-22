import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { normalizeEmail } from "@/server/auth-rules";
import { prisma } from "@/server/prisma";
import { type AppUser, campusAccess } from "@/server/roles";

type Db = Prisma.TransactionClient | typeof prisma;

// Most specific organization whose domains match the email, e.g. "staff.ciaschool.edu.kh"
// beats "ciaschool.edu.kh".
export async function matchOrganization(db: Db, email: string): Promise<string | null> {
  const domain = normalizeEmail(email).split("@")[1];
  if (!domain) return null;
  const orgs = await db.organization.findMany({ where: { isActive: true, domains: { isEmpty: false } }, select: { id: true, domains: true } });
  let best: { id: string; len: number } | null = null;
  for (const org of orgs) {
    for (const d of org.domains) {
      const dom = d.toLowerCase().replace(/^@/, "");
      if ((domain === dom || domain.endsWith(`.${dom}`)) && (!best || dom.length > best.len)) best = { id: org.id, len: dom.length };
    }
  }
  return best?.id ?? null;
}

function domainMatches(domain: string, candidates: string[]): number {
  let best = -1;
  for (const d of candidates) {
    const dom = d.toLowerCase().replace(/^@/, "");
    if ((domain === dom || domain.endsWith(`.${dom}`)) && dom.length > best) best = dom.length;
  }
  return best;
}

// Home campus for a new user: most specific email-domain match, else null.
export async function matchCampus(db: Db, email: string): Promise<string | null> {
  const domain = normalizeEmail(email).split("@")[1];
  if (!domain) return null;
  const campuses = await db.campus.findMany({ where: { isActive: true, emailDomains: { isEmpty: false } }, select: { id: true, emailDomains: true } });
  let best: { id: string; len: number } | null = null;
  for (const c of campuses) {
    const len = domainMatches(domain, c.emailDomains);
    if (len >= 0 && (!best || len > best.len)) best = { id: c.id, len };
  }
  return best?.id ?? null;
}

// Campus for a new ticket: the requester's home campus, else a domain match, else the first active campus.
export async function campusForRequester(db: Db, requester: { campusId: string | null; email: string }): Promise<string | null> {
  if (requester.campusId) return requester.campusId;
  return (
    (await matchCampus(db, requester.email)) ??
    (await db.campus.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ??
    null
  );
}

// Loads a user with their campus scope. Null if missing or deactivated.
export async function loadAppUser(id: string): Promise<AppUser | null> {
  const user = await prisma.user.findUnique({ where: { id }, include: { staffCampuses: true } });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
    hasPassword: user.passwordHash !== null,
    campusId: user.campusId,
    ...campusAccess(user.role, user.staffCampuses),
  };
}

// Returns the existing user for `email`, or creates a password-less requester.
// `created` tells callers whether this was a new account.
export async function ensureUser(
  input: { email: string; name?: string | null },
  ctx: { actorId: string | null; via: string },
): Promise<{ user: Prisma.UserGetPayload<object>; created: boolean }> {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { user: existing, created: false };

  const name = input.name?.trim() || email.split("@")[0];
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name, organizationId: await matchOrganization(tx, email), campusId: await matchCampus(tx, email) },
    });
    await audit(tx, ctx.actorId ? { id: ctx.actorId } : null, "user.create", { type: "user", id: user.id }, { email, via: ctx.via });
    return { user, created: true };
  });
}
