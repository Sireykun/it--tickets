import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addToCampus, bulkUpdateUsers, getUserDetail, removeFromCampus, saveCampus, saveTeam, saveUser } from "@/server/admin";
import { processInbound } from "@/server/email/inbound";
import { prisma } from "@/server/prisma";
import type { AppUser } from "@/server/roles";
import { prepareUploads } from "@/server/storage";
import { createTask, listTasks } from "@/server/tasks";
import {
  addCollaborator,
  addMessage,
  createTicket,
  getAttachmentForViewer,
  getTicketForViewer,
  listQueue,
  queueCounts,
  TicketError,
  updateTicketFields,
} from "@/server/tickets";
import { loadAppUser } from "@/server/users";
import { allCampusIds, makeUser } from "./fixtures";

const tag = `c${Date.now()}`;
let c1: string, c2: string;
let superadmin: AppUser, agentA: AppUser, agentB: AppUser, adminB: AppUser, student: AppUser, cadmin: AppUser, cadminNoPerm: AppUser;
let topicId: string;

const keep = (t: { status: any; priority: any; assignedTeamId: string | null; assignedAgentId: string | null }) => ({
  status: t.status,
  priority: t.priority,
  assignedTeamId: t.assignedTeamId,
  assignedAgentId: t.assignedAgentId,
});
// A saveUser input; each test supplies email plus whatever it's checking.
const userInput = (over: { email: string } & Record<string, unknown>) =>
  ({ id: null, name: "Someone", role: "USER", departmentId: null, isActive: true, password: null, teamIds: [], ...over }) as unknown as Parameters<
    typeof saveUser
  >[1];

beforeAll(async () => {
  [c1, c2] = await allCampusIds();
  superadmin = await makeUser(tag, "Super", "SUPERADMIN");
  agentA = await makeUser(tag, "AgentA", "AGENT", { campusIds: [c1] });
  agentB = await makeUser(tag, "AgentB", "AGENT", { campusIds: [c2] });
  adminB = await makeUser(tag, "AdminB", "ADMIN", { campusIds: [c2] });
  student = await makeUser(tag, "Student", "USER", { campusId: c2 });
  cadmin = await makeUser(tag, "Cadmin", "ADMIN", { campusIds: [c1], manage: [c1] });
  cadminNoPerm = await makeUser(tag, "CadminNoPerm", "ADMIN", { campusIds: [c1] });
  topicId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } })).id;
});

afterAll(() => prisma.$disconnect());

const openAtC2 = (subject = `C2 ${tag}`) => createTicket(student, { helpTopicId: topicId, subject, body: "help" });

describe("campus visibility", () => {
  it("files tickets at the requester's home campus", async () => {
    const t = await openAtC2();
    expect(t.campusId).toBe(c2);
  });

  it("saves the campus and room chosen on the requester form", async () => {
    const t = await createTicket(
      student,
      { helpTopicId: topicId, subject: `Room ${tag}`, body: "Projector is offline", room: "B-204" },
      [],
      { campusId: c1 },
    );
    expect(t).toMatchObject({ campusId: c1, room: "B-204" });
    expect((await getTicketForViewer(student, t.ticketNumber))?.room).toBe("B-204");
  });

  it("hides other campuses' tickets, attachments and counts from staff", async () => {
    const photo = await prepareUploads([new File([new Uint8Array(10)], "p.png")]);
    if (!photo.ok) throw new Error(photo.error);
    const t = await createTicket(student, { helpTopicId: topicId, subject: `Hidden ${tag}`, body: "x" }, photo.files);
    const attachment = await prisma.attachment.findFirstOrThrow({ where: { threadEntry: { ticketId: t.id } } });

    expect(await getTicketForViewer(agentA, t.ticketNumber)).toBeNull();
    expect(await getAttachmentForViewer(agentA, attachment.id)).toBeNull();
    // Shared queues are admin-only, so campus scoping of the queue is checked with campus admins.
    expect((await listQueue(cadmin, { view: "all", q: `Hidden ${tag}` })).tickets).toHaveLength(0);
    await expect(addMessage(agentA, t.ticketNumber, { body: "x", mode: "reply" })).rejects.toThrow(TicketError);
    await expect(updateTicketFields(agentA, t.ticketNumber, keep(t))).rejects.toThrow(TicketError);
    await expect(
      createTask(agentA, { ticketNumber: t.ticketNumber, title: "x", description: null, assignedAgentId: null, assignedTeamId: null, dueAt: null }),
    ).rejects.toThrow(TicketError);

    expect(await getTicketForViewer(agentB, t.ticketNumber)).not.toBeNull();
    expect((await listQueue(adminB, { view: "all", q: `Hidden ${tag}` })).tickets).toHaveLength(1);
    expect((await listQueue(superadmin, { view: "all", q: `Hidden ${tag}` })).tickets).toHaveLength(1);
    expect(await getAttachmentForViewer(superadmin, attachment.id)).not.toBeNull();

    const before = (await queueCounts(cadmin)).unassigned;
    await openAtC2();
    expect((await queueCounts(cadmin)).unassigned).toBe(before);
  });

  it("keeps tasks on other campuses' tickets out of lists", async () => {
    const t = await openAtC2();
    const task = await createTask(agentB, { ticketNumber: t.ticketNumber, title: `Task ${tag}`, description: null, assignedAgentId: null, assignedTeamId: null, dueAt: null });
    expect((await listTasks(agentA, "open")).map((x) => x.id)).not.toContain(task.id);
    expect((await listTasks(agentB, "open")).map((x) => x.id)).toContain(task.id);
  });

  it("treats out-of-campus staff who are CC'd as requesters: no notes, no staff replies", async () => {
    const t = await openAtC2();
    await addMessage(agentB, t.ticketNumber, { body: `secret ${tag}`, mode: "note" });
    await addCollaborator(student, t.ticketNumber, { email: agentA.email });

    const seen = await getTicketForViewer(agentA, t.ticketNumber);
    expect(seen).not.toBeNull();
    expect(seen!.thread.map((e) => e.body)).not.toContain(`secret ${tag}`);
    await expect(addMessage(agentA, t.ticketNumber, { body: "x", mode: "reply" })).rejects.toThrow(TicketError);
    await addMessage(agentA, t.ticketNumber, { body: "Same problem in my room", mode: "client" });
  });
});

describe("assignment and transfer", () => {
  it("only assigns agents who work at the ticket's campus", async () => {
    const t = await openAtC2();
    await expect(updateTicketFields(superadmin, t.ticketNumber, { ...keep(t), assignedAgentId: agentA.id })).rejects.toThrow("work at the ticket's campus");
    await updateTicketFields(superadmin, t.ticketNumber, { ...keep(t), assignedAgentId: agentB.id });
    await updateTicketFields(superadmin, t.ticketNumber, { ...keep(t), assignedAgentId: superadmin.id });
  });

  it("moving a ticket unassigns an agent who doesn't work at the new campus", async () => {
    const t = await openAtC2();
    await updateTicketFields(superadmin, t.ticketNumber, { ...keep(t), assignedAgentId: agentB.id });
    await expect(updateTicketFields(agentB, t.ticketNumber, { ...keep(t), assignedAgentId: agentB.id, campusId: c1 })).rejects.toThrow(
      "can't move tickets to that campus",
    );
    await updateTicketFields(superadmin, t.ticketNumber, { ...keep(t), assignedAgentId: agentB.id, campusId: c1 });
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id }, include: { thread: true } });
    expect(after.campusId).toBe(c1);
    expect(after.assignedAgentId).toBeNull();
    const events = after.thread.filter((e) => e.type === "SYSTEM_EVENT").map((e) => e.body);
    expect(events.some((b) => /^Moved from .+ to .+/.test(b))).toBe(true);
    expect(events).toContain("Unassigned");
  });

  it("staff filing on behalf of someone from another campus keep the ticket in their own campus", async () => {
    const t = await createTicket(agentA, { helpTopicId: topicId, subject: "Walk-in", body: "x" }, [], { requesterId: student.id, source: "WALK_IN" });
    expect(t.campusId).toBe(c1);
    await expect(createTicket(agentA, { helpTopicId: topicId, subject: "x", body: "x" }, [], { requesterId: student.id, campusId: c2 })).rejects.toThrow(
      "can't file tickets at that campus",
    );
  });
});

describe("campus from email domain", () => {
  it("places new users and inbound-email tickets at the matching campus", async () => {
    const domain = `east${tag}.ciaschool.edu.kh`;
    const east = await saveCampus(superadmin, { id: null, name: `East ${tag}`, emailDomains: [domain], isActive: true });
    const r = await processInbound({
      messageId: `<${tag}@mail.test>`,
      from: { address: `kid@${domain}`, name: "East Kid" },
      recipients: [{ address: "helpdesk@ciaschool.edu.kh" }],
      subject: "Printer jam",
      text: "Tray 2 is jammed.",
      headers: {},
      attachments: [],
    });
    expect(r.status).toBe("PROCESSED");
    const t = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: r.ticketNumber! }, include: { requester: true } });
    expect(t.campusId).toBe(east.id);
    expect(t.requester.campusId).toBe(east.id);
    await saveCampus(superadmin, { id: east.id, name: east.name, emailDomains: [], isActive: false });
  });
});

describe("campus admins and permissions", () => {
  it("lets a campus admin manage requesters and agents of their campus only", async () => {
    const agent = await saveUser(cadmin, userInput({ email: `new-agent-${tag}@ciaschool.edu.kh`, role: "AGENT", campusId: c1, staffCampusIds: [c1] }));
    expect(await prisma.staffCampus.findMany({ where: { userId: agent.id } })).toEqual([expect.objectContaining({ campusId: c1, permissions: [] })]);

    await expect(saveUser(cadmin, userInput({ email: `x1-${tag}@ciaschool.edu.kh`, campusId: c2 }))).rejects.toThrow("home campus you manage");
    await expect(saveUser(cadmin, userInput({ email: `x2-${tag}@ciaschool.edu.kh`, role: "ADMIN", campusId: c1 }))).rejects.toThrow("requesters and agents");
    await expect(
      saveUser(cadmin, userInput({ email: `x3-${tag}@ciaschool.edu.kh`, role: "AGENT", campusId: c1, staffCampusIds: [c1, c2] })),
    ).rejects.toThrow("campuses you manage");
    await expect(
      saveUser(cadmin, userInput({ email: `x4-${tag}@ciaschool.edu.kh`, role: "AGENT", campusId: c1, staffCampusIds: [c1], manageCampusIds: [c1] })),
    ).rejects.toThrow("Only a superadmin");
    await expect(saveUser(cadmin, userInput({ id: student.id, email: student.email, campusId: c1 }))).rejects.toThrow("isn't at a campus you manage");
    await expect(saveUser(cadmin, userInput({ id: superadmin.id, email: superadmin.email, role: "SUPERADMIN" }))).rejects.toThrow(TicketError);
    await expect(saveUser(cadminNoPerm, userInput({ email: `x5-${tag}@ciaschool.edu.kh`, campusId: c1 }))).rejects.toThrow("Not allowed");
  });

  it("keeps an agent's other-campus memberships when a campus admin edits them", async () => {
    const both = await makeUser(tag, "Both", "AGENT", { campusIds: [c1, c2], campusId: c1 });
    await saveUser(cadmin, userInput({ id: both.id, email: both.email, name: "Both", role: "AGENT", campusId: c1, staffCampusIds: [c1] }));
    expect((await loadAppUser(both.id))!.campusScope).toEqual(expect.arrayContaining([c1, c2]));
  });

  it("lets only the superadmin grant and revoke 'manage users'", async () => {
    const admin = await makeUser(tag, "NewAdmin", "ADMIN", { campusIds: [c1, c2], campusId: c1 });
    const base = userInput({ id: admin.id, email: admin.email, name: "NewAdmin", role: "ADMIN", campusId: c1, staffCampusIds: [c1, c2] });
    await saveUser(superadmin, { ...base, manageCampusIds: [c2] });
    expect((await loadAppUser(admin.id))!.manageCampusIds).toEqual([c2]);
    await saveUser(superadmin, { ...base, manageCampusIds: [] });
    expect((await loadAppUser(admin.id))!.manageCampusIds).toEqual([]);
    expect(await prisma.auditEvent.count({ where: { entityId: admin.id, action: "user.save", actorId: superadmin.id } })).toBe(2);
  });

  it("returns an agent's tickets to the queue when they stop working at that campus", async () => {
    const roaming = await makeUser(tag, "Roaming", "AGENT", { campusIds: [c1, c2], campusId: c1 });
    const t = await openAtC2();
    await updateTicketFields(superadmin, t.ticketNumber, { ...keep(t), assignedAgentId: roaming.id });
    await saveUser(superadmin, userInput({ id: roaming.id, email: roaming.email, name: "Roaming", role: "AGENT", campusId: c1, staffCampusIds: [c1] }));
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).assignedAgentId).toBeNull();
  });

  it("keeps shared settings superadmin-only", async () => {
    await expect(saveTeam(cadmin, { id: null, name: `T ${tag}`, description: null, departmentId: null, isActive: true })).rejects.toThrow(TicketError);
    await expect(saveCampus(cadmin, { id: null, name: `C ${tag}`, emailDomains: [], isActive: true })).rejects.toThrow(TicketError);
  });
});

describe("user management (superadmin)", () => {
  it("bulk adds and removes a work campus, skipping requesters", async () => {
    const a1 = await makeUser(tag, "BulkA1", "AGENT", { campusIds: [c1] });
    const a2 = await makeUser(tag, "BulkA2", "AGENT", { campusIds: [c1] });
    const added = await bulkUpdateUsers(superadmin, [a1.id, a2.id, student.id], { addCampusId: c2 });
    expect(added.updated).toBe(2);
    expect(added.skipped).toEqual([{ name: "Student", reason: expect.stringContaining("agents and campus admins") }]);
    expect((await loadAppUser(a1.id))!.campusScope).toEqual(expect.arrayContaining([c1, c2]));

    const t = await openAtC2(`Bulk ${tag}`);
    await updateTicketFields(superadmin, t.ticketNumber, { ...keep(t), assignedAgentId: a2.id });
    await bulkUpdateUsers(superadmin, [a1.id, a2.id], { removeCampusId: c2 });
    expect((await loadAppUser(a2.id))!.campusScope).toEqual([c1]);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).assignedAgentId).toBeNull();
  });

  it("bulk sets home campus and status, but never deactivates the actor", async () => {
    const r = await makeUser(tag, "BulkReq", "USER", { campusId: c1 });
    await bulkUpdateUsers(superadmin, [r.id], { homeCampusId: c2 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: r.id } })).campusId).toBe(c2);
    await bulkUpdateUsers(superadmin, [r.id], { homeCampusId: null });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: r.id } })).campusId).toBeNull();

    const result = await bulkUpdateUsers(superadmin, [r.id, superadmin.id], { isActive: false });
    expect(result.updated).toBe(1);
    expect(result.skipped[0].reason).toContain("deactivate yourself");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: r.id } })).isActive).toBe(false);
  });

  it("keeps bulk and campus membership changes superadmin-only", async () => {
    await expect(bulkUpdateUsers(cadmin, [agentA.id], { addCampusId: c1 })).rejects.toThrow("Not allowed");
    await expect(addToCampus(cadmin, c1, agentB.id, { canManageUsers: false })).rejects.toThrow("Not allowed");
    await expect(removeFromCampus(cadmin, c1, agentA.id)).rejects.toThrow("Not allowed");
  });

  it("adds staff and requesters from a campus's page", async () => {
    const admin = await makeUser(tag, "AddAdmin", "ADMIN", { campusIds: [c1] });
    await addToCampus(superadmin, c2, admin.id, { canManageUsers: true });
    expect((await loadAppUser(admin.id))!.manageCampusIds).toEqual([c2]);

    const req = await makeUser(tag, "AddReq", "USER");
    await addToCampus(superadmin, c2, req.id, { canManageUsers: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: req.id } })).campusId).toBe(c2);

    await removeFromCampus(superadmin, c2, admin.id);
    const after = (await loadAppUser(admin.id))!;
    expect(after.campusScope).toEqual([c1]);
    expect(after.manageCampusIds).toEqual([]);

    const closed = await prisma.campus.create({ data: { name: `Closed ${tag}`, isActive: false } });
    await expect(addToCampus(superadmin, closed.id, admin.id, { canManageUsers: false })).rejects.toThrow("active campus");
  });

  it("shows a user's open tickets and history only within the viewer's reach", async () => {
    const t = await openAtC2(`Detail ${tag}`);
    await bulkUpdateUsers(superadmin, [student.id], { homeCampusId: c2 });
    const full = (await getUserDetail(superadmin, student.id))!;
    expect(full.requested.map((r) => r.ticketNumber)).toContain(t.ticketNumber);
    expect(full.history[0]).toMatchObject({ action: "user.save", actor: { name: "Super" } });

    // The student is at c2; the c1 campus admin can't open them.
    expect(await getUserDetail(cadmin, student.id)).toBeNull();
    // A c1 agent the c1 admin manages: tickets from c2 stay hidden.
    const both = await makeUser(tag, "DetailBoth", "AGENT", { campusIds: [c1, c2] });
    await updateTicketFields(superadmin, t.ticketNumber, { ...keep(t), assignedAgentId: both.id });
    expect((await getUserDetail(cadmin, both.id))!.assigned).toEqual([]);
    expect((await getUserDetail(superadmin, both.id))!.assigned.map((r) => r.ticketNumber)).toEqual([t.ticketNumber]);
  });
});
