import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { APP_TIME_ZONE } from "@/lib/time";
import { prisma } from "@/server/prisma";
import { getReport } from "@/server/reports";
import type { AppUser } from "@/server/roles";
import { createTicket, TicketError, updateTicketFields } from "@/server/tickets";
import { allCampusIds, makeUser } from "./fixtures";

const tag = `r${Date.now()}`;
let c1: string, c2: string;
let superadmin: AppUser, admin: AppUser, studentA: AppUser, studentB: AppUser, agent: AppUser;
let topicId: string;

const schoolDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

beforeAll(async () => {
  [c1, c2] = await allCampusIds();
  superadmin = await makeUser(tag, "RepSuper", "SUPERADMIN");
  admin = await makeUser(tag, "RepAdmin", "ADMIN");
  agent = await makeUser(tag, "RepAgent", "AGENT", { campusIds: [c1, c2] });
  studentA = await makeUser(tag, "RepStudentA", "USER", { campusId: c1 });
  studentB = await makeUser(tag, "RepStudentB", "USER", { campusId: c2 });
  topicId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } })).id;
});

afterAll(() => prisma.$disconnect());

describe("reports", () => {
  it("is superadmin-only", async () => {
    await expect(getReport(admin, { days: 7 })).rejects.toThrow(TicketError);
  });

  it("counts new and resolved tickets, scoped to a campus when asked", async () => {
    const before = await getReport(superadmin, { days: 7, campusId: c1 });
    const beforeOther = await getReport(superadmin, { days: 7, campusId: c2 });

    const t = await createTicket(studentA, { helpTopicId: topicId, subject: `Report ${tag}`, body: "x" });
    await updateTicketFields(superadmin, t.ticketNumber, { status: "RESOLVED", priority: t.priority, assignedTeamId: null, assignedAgentId: agent.id });

    const after = await getReport(superadmin, { days: 7, campusId: c1 });
    const afterOther = await getReport(superadmin, { days: 7, campusId: c2 });
    expect(after.totals.created).toBe(before.totals.created + 1);
    expect(after.totals.resolved).toBe(before.totals.resolved + 1);
    expect(afterOther.totals.created).toBe(beforeOther.totals.created);
    expect(after.agents.find((a) => a.id === agent.id)?.resolved).toBe(1);
    expect(afterOther.agents.find((a) => a.id === agent.id)).toBeUndefined();
  });

  it("buckets days in the school's timezone", async () => {
    const report = await getReport(superadmin, { days: 7 });
    expect(report.daily).toHaveLength(7);
    expect(report.daily.at(-1)?.day).toBe(schoolDay(new Date()));

    // 23:30 UTC is already the next morning at school (Phnom Penh is UTC+7).
    const lateUtc = new Date();
    lateUtc.setUTCDate(lateUtc.getUTCDate() - 2);
    lateUtc.setUTCHours(23, 30, 0, 0);
    const dayCount = async () => (await getReport(superadmin, { days: 7, campusId: c2 })).daily.find((d) => d.day === schoolDay(lateUtc))?.created ?? 0;

    const t = await createTicket(studentB, { helpTopicId: topicId, subject: `Late ${tag}`, body: "x" });
    const before = await dayCount();
    await prisma.ticket.update({ where: { id: t.id }, data: { createdAt: lateUtc } });
    expect(await dayCount()).toBe(before + 1);
  });

  it("counts a missed first-response SLA and an overdue ticket", async () => {
    const before = await getReport(superadmin, { days: 7, campusId: c2 });
    const t = await createTicket(studentB, { helpTopicId: topicId, subject: `Breach ${tag}`, body: "x" });
    await prisma.ticket.update({ where: { id: t.id }, data: { firstResponseDueAt: new Date(Date.now() - 60_000) } });
    const after = await getReport(superadmin, { days: 7, campusId: c2 });
    expect(after.totals.breached).toBe(before.totals.breached + 1);
    expect(after.totals.overdueNow).toBe(before.totals.overdueNow + 1);
  });
});
