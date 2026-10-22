import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listCannedFor, renderCanned, saveCanned } from "@/server/canned";
import { acquireLock, LOCK_TTL_MS, otherHolder, releaseLock } from "@/server/locks";
import { prisma } from "@/server/prisma";
import { makeUser as makeTestUser } from "./fixtures";
import type { AppUser } from "@/server/roles";
import { addTaskComment, createTask, listTasks, updateTask } from "@/server/tasks";
import {
  createTicket,
  findOrCreateRequester,
  linkTickets,
  mergeTickets,
  TicketError,
  unlinkTickets,
  updateTicketFields,
} from "@/server/tickets";

const tag = `a${Date.now()}`;
let student: AppUser, other: AppUser, agent: AppUser, agent2: AppUser, admin: AppUser;
let topicId: string, itSupportId: string, infraId: string;

const makeUser = (name: string, role: AppUser["role"]) => makeTestUser(tag, name, role);

const open = (who: AppUser, subject = "Help") => createTicket(who, { helpTopicId: topicId, subject, body: "details" });
const keep = (t: { status: any; priority: any; assignedTeamId: string | null; assignedAgentId: string | null }) => ({
  status: t.status,
  priority: t.priority,
  assignedTeamId: t.assignedTeamId,
  assignedAgentId: t.assignedAgentId,
});

beforeAll(async () => {
  student = await makeUser("Student", "USER");
  other = await makeUser("Other", "USER");
  agent = await makeUser("Agent", "AGENT");
  agent2 = await makeUser("Agenttwo", "AGENT");
  admin = await makeUser("Admin", "SUPERADMIN");
  topicId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } })).id;
  itSupportId = (await prisma.department.findUniqueOrThrow({ where: { name: "IT Support" } })).id;
  infraId = (await prisma.department.findUniqueOrThrow({ where: { name: "Infrastructure" } })).id;
});

afterAll(() => prisma.$disconnect());

describe("canned responses", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    const out = renderCanned("Hi {requester.firstName}, re {ticket.number}: {oops} — {agent.name}", {
      requesterName: "Sok Dara",
      ticketNumber: "TKT-000042",
      subject: "Wifi",
      agentName: "Sample Agent",
    });
    expect(out).toBe("Hi Sok, re TKT-000042: {oops} — Sample Agent");
  });

  it("offers global and same-department replies only, and only to staff", async () => {
    await saveCanned(admin, { id: null, title: `Global ${tag}`, body: "g", departmentId: null, isActive: true });
    await saveCanned(admin, { id: null, title: `Infra ${tag}`, body: "i", departmentId: infraId, isActive: true });
    await saveCanned(admin, { id: null, title: `Off ${tag}`, body: "o", departmentId: null, isActive: false });
    const titles = (await listCannedFor(agent, itSupportId)).map((c) => c.title);
    expect(titles).toContain(`Global ${tag}`);
    expect(titles).not.toContain(`Infra ${tag}`);
    expect(titles).not.toContain(`Off ${tag}`);
    expect(() => listCannedFor(student, itSupportId)).toThrow(TicketError);
    await expect(saveCanned(agent, { id: null, title: "x", body: "x", departmentId: null, isActive: true })).rejects.toThrow(TicketError);
    await expect(saveCanned(admin, { id: null, title: `Global ${tag}`, body: "dup", departmentId: null, isActive: true })).rejects.toThrow(
      "already exists",
    );
  });
});

describe("opening tickets on behalf of someone", () => {
  it("records the requester, source and who opened it", async () => {
    const t = await createTicket(agent, { helpTopicId: topicId, subject: "Phoned in", body: "Projector dead" }, [], {
      requesterId: student.id,
      source: "PHONE",
    });
    const full = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id }, include: { thread: true } });
    expect(full.requesterId).toBe(student.id);
    expect(full.source).toBe("PHONE");
    expect(full.thread.find((e) => e.type === "CLIENT_MESSAGE")?.authorId).toBe(student.id);
    expect(full.thread.some((e) => e.type === "SYSTEM_EVENT" && e.body.includes("(Phone)"))).toBe(true);
    expect(await prisma.auditEvent.count({ where: { entityId: t.id, action: "ticket.create", actorId: agent.id } })).toBe(1);
  });

  it("doesn't let requesters open tickets for others", async () => {
    await expect(
      createTicket(student, { helpTopicId: topicId, subject: "x", body: "x" }, [], { requesterId: other.id }),
    ).rejects.toThrow(TicketError);
  });

  it("finds existing requesters and creates new ones only with a name", async () => {
    expect((await findOrCreateRequester(agent, { email: student.email.toUpperCase() })).id).toBe(student.id);
    await expect(findOrCreateRequester(agent, { email: `new-${tag}@ciaschool.edu.kh` })).rejects.toThrow("Enter the person's name");
    const created = await findOrCreateRequester(agent, { email: `new-${tag}@ciaschool.edu.kh`, name: "New Kid" });
    expect(created).toMatchObject({ role: "USER", passwordHash: null });
    await expect(findOrCreateRequester(student, { email: "x@y.z", name: "x" })).rejects.toThrow(TicketError);
  });
});

describe("department transfer", () => {
  it("moves the ticket and logs it", async () => {
    const t = await open(student);
    await updateTicketFields(agent, t.ticketNumber, { ...keep(t), departmentId: infraId });
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id }, include: { thread: true } });
    expect(after.departmentId).toBe(infraId);
    expect(after.thread.some((e) => e.body === "Transferred from IT Support to Infrastructure")).toBe(true);
    expect(await prisma.auditEvent.count({ where: { entityId: t.id, action: "ticket.update" } })).toBe(1);
  });
});

describe("links and merges", () => {
  it("links both ways once, and unlinks", async () => {
    const a = await open(student, "A");
    const b = await open(other, "B");
    await linkTickets(agent, a.ticketNumber, b.ticketNumber);
    await expect(linkTickets(agent, b.ticketNumber, a.ticketNumber)).rejects.toThrow("already linked");
    await expect(linkTickets(agent, a.ticketNumber, a.ticketNumber)).rejects.toThrow("itself");
    await expect(linkTickets(student, a.ticketNumber, b.ticketNumber)).rejects.toThrow(TicketError);
    await unlinkTickets(agent, b.ticketNumber, a.ticketNumber);
    expect(await prisma.ticketLink.count({ where: { fromTicketId: a.id } })).toBe(0);
  });

  it("merges the same requester's duplicate into the target", async () => {
    const target = await open(student, "Target");
    const dup = await open(student, "Duplicate");
    await addTaskOn(dup.ticketNumber);
    await mergeTickets(agent, dup.ticketNumber, target.ticketNumber);

    const t = await prisma.ticket.findUniqueOrThrow({ where: { id: target.id }, include: { thread: true, tasks: true } });
    const d = await prisma.ticket.findUniqueOrThrow({ where: { id: dup.id }, include: { thread: true } });
    expect(t.thread.filter((e) => e.type === "CLIENT_MESSAGE")).toHaveLength(2);
    expect(t.tasks).toHaveLength(1);
    expect(d.status).toBe("CLOSED");
    expect(d.thread.map((e) => e.body)).toEqual([`Merged into ${target.ticketNumber}`]);
    await expect(mergeTickets(agent, dup.ticketNumber, target.ticketNumber)).rejects.toThrow("already been merged");
  });

  it("merging another requester's ticket CCs them on the target; refuses closed targets", async () => {
    const a = await open(student);
    const b = await open(other);
    await mergeTickets(agent, a.ticketNumber, b.ticketNumber);
    expect(await prisma.ticketCollaborator.findMany({ where: { ticketId: b.id } })).toEqual([
      expect.objectContaining({ userId: student.id }),
    ]);
    const closed = await open(student);
    await updateTicketFields(agent, closed.ticketNumber, { ...keep(closed), status: "CLOSED" });
    const c = await open(student);
    await expect(mergeTickets(agent, c.ticketNumber, closed.ticketNumber)).rejects.toThrow("is closed");
  });
});

async function addTaskOn(ticketNumber: string) {
  return createTask(agent, { ticketNumber, title: "Check AP", description: null, assignedAgentId: null, assignedTeamId: null, dueAt: null });
}

describe("collision locks", () => {
  it("warns the second agent, keeps the first holder's start time, and expires", async () => {
    const t = await open(student);
    const t0 = new Date();
    expect(await acquireLock(agent, t.id, t0)).toBeNull();
    const held = await acquireLock(agent2, t.id, new Date(t0.getTime() + 1000));
    expect(held).toMatchObject({ agentId: agent.id, agentName: "Agent" });

    await acquireLock(agent, t.id, new Date(t0.getTime() + 60_000));
    const lock = await prisma.ticketLock.findUniqueOrThrow({ where: { ticketId: t.id } });
    expect(lock.acquiredAt.getTime()).toBe(t0.getTime());

    const later = new Date(t0.getTime() + 60_000 + LOCK_TTL_MS + 1);
    expect(await acquireLock(agent2, t.id, later)).toBeNull();
    expect(await otherHolder(agent.id, t.id, later)).toMatchObject({ agentId: agent2.id });

    await releaseLock(agent2, t.id);
    expect(await otherHolder(agent.id, t.id)).toBeNull();
    expect(await acquireLock(student, t.id)).toBeNull();
    expect(await prisma.ticketLock.count({ where: { ticketId: t.id } })).toBe(0);
  });
});

describe("tasks", () => {
  it("logs on the ticket, checks assignees, closes and reopens", async () => {
    const t = await open(student);
    await expect(
      createTask(agent, { ticketNumber: t.ticketNumber, title: "x", description: null, assignedAgentId: student.id, assignedTeamId: null, dueAt: null }),
    ).rejects.toThrow("active agents");
    await expect(
      createTask(student, { title: "x", description: null, assignedAgentId: null, assignedTeamId: null, dueAt: null }),
    ).rejects.toThrow(TicketError);

    const task = await createTask(agent, {
      ticketNumber: t.ticketNumber.toLowerCase(),
      title: "Replace AP-3",
      description: "Bring a spare",
      assignedAgentId: agent2.id,
      assignedTeamId: null,
      dueAt: new Date(Date.now() + 86_400_000),
    });
    expect((await listTasks(agent2, "mine")).map((x) => x.id)).toContain(task.id);

    await addTaskComment(agent2, task.id, "Ordered the spare");
    const input = { title: task.title, description: task.description, assignedAgentId: agent2.id, assignedTeamId: null, dueAt: task.dueAt };
    const done = await updateTask(agent2, task.id, { ...input, status: "CLOSED" });
    expect(done.closedAt).not.toBeNull();
    expect((await listTasks(agent2, "mine")).map((x) => x.id)).not.toContain(task.id);
    expect((await listTasks(agent2, "done")).map((x) => x.id)).toContain(task.id);
    const reopened = await updateTask(agent2, task.id, { ...input, status: "OPEN" });
    expect(reopened.closedAt).toBeNull();

    const events = (await prisma.ticketThread.findMany({ where: { ticketId: t.id, type: "SYSTEM_EVENT" } })).map((e) => e.body);
    expect(events).toEqual(expect.arrayContaining(["Task added: Replace AP-3", "Task completed: Replace AP-3", "Task reopened: Replace AP-3"]));
  });
});
