import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseLocalDateTime } from "@/lib/time";
import { AUDIT_PAGE_SIZE, listAuditEvents, recordFailedSignIn, recordSignIn, recordSignOut } from "@/server/audit-log";
import { prisma } from "@/server/prisma";
import type { AppUser } from "@/server/roles";
import { createTicket, TicketError } from "@/server/tickets";
import { allCampusIds, makeUser } from "./fixtures";

const tag = `l${Date.now()}`;
let superadmin: AppUser, admin: AppUser, student: AppUser;
let topicId: string;

beforeAll(async () => {
  const [c1] = await allCampusIds();
  superadmin = await makeUser(tag, "LogSuper", "SUPERADMIN");
  admin = await makeUser(tag, "LogAdmin", "ADMIN");
  student = await makeUser(tag, "LogStudent", "USER", { campusId: c1 });
  topicId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } })).id;
});

afterAll(() => prisma.$disconnect());

// makeUser puts the name and tag in the email, so searching by it isolates one user's events.
const searchFor = (name: string) => `${name.toLowerCase()}-${tag}`;

describe("system log", () => {
  it("is superadmin-only", async () => {
    await expect(listAuditEvents(admin, { page: 0 })).rejects.toThrow(TicketError);
  });

  it("records sign-in, failed sign-in (which has no actor) and sign-out under the person", async () => {
    await recordSignIn(student.id, "password");
    await recordFailedSignIn(student.id, "password", "password");
    await recordSignOut(student.id);

    const { events, total } = await listAuditEvents(superadmin, { q: searchFor("LogStudent"), category: "auth", page: 0 });
    expect(total).toBe(3);
    expect(events.map((e) => e.action).sort()).toEqual(["auth.login", "auth.login_failed", "auth.logout"]);
    expect(events.find((e) => e.action === "auth.login_failed")?.actor).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: student.id } })).lastLoginAt).not.toBeNull();
  });

  it("filters by category and resolves ticket numbers", async () => {
    const t = await createTicket(student, { helpTopicId: topicId, subject: `Log ${tag}`, body: "x" });

    const tickets = await listAuditEvents(superadmin, { q: searchFor("LogStudent"), category: "ticket", page: 0 });
    expect(tickets.events.map((e) => e.action)).toEqual(["ticket.create"]);
    expect(tickets.events[0].ticketNumber).toBe(t.ticketNumber);

    const settings = await listAuditEvents(superadmin, { q: searchFor("LogStudent"), category: "settings", page: 0 });
    expect(settings.total).toBe(0);
  });

  it("limits to the date range, end day inclusive", async () => {
    const dated = await makeUser(tag, "LogDated", "USER");
    const at = (s: string) => parseLocalDateTime(s)!;
    for (const createdAt of [at("2020-01-01T08:00"), at("2020-01-02T23:30"), at("2020-01-03T00:30")]) {
      await prisma.auditEvent.create({ data: { actorId: dated.id, action: "auth.login", entityType: "user", entityId: dated.id, createdAt } });
    }

    const { total } = await listAuditEvents(superadmin, {
      q: searchFor("LogDated"),
      from: at("2020-01-01T00:00"),
      to: at("2020-01-03T00:00"),
      page: 0,
    });
    expect(total).toBe(2);
  });

  it("pages through results", async () => {
    const pager = await makeUser(tag, "LogPager", "USER");
    for (let i = 0; i <= AUDIT_PAGE_SIZE; i++) await recordSignOut(pager.id);

    const first = await listAuditEvents(superadmin, { q: searchFor("LogPager"), page: 0 });
    const second = await listAuditEvents(superadmin, { q: searchFor("LogPager"), page: 1 });
    expect(first.total).toBe(AUDIT_PAGE_SIZE + 1);
    expect(first.events).toHaveLength(AUDIT_PAGE_SIZE);
    expect(second.events).toHaveLength(1);
    expect(first.events.map((e) => e.id)).not.toContain(second.events[0].id);
  });
});
