import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/prisma";
import { parseQueueParams } from "@/server/queue-params";
import type { AppUser } from "@/server/roles";
import { BULK_LIMIT, bulkUpdateTickets, createTicket, listQueue, TicketError } from "@/server/tickets";
import { bulkUpdateSchema } from "@/server/validation";
import { allCampusIds, makeUser } from "./fixtures";

const tag = `b${Date.now()}`;
let c1: string, c2: string;
let admin: AppUser, agentA: AppUser, agentB: AppUser, studentA: AppUser, studentB: AppUser;
let topicId: string;

beforeAll(async () => {
  [c1, c2] = await allCampusIds();
  admin = await makeUser(tag, "BulkAdmin", "ADMIN", { campusIds: [c1] });
  agentA = await makeUser(tag, "BulkAgentA", "AGENT", { campusIds: [c1] });
  agentB = await makeUser(tag, "BulkAgentB", "AGENT", { campusIds: [c2] });
  studentA = await makeUser(tag, "BulkStudentA", "USER", { campusId: c1 });
  studentB = await makeUser(tag, "BulkStudentB", "USER", { campusId: c2 });
  topicId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } })).id;
});

afterAll(() => prisma.$disconnect());

const open = (who: AppUser, subject: string) => createTicket(who, { helpTopicId: topicId, subject, body: "help" });

describe("bulk queue actions", () => {
  it("updates every ticket with a system event and an audit row each", async () => {
    const a = await open(studentA, `Bulk one ${tag}`);
    const b = await open(studentA, `Bulk two ${tag}`);
    const result = await bulkUpdateTickets(admin, [a.ticketNumber, b.ticketNumber], { priority: "HIGH" });
    expect(result).toEqual({ updated: 2, skipped: [] });

    for (const t of [a, b]) {
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).priority).toBe("HIGH");
      expect(await prisma.ticketThread.count({ where: { ticketId: t.id, type: "SYSTEM_EVENT", body: { contains: "Priority changed" } } })).toBe(1);
      expect(await prisma.auditEvent.count({ where: { entityId: t.id, action: "ticket.update" } })).toBe(1);
    }
  });

  it("keeps the other fields of each ticket", async () => {
    const t = await open(studentA, `Bulk keep ${tag}`);
    await bulkUpdateTickets(admin, [t.ticketNumber], { assignedAgentId: agentA.id });
    await bulkUpdateTickets(admin, [t.ticketNumber], { status: "IN_PROGRESS" });
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.assignedAgentId).toBe(agentA.id);
    expect(after.status).toBe("IN_PROGRESS");
  });

  it("skips tickets at a campus the actor doesn't work, with a reason", async () => {
    const mine = await open(studentA, `Bulk mine ${tag}`);
    const other = await open(studentB, `Bulk other ${tag}`);
    const result = await bulkUpdateTickets(admin, [mine.ticketNumber, other.ticketNumber], { status: "RESOLVED" });
    expect(result.updated).toBe(1);
    expect(result.skipped).toEqual([{ ticketNumber: other.ticketNumber, reason: "Ticket not found." }]);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: other.id } })).status).toBe("OPEN");
  });

  it("won't assign to an agent who doesn't work at the ticket's campus", async () => {
    const t = await open(studentA, `Bulk wrong agent ${tag}`);
    const result = await bulkUpdateTickets(admin, [t.ticketNumber], { assignedAgentId: agentB.id });
    expect(result.updated).toBe(0);
    expect(result.skipped[0].reason).toMatch(/work at the ticket's campus/);
  });

  it("rejects requesters, empty selections and oversized ones", async () => {
    const t = await open(studentA, `Bulk guard ${tag}`);
    await expect(bulkUpdateTickets(studentA, [t.ticketNumber], { status: "CLOSED" })).rejects.toThrow(TicketError);
    await expect(bulkUpdateTickets(admin, [], { status: "CLOSED" })).rejects.toThrow(/at least one/);
    const many = Array.from({ length: BULK_LIMIT + 1 }, (_, i) => `TKT-${String(900000 + i).padStart(6, "0")}`);
    await expect(bulkUpdateTickets(admin, many, { status: "CLOSED" })).rejects.toThrow(/at most/);
  });

  it("validates the form payload", () => {
    expect(bulkUpdateSchema.safeParse({ tickets: ["TKT-000001"], field: "agent", value: "me" }).success).toBe(true);
    expect(bulkUpdateSchema.safeParse({ tickets: ["TKT-000001"], field: "status", value: "DONE" }).success).toBe(false);
    expect(bulkUpdateSchema.safeParse({ tickets: ["nope"], field: "priority", value: "LOW" }).success).toBe(false);
    const team = bulkUpdateSchema.safeParse({ tickets: ["TKT-000001"], field: "team", value: "" });
    expect(team.success && team.data.value).toBe(null);
  });
});

describe("queue sort", () => {
  it("parses only known sorts", () => {
    expect(parseQueueParams({ sort: "newest" }).sort).toBe("newest");
    expect(parseQueueParams({ sort: "bogus" }).sort).toBeUndefined();
  });

  it("orders newest first when asked", async () => {
    const older = await open(studentA, `Sort older ${tag}`);
    const newer = await open(studentA, `Sort newer ${tag}`);
    const { tickets } = await listQueue(admin, { view: "all", q: tag, sort: "newest" });
    const numbers = tickets.map((t) => t.ticketNumber);
    expect(numbers.indexOf(newer.ticketNumber)).toBeGreaterThanOrEqual(0);
    expect(numbers.indexOf(newer.ticketNumber)).toBeLessThan(numbers.indexOf(older.ticketNumber));
  });
});
