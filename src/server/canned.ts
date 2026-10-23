import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { prisma } from "@/server/prisma";
import { type AppUser, isStaff } from "@/server/roles";
import { TicketError } from "@/server/tickets";

// Placeholders agents can use in canned replies.
export const CANNED_VARIABLES = ["{requester.name}", "{requester.firstName}", "{ticket.number}", "{ticket.subject}", "{agent.name}"] as const;

export function renderCanned(
  body: string,
  ctx: { requesterName: string; ticketNumber: string; subject: string; agentName: string },
): string {
  const values: Record<string, string> = {
    "requester.name": ctx.requesterName,
    "requester.firstName": ctx.requesterName.split(/\s+/)[0] ?? ctx.requesterName,
    "ticket.number": ctx.ticketNumber,
    "ticket.subject": ctx.subject,
    "agent.name": ctx.agentName,
  };
  // Unknown placeholders are left as typed so mistakes are visible before sending.
  return body.replace(/\{([a-zA-Z.]+)\}/g, (match, key: string) => values[key] ?? match);
}

// Active replies usable on a ticket in `departmentId`: global ones plus that department's.
export function listCannedFor(actor: Pick<AppUser, "role">, departmentId: string) {
  if (!isStaff(actor.role)) throw new TicketError("Not allowed.");
  return prisma.cannedResponse.findMany({
    where: { isActive: true, OR: [{ departmentId: null }, { departmentId }] },
    orderBy: { title: "asc" },
    select: { id: true, title: true, body: true },
  });
}

export async function saveCanned(
  actor: AppUser,
  input: { id: string | null; title: string; body: string; departmentId: string | null; isActive: boolean },
) {
  if (actor.role !== "SUPERADMIN") throw new TicketError("Not allowed.");
  const { id, ...data } = input;
  try {
    return await prisma.$transaction(async (tx) => {
      const row = id
        ? await tx.cannedResponse.update({ where: { id }, data })
        : await tx.cannedResponse.create({ data: { ...data, createdById: actor.id } });
      await audit(tx, actor, "canned.save", { type: "canned", id: row.id }, { title: row.title });
      return row;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new TicketError("A canned response with that title already exists.");
    }
    throw err;
  }
}

// Deactivates rather than deletes, like the other admin settings.
export async function deleteCanned(actor: AppUser, id: string) {
  if (actor.role !== "SUPERADMIN") throw new TicketError("Not allowed.");
  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.cannedResponse.update({ where: { id }, data: { isActive: false } });
      await audit(tx, actor, "canned.delete", { type: "canned", id }, { title: row.title });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") throw new TicketError("Not found.");
    throw err;
  }
}
