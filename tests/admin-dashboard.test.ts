import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAdminDashboard } from "@/server/admin-dashboard";
import { prisma } from "@/server/prisma";
import type { AppUser } from "@/server/roles";
import { createTicket, TicketError } from "@/server/tickets";
import { allCampusIds, makeUser } from "./fixtures";

const tag = `d${Date.now()}`;
let c1: string;
let campusName: string;
let superadmin: AppUser, admin: AppUser, agent: AppUser, student: AppUser;
let topicId: string;

beforeAll(async () => {
  [c1] = await allCampusIds();
  campusName = (await prisma.campus.findUniqueOrThrow({ where: { id: c1 } })).name;
  superadmin = await makeUser(tag, "DashSuper", "SUPERADMIN");
  admin = await makeUser(tag, "DashAdmin", "ADMIN");
  agent = await makeUser(tag, "DashAgent", "AGENT");
  student = await makeUser(tag, "DashStudent", "USER", { campusId: c1 });
  topicId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } })).id;
});

afterAll(() => prisma.$disconnect());

describe("admin dashboard", () => {
  it("is superadmin-only", async () => {
    await expect(getAdminDashboard(admin)).rejects.toThrow(TicketError);
    await expect(getAdminDashboard(agent)).rejects.toThrow(TicketError);
  });

  it("counts a new open ticket as open, unassigned and at its campus, and as overdue once past due", async () => {
    const before = await getAdminDashboard(superadmin);
    const t = await createTicket(student, { helpTopicId: topicId, subject: `Dash ${tag}`, body: "x" });
    const after = await getAdminDashboard(superadmin);
    const campusCount = (d: typeof before) => d.campuses.find((c) => c.name === campusName)?.open ?? 0;

    expect(after.tickets.open).toBe(before.tickets.open + 1);
    expect(after.tickets.unassigned).toBe(before.tickets.unassigned + 1);
    expect(after.tickets.createdDay).toBe(before.tickets.createdDay + 1);
    expect(campusCount(after)).toBe(campusCount(before) + 1);

    await prisma.ticket.update({ where: { id: t.id }, data: { firstResponseDueAt: new Date(Date.now() - 60_000) } });
    expect((await getAdminDashboard(superadmin)).tickets.overdue).toBe(after.tickets.overdue + 1);
  });

  it("counts active users by role and leaves inactive ones out", async () => {
    const before = await getAdminDashboard(superadmin);
    await makeUser(tag, "DashAgent2", "AGENT");
    const inactive = await makeUser(tag, "DashGone", "AGENT");
    await prisma.user.update({ where: { id: inactive.id }, data: { isActive: false } });
    const after = await getAdminDashboard(superadmin);

    expect(after.people.activeByRole.AGENT).toBe((before.people.activeByRole.AGENT ?? 0) + 1);
    expect(after.people.inactive).toBe(before.people.inactive + 1);
  });

  it("lists recent activity with only the actor's name", async () => {
    await createTicket(student, { helpTopicId: topicId, subject: `Audit ${tag}`, body: "x" });
    const { activity } = await getAdminDashboard(superadmin);
    expect(activity.length).toBeGreaterThan(0);
    expect(Object.keys(activity[0].actor ?? { name: "" })).toEqual(["name"]);
  });
});
