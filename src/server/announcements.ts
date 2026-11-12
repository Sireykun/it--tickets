import { Prisma } from "@/generated/prisma/client";
import { ANNOUNCEMENT_LEVELS, type AnnouncementLevel } from "@/lib/announcements";
import { audit } from "@/server/audit";
import { prisma } from "@/server/prisma";
import { type AppUser, isStaff } from "@/server/roles";
import { TicketError } from "@/server/tickets";

// Notices the actor should see now: active, not yet ended, and either for every campus or for one of
// theirs (a requester's home campus, the campuses a staff member works at, all for superadmins).
export async function listAnnouncementsFor(actor: Pick<AppUser, "role" | "campusId" | "campusScope">, now = new Date()) {
  const ownCampusIds = isStaff(actor.role) ? actor.campusScope : actor.campusId ? [actor.campusId] : [];
  const rows = await prisma.announcement.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ...(ownCampusIds === "all" ? [] : [{ OR: [{ campusId: null }, { campusId: { in: ownCampusIds } }] }]),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, level: true, endsAt: true, createdAt: true, campus: { select: { name: true } } },
  });
  // Most serious first; the sort is stable, so the newest stays on top within a level.
  return rows
    .map((row) => ({ ...row, level: row.level as AnnouncementLevel }))
    .sort((a, b) => ANNOUNCEMENT_LEVELS.indexOf(b.level) - ANNOUNCEMENT_LEVELS.indexOf(a.level));
}

export async function saveAnnouncement(
  actor: AppUser,
  input: { id: string | null; title: string; body: string; level: AnnouncementLevel; campusId: string | null; endsAt: Date | null; isActive: boolean },
) {
  if (actor.role !== "SUPERADMIN") throw new TicketError("Not allowed.");
  const { id, ...data } = input;
  try {
    return await prisma.$transaction(async (tx) => {
      const row = id
        ? await tx.announcement.update({ where: { id }, data })
        : await tx.announcement.create({ data: { ...data, createdById: actor.id } });
      await audit(tx, actor, "announcement.save", { type: "announcement", id: row.id }, { title: row.title, level: row.level });
      return row;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") throw new TicketError("Not found.");
    throw err;
  }
}

// Takes the notice down rather than deleting it, like the other admin settings.
export async function deleteAnnouncement(actor: AppUser, id: string) {
  if (actor.role !== "SUPERADMIN") throw new TicketError("Not allowed.");
  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.announcement.update({ where: { id }, data: { isActive: false } });
      await audit(tx, actor, "announcement.delete", { type: "announcement", id }, { title: row.title });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") throw new TicketError("Not found.");
    throw err;
  }
}
