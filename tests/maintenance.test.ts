import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { retryFailedEmails } from "@/server/admin";
import { alertOverdueTickets, purgeExpiredLocks } from "@/server/maintenance";
import { prisma } from "@/server/prisma";
import type { AppUser } from "@/server/roles";
import { createTicket, TicketError } from "@/server/tickets";
import { makeUser as makeTestUser } from "./fixtures";

const tag = `m${Date.now()}`;
const HOUR = 60 * 60 * 1000;
let student: AppUser, agent: AppUser, admin: AppUser;
let wifiTopicId: string, teamId: string;

const makeUser = (name: string, role: AppUser["role"]) => makeTestUser(tag, name, role);
const overdueMail = (ticketId: string) => prisma.emailOutbox.findMany({ where: { ticketId, templateKey: "ticket.overdue" } });

// Other test files may leave overdue tickets behind, so sweep until nothing is left to claim.
async function sweep() {
  for (let i = 0; i < 20 && (await alertOverdueTickets()) > 0; i++);
}

async function openTicket(due: { firstResponseDueAt?: Date | null; resolutionDueAt?: Date | null; firstRespondedAt?: Date | null; status?: "OPEN" | "RESOLVED" }) {
  const t = await createTicket(student, { helpTopicId: wifiTopicId, subject: "Wifi down", body: "No signal" });
  return prisma.ticket.update({ where: { id: t.id }, data: { assignedTeamId: teamId, ...due } });
}

beforeAll(async () => {
  student = await makeUser("Student", "USER");
  agent = await makeUser("Agent", "AGENT");
  admin = await makeUser("Admin", "SUPERADMIN");
  wifiTopicId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } })).id;
  teamId = (await prisma.team.create({ data: { name: `Team ${tag}`, members: { create: [{ userId: agent.id }] } } })).id;
});

afterAll(() => prisma.$disconnect());

describe("SLA overdue alerts", () => {
  it("alerts the team once when the first response is overdue", async () => {
    const t = await openTicket({ firstResponseDueAt: new Date(Date.now() - HOUR) });
    await sweep();
    await sweep();

    const mails = await overdueMail(t.id);
    expect(mails.map((m) => m.toAddress)).toEqual([agent.email]);
    expect(mails[0].textBody).toContain("First response was due");
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.responseOverdueAlertedAt).not.toBeNull();
    expect(after.resolutionOverdueAlertedAt).toBeNull();
    expect(await prisma.auditEvent.count({ where: { entityId: t.id, action: "ticket.sla_overdue" } })).toBe(1);
  });

  it("alerts on the resolution timer once the ticket has a response", async () => {
    const t = await openTicket({
      firstResponseDueAt: new Date(Date.now() - 3 * HOUR),
      firstRespondedAt: new Date(Date.now() - 2 * HOUR),
      resolutionDueAt: new Date(Date.now() - HOUR),
    });
    await sweep();

    const mails = await overdueMail(t.id);
    expect(mails).toHaveLength(1);
    expect(mails[0].textBody).toContain("Resolution was due");
  });

  it("does not alert while the response timer is still running", async () => {
    const t = await openTicket({ firstResponseDueAt: new Date(Date.now() + HOUR), resolutionDueAt: new Date(Date.now() - HOUR) });
    await sweep();
    expect(await overdueMail(t.id)).toHaveLength(0);
  });

  it("ignores resolved tickets", async () => {
    const t = await openTicket({ status: "RESOLVED", firstResponseDueAt: new Date(Date.now() - HOUR) });
    await sweep();
    expect(await overdueMail(t.id)).toHaveLength(0);
  });
});

describe("lock cleanup", () => {
  it("deletes locks that expired over an hour ago and keeps recent ones", async () => {
    const old = await openTicket({});
    const recent = await openTicket({});
    await prisma.ticketLock.createMany({
      data: [
        { ticketId: old.id, agentId: agent.id, expiresAt: new Date(Date.now() - 2 * HOUR) },
        { ticketId: recent.id, agentId: agent.id, expiresAt: new Date(Date.now() - 60_000) },
      ],
    });
    await purgeExpiredLocks();
    expect(await prisma.ticketLock.findUnique({ where: { ticketId: old.id } })).toBeNull();
    expect(await prisma.ticketLock.findUnique({ where: { ticketId: recent.id } })).not.toBeNull();
  });
});

describe("retrying failed email", () => {
  const failed = (to: string) =>
    prisma.emailOutbox.create({
      data: { toAddress: to, subject: "x", textBody: "x", htmlBody: "x", messageId: `<${to}-${tag}@test>`, status: "FAILED", attempts: 5, lastError: "boom" },
    });

  it("lets a superadmin requeue one failed email with fresh attempts", async () => {
    const one = await failed(`one-${tag}@ciaschool.edu.kh`);
    const other = await failed(`two-${tag}@ciaschool.edu.kh`);
    expect(await retryFailedEmails(admin, one.id)).toBe(1);

    expect(await prisma.emailOutbox.findUniqueOrThrow({ where: { id: one.id } })).toMatchObject({ status: "PENDING", attempts: 0 });
    expect((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: other.id } })).status).toBe("FAILED");
    expect(await prisma.auditEvent.count({ where: { entityId: one.id, action: "email.retry" } })).toBe(1);
  });

  it("requeues every failed email at once", async () => {
    const a = await failed(`three-${tag}@ciaschool.edu.kh`);
    await retryFailedEmails(admin);
    expect((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("PENDING");
    expect(await prisma.emailOutbox.count({ where: { status: "FAILED" } })).toBe(0);
  });

  it("is superadmin-only", async () => {
    await expect(retryFailedEmails(agent)).rejects.toThrow(TicketError);
  });
});
