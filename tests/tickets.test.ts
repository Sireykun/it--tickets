import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveUser } from "@/server/admin";
import { prisma } from "@/server/prisma";
import { makeUser as makeTestUser } from "./fixtures";
import type { AppUser } from "@/server/roles";
import { prepareUploads } from "@/server/storage";
import {
  addMessage,
  closeAsRequester,
  createTicket,
  getAttachmentForViewer,
  getTicketForViewer,
  listQueue,
  type QueueView,
  queueCounts,
  TicketError,
  updateTicketFields,
} from "@/server/tickets";

const tag = `t${Date.now()}`;
let alice: AppUser, bob: AppUser, agent: AppUser, admin: AppUser;
let wifiTopicId: string;

const makeUser = (name: string, role: AppUser["role"]) => makeTestUser(tag, name, role);

async function photo() {
  const r = await prepareUploads([new File([new Uint8Array(100)], "wifi.png")]);
  if (!r.ok) throw new Error(r.error);
  return r.files;
}

const update = (t: { status: any; priority: any; assignedTeamId: string | null; assignedAgentId: string | null }) => ({
  status: t.status,
  priority: t.priority,
  assignedTeamId: t.assignedTeamId,
  assignedAgentId: t.assignedAgentId,
});

beforeAll(async () => {
  alice = await makeUser("Alice", "USER");
  bob = await makeUser("Bob", "USER");
  agent = await makeUser("Agent", "AGENT");
  admin = await makeUser("Admin", "SUPERADMIN");
  wifiTopicId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } })).id;
});

afterAll(() => prisma.$disconnect());

describe("ticket lifecycle", () => {
  it("creates a ticket using the help topic's defaults and SLA", async () => {
    const before = Date.now();
    const t = await createTicket(alice, { helpTopicId: wifiTopicId, subject: "Wifi down", body: "Room 204" }, await photo());
    const full = await prisma.ticket.findUniqueOrThrow({
      where: { id: t.id },
      include: { assignedTeam: true, slaPolicy: true, thread: { include: { attachments: true } } },
    });
    expect(full.ticketNumber).toMatch(/^TKT-\d{6}$/);
    expect(full.priority).toBe("NORMAL");
    expect(full.assignedTeam?.name).toBe("High School Team");
    expect(full.slaPolicy?.name).toBe("Standard");
    const responseMs = full.firstResponseDueAt!.getTime() - before;
    expect(responseMs).toBeGreaterThanOrEqual(8 * 3_600_000 - 5_000);
    expect(responseMs).toBeLessThanOrEqual(8 * 3_600_000 + 5_000);
    expect(full.thread).toHaveLength(1);
    expect(full.thread[0]).toMatchObject({ type: "CLIENT_MESSAGE", authorId: alice.id });
    expect(full.thread[0].attachments[0]).toMatchObject({ fileName: "wifi.png", mimeType: "image/png" });
  });

  it("keeps other requesters out", async () => {
    const t = await createTicket(alice, { helpTopicId: wifiTopicId, subject: "Private", body: "x" });
    expect(await getTicketForViewer(bob, t.ticketNumber)).toBeNull();
    expect(await getTicketForViewer(alice, t.ticketNumber)).not.toBeNull();
    expect(await getTicketForViewer(agent, t.ticketNumber.toLowerCase())).not.toBeNull();
    await expect(addMessage(bob, t.ticketNumber, { body: "hi", mode: "client" })).rejects.toThrow(TicketError);
    await expect(closeAsRequester(bob, t.ticketNumber)).rejects.toThrow(TicketError);
  });

  it("hides internal notes and their attachments from the requester", async () => {
    const t = await createTicket(alice, { helpTopicId: wifiTopicId, subject: "Notes", body: "x" });
    const note = await addMessage(agent, t.ticketNumber, { body: "secret", mode: "note" }, await photo());
    const noteAttachment = await prisma.attachment.findFirstOrThrow({ where: { threadEntryId: note.id } });

    const asAlice = await getTicketForViewer(alice, t.ticketNumber);
    expect(asAlice!.thread.map((e) => e.type)).not.toContain("INTERNAL_NOTE");
    const asAgent = await getTicketForViewer(agent, t.ticketNumber);
    expect(asAgent!.thread.map((e) => e.type)).toContain("INTERNAL_NOTE");

    expect(await getAttachmentForViewer(alice, noteAttachment.id)).toBeNull();
    expect(await getAttachmentForViewer(bob, noteAttachment.id)).toBeNull();
    expect(await getAttachmentForViewer(agent, noteAttachment.id)).not.toBeNull();
  });

  it("enforces who may post which kind of message", async () => {
    const t = await createTicket(alice, { helpTopicId: wifiTopicId, subject: "Modes", body: "x" });
    await expect(addMessage(alice, t.ticketNumber, { body: "x", mode: "note" })).rejects.toThrow(TicketError);
    await expect(addMessage(alice, t.ticketNumber, { body: "x", mode: "reply" })).rejects.toThrow(TicketError);
    await expect(addMessage(agent, t.ticketNumber, { body: "x", mode: "client" })).rejects.toThrow(TicketError);
  });

  it("first agent reply records the response time and starts work", async () => {
    const t = await createTicket(alice, { helpTopicId: wifiTopicId, subject: "Reply", body: "x" });
    await addMessage(agent, t.ticketNumber, { body: "On it", mode: "reply" });
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id }, include: { thread: true } });
    expect(after.status).toBe("IN_PROGRESS");
    expect(after.firstRespondedAt).not.toBeNull();
    expect(after.thread.some((e) => e.type === "SYSTEM_EVENT" && e.body.includes("In progress"))).toBe(true);

    const firstRespondedAt = after.firstRespondedAt;
    await addMessage(agent, t.ticketNumber, { body: "Again", mode: "reply" });
    const again = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(again.firstRespondedAt).toEqual(firstRespondedAt);
  });

  it("only assigns tickets to active staff", async () => {
    const t = await createTicket(alice, { helpTopicId: wifiTopicId, subject: "Assign", body: "x" });
    await expect(updateTicketFields(agent, t.ticketNumber, { ...update(t), assignedAgentId: bob.id })).rejects.toThrow(
      "only be assigned to active agents",
    );
    await expect(updateTicketFields(alice, t.ticketNumber, update(t))).rejects.toThrow(TicketError);

    await updateTicketFields(agent, t.ticketNumber, { ...update(t), assignedAgentId: agent.id, priority: "HIGH" });
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id }, include: { thread: true } });
    expect(after.assignedAgentId).toBe(agent.id);
    expect(after.priorityLevel).toBe(3);
    const events = after.thread.filter((e) => e.type === "SYSTEM_EVENT").map((e) => e.body);
    expect(events).toEqual(expect.arrayContaining(["Priority changed from Normal to High", "Assigned to Agent"]));
  });

  it("resolve → requester reply reopens → requester closes → can't post", async () => {
    const t = await createTicket(alice, { helpTopicId: wifiTopicId, subject: "Flow", body: "x" });
    const resolved = await updateTicketFields(agent, t.ticketNumber, { ...update(t), status: "RESOLVED" });
    expect(resolved.resolvedAt).not.toBeNull();

    await addMessage(alice, t.ticketNumber, { body: "Still broken", mode: "client" });
    const reopened = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(reopened.status).toBe("OPEN");
    expect(reopened.resolvedAt).toBeNull();

    const closed = await closeAsRequester(alice, t.ticketNumber);
    expect(closed.status).toBe("CLOSED");
    expect(closed.closedAt).not.toBeNull();
    await expect(addMessage(alice, t.ticketNumber, { body: "x", mode: "client" })).rejects.toThrow("closed");
  });
});

describe("queue", () => {
  const ids = async (who: AppUser, view: QueueView, q = tag) => (await listQueue(who, { view, q })).tickets.map((x) => x.id);

  it("filters by view for admins and refuses requesters", async () => {
    const t = await createTicket(alice, { helpTopicId: wifiTopicId, subject: `Queue ${tag}`, body: "x" });
    expect(await ids(admin, "unassigned")).toContain(t.id);

    await updateTicketFields(admin, t.ticketNumber, { ...update(t), assignedAgentId: admin.id });
    expect(await ids(admin, "mine")).toContain(t.id);
    expect(await ids(admin, "unassigned")).not.toContain(t.id);

    await prisma.ticket.update({ where: { id: t.id }, data: { firstResponseDueAt: new Date(Date.now() - 60_000) } });
    expect(await ids(admin, "overdue")).toContain(t.id);

    await expect(listQueue(alice, { view: "open" })).rejects.toThrow(TicketError);
  });

  it("shows agents only their open tickets: assigned to them or filed by them", async () => {
    const q = `Personal ${tag}`;
    const assigned = await createTicket(alice, { helpTopicId: wifiTopicId, subject: `${q} assigned`, body: "x" });
    await updateTicketFields(admin, assigned.ticketNumber, { ...update(assigned), assignedAgentId: agent.id });
    const ownRequest = await createTicket(agent, { helpTopicId: wifiTopicId, subject: `${q} own`, body: "x" });
    const onBehalf = await createTicket(agent, { helpTopicId: wifiTopicId, subject: `${q} walk-in`, body: "x" }, [], { requesterId: bob.id, source: "WALK_IN" });
    const someoneElses = await createTicket(alice, { helpTopicId: wifiTopicId, subject: `${q} other`, body: "x" });
    const closed = await createTicket(agent, { helpTopicId: wifiTopicId, subject: `${q} closed`, body: "x" });
    await updateTicketFields(admin, closed.ticketNumber, { ...update(closed), status: "CLOSED" });

    expect(onBehalf.createdById).toBe(agent.id);
    expect(onBehalf.requesterId).toBe(bob.id);

    const mine = await ids(agent, "personal", q);
    expect(mine).toEqual(expect.arrayContaining([assigned.id, ownRequest.id, onBehalf.id]));
    expect(mine).not.toContain(someoneElses.id);
    expect(mine).not.toContain(closed.id);

    // Asking for a shared queue by URL still returns only their own tickets.
    const viaUnassigned = await listQueue(agent, { view: "unassigned", q });
    expect(viaUnassigned.view).toBe("personal");
    expect(viaUnassigned.tickets.map((x) => x.id).sort()).toEqual([...mine].sort());
    expect(await ids(admin, "unassigned", q)).toContain(someoneElses.id);

    const counts = await queueCounts(agent);
    expect(counts.personal).toBeGreaterThanOrEqual(3);
    expect(counts.unassigned).toBe(0);
  });
});

describe("admin", () => {
  it("stops admins from locking themselves out", async () => {
    const self = { id: admin.id, email: admin.email, name: admin.name, departmentId: null, password: null, teamIds: [] };
    await expect(saveUser(admin, { ...self, role: "AGENT", isActive: true })).rejects.toThrow("your own role");
    await expect(saveUser(admin, { ...self, role: "SUPERADMIN", isActive: false })).rejects.toThrow("deactivate yourself");
    await expect(saveUser(agent, { ...self, role: "ADMIN", isActive: true })).rejects.toThrow(TicketError);
  });

  it("reports duplicate emails and clears assignments when demoting", async () => {
    const dup = { id: null, email: alice.email.toUpperCase(), name: "Dup", role: "USER" as const, departmentId: null, isActive: true, password: null, teamIds: [] };
    await expect(saveUser(admin, dup)).rejects.toThrow("already exists");

    const helper = await makeUser("Helper", "AGENT");
    const t = await createTicket(alice, { helpTopicId: wifiTopicId, subject: "Demote", body: "x" });
    await updateTicketFields(agent, t.ticketNumber, { ...update(t), assignedAgentId: helper.id });
    await saveUser(admin, { id: helper.id, email: helper.email, name: helper.name, role: "USER", departmentId: null, isActive: true, password: null, teamIds: [] });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).assignedAgentId).toBeNull();
  });
});
