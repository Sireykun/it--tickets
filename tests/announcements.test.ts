import { beforeAll, describe, expect, it } from "vitest";
import { deleteAnnouncement, listAnnouncementsFor, saveAnnouncement } from "@/server/announcements";
import { prisma } from "@/server/prisma";
import type { AppUser } from "@/server/roles";
import { TicketError } from "@/server/tickets";
import { allCampusIds, makeUser } from "./fixtures";

const tag = `an${Date.now()}`;
let superadmin: AppUser, campusAdmin: AppUser, agentAtSecond: AppUser, studentAtFirst: AppUser, studentAtSecond: AppUser;
let firstCampus: string, secondCampus: string;

const draft = (title: string, extra: Partial<Parameters<typeof saveAnnouncement>[1]> = {}) => ({
  id: null,
  title: `${title} ${tag}`,
  body: "Details.",
  level: "info" as const,
  campusId: null,
  endsAt: null,
  isActive: true,
  ...extra,
});

// Other test files may leave notices behind, so only look at this run's.
const titlesFor = async (actor: AppUser, now?: Date) =>
  (await listAnnouncementsFor(actor, now)).filter((a) => a.title.endsWith(tag)).map((a) => a.title.replace(` ${tag}`, ""));

beforeAll(async () => {
  [firstCampus, secondCampus] = await allCampusIds();
  superadmin = await makeUser(tag, "Notice Super", "SUPERADMIN");
  campusAdmin = await makeUser(tag, "Notice Admin", "ADMIN", { campusIds: [firstCampus], manage: [firstCampus] });
  agentAtSecond = await makeUser(tag, "Notice Agent", "AGENT", { campusIds: [secondCampus] });
  studentAtFirst = await makeUser(tag, "Notice Student One", "USER", { campusId: firstCampus });
  studentAtSecond = await makeUser(tag, "Notice Student Two", "USER", { campusId: secondCampus });
});

describe("announcements", () => {
  it("lets only superadmins post or take down a notice", async () => {
    const posted = await saveAnnouncement(superadmin, draft("Guarded"));
    for (const actor of [campusAdmin, agentAtSecond, studentAtFirst]) {
      await expect(saveAnnouncement(actor, draft("Nope"))).rejects.toThrow(TicketError);
      await expect(deleteAnnouncement(actor, posted.id)).rejects.toThrow(TicketError);
    }
    expect(await titlesFor(studentAtFirst)).toContain("Guarded");
  });

  it("shows a campus notice only to that campus, and an all-campus notice to everyone", async () => {
    await saveAnnouncement(superadmin, draft("Everywhere"));
    await saveAnnouncement(superadmin, draft("First only", { campusId: firstCampus }));

    expect(await titlesFor(studentAtFirst)).toEqual(expect.arrayContaining(["Everywhere", "First only"]));
    expect(await titlesFor(campusAdmin)).toContain("First only");
    expect(await titlesFor(superadmin)).toContain("First only");

    const seenAtSecond = [...(await titlesFor(studentAtSecond)), ...(await titlesFor(agentAtSecond))];
    expect(seenAtSecond).toContain("Everywhere");
    expect(seenAtSecond).not.toContain("First only");
  });

  it("hides a notice once it has ended or been taken down", async () => {
    const endsAt = new Date("2030-01-01T10:00:00Z");
    await saveAnnouncement(superadmin, draft("Timed", { endsAt }));
    const takenDown = await saveAnnouncement(superadmin, draft("Taken down"));

    expect(await titlesFor(studentAtFirst, new Date("2030-01-01T09:59:00Z"))).toContain("Timed");
    expect(await titlesFor(studentAtFirst, new Date("2030-01-01T10:00:00Z"))).not.toContain("Timed");

    await deleteAnnouncement(superadmin, takenDown.id);
    expect(await titlesFor(studentAtFirst)).not.toContain("Taken down");
    await expect(deleteAnnouncement(superadmin, "00000000-0000-7000-8000-000000000000")).rejects.toThrow(TicketError);
  });

  it("lists the most serious notice first", async () => {
    await saveAnnouncement(superadmin, draft("Rank info", { level: "info" }));
    await saveAnnouncement(superadmin, draft("Rank outage", { level: "outage" }));
    await saveAnnouncement(superadmin, draft("Rank warning", { level: "warning" }));
    const ranked = (await titlesFor(studentAtFirst)).filter((t) => t.startsWith("Rank"));
    expect(ranked).toEqual(["Rank outage", "Rank warning", "Rank info"]);
  });

  it("records who posted, edited and took down a notice", async () => {
    const posted = await saveAnnouncement(superadmin, draft("Audited", { level: "warning" }));
    await saveAnnouncement(superadmin, { ...draft("Audited", { level: "outage" }), id: posted.id });
    await deleteAnnouncement(superadmin, posted.id);

    const events = await prisma.auditEvent.findMany({ where: { entityType: "announcement", entityId: posted.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => [e.action, e.actorId])).toEqual([
      ["announcement.save", superadmin.id],
      ["announcement.save", superadmin.id],
      ["announcement.delete", superadmin.id],
    ]);
    expect((events[1].data as { level: string }).level).toBe("outage");
    expect((await prisma.announcement.findUniqueOrThrow({ where: { id: posted.id } })).createdById).toBe(superadmin.id);
  });
});
