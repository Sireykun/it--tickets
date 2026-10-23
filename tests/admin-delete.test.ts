import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteSetting, deleteUser, saveCampus, saveDepartment, saveTeam } from "@/server/admin";
import { deleteCanned, saveCanned } from "@/server/canned";
import { deleteArticle, saveArticle } from "@/server/kb";
import { prisma } from "@/server/prisma";
import type { AppUser } from "@/server/roles";
import { createTicket, TicketError } from "@/server/tickets";
import { allCampusIds, makeUser } from "./fixtures";

const tag = `d${Date.now()}`;
let c1: string, c2: string;
let superadmin: AppUser, cadmin: AppUser, agent: AppUser, student: AppUser;
let topicId: string;

beforeAll(async () => {
  [c1, c2] = await allCampusIds();
  superadmin = await makeUser(tag, "DelSuper", "SUPERADMIN");
  cadmin = await makeUser(tag, "DelCampusAdmin", "ADMIN", { campusIds: [c1], manage: [c1] });
  agent = await makeUser(tag, "DelAgent", "AGENT");
  student = await makeUser(tag, "DelStudent", "USER", { campusId: c1 });
  topicId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } })).id;
});

afterAll(() => prisma.$disconnect());

describe("deleteSetting", () => {
  it("deactivates the record and audits the delete", async () => {
    const dept = await saveDepartment(superadmin, { id: null, name: `Dept ${tag}`, description: null, isActive: true });
    const team = await saveTeam(superadmin, { id: null, name: `Team ${tag}`, description: null, departmentId: null, isActive: true });
    const campus = await saveCampus(superadmin, { id: null, name: `Campus ${tag}`, emailDomains: [], isActive: true });

    await deleteSetting(superadmin, "department", dept.id);
    await deleteSetting(superadmin, "team", team.id);
    await deleteSetting(superadmin, "campus", campus.id);

    expect((await prisma.department.findUniqueOrThrow({ where: { id: dept.id } })).isActive).toBe(false);
    expect((await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).isActive).toBe(false);
    expect((await prisma.campus.findUniqueOrThrow({ where: { id: campus.id } })).isActive).toBe(false);
    expect(await prisma.auditEvent.count({ where: { entityId: dept.id, action: "department.delete", actorId: superadmin.id } })).toBe(1);
  });

  it("is superadmin-only and reports a missing record", async () => {
    const dept = await saveDepartment(superadmin, { id: null, name: `Kept ${tag}`, description: null, isActive: true });
    await expect(deleteSetting(cadmin, "department", dept.id)).rejects.toThrow(TicketError);
    expect((await prisma.department.findUniqueOrThrow({ where: { id: dept.id } })).isActive).toBe(true);
    await expect(deleteSetting(superadmin, "team", "00000000-0000-0000-0000-000000000000")).rejects.toThrow("Not found.");
  });
});

describe("deleteUser", () => {
  it("deactivates the user and unassigns their open tickets", async () => {
    const target = await makeUser(tag, "DelTarget", "AGENT");
    const ticket = await createTicket(student, { helpTopicId: topicId, subject: `Delete ${tag}`, body: "x" });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { assignedAgentId: target.id } });

    await deleteUser(superadmin, target.id);

    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).isActive).toBe(false);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).assignedAgentId).toBeNull();
  });

  it("refuses to delete yourself", async () => {
    await expect(deleteUser(superadmin, superadmin.id)).rejects.toThrow("deactivate yourself");
  });

  it("keeps campus admins to the campuses they manage", async () => {
    const outsider = await makeUser(tag, "DelOutsider", "USER", { campusId: c2 });
    await expect(deleteUser(cadmin, outsider.id)).rejects.toThrow(TicketError);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: outsider.id } })).isActive).toBe(true);

    const local = await makeUser(tag, "DelLocal", "USER", { campusId: c1 });
    await deleteUser(cadmin, local.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: local.id } })).isActive).toBe(false);
  });

  it("leaves agents alone when asked by an agent", async () => {
    await expect(deleteUser(agent, student.id)).rejects.toThrow(TicketError);
  });
});

describe("canned replies and articles", () => {
  it("deactivates a canned reply", async () => {
    const reply = await saveCanned(superadmin, { id: null, title: `Canned ${tag}`, body: "Hi", departmentId: null, isActive: true });
    await expect(deleteCanned(cadmin, reply.id)).rejects.toThrow(TicketError);
    await deleteCanned(superadmin, reply.id);
    expect((await prisma.cannedResponse.findUniqueOrThrow({ where: { id: reply.id } })).isActive).toBe(false);
    expect(await prisma.auditEvent.count({ where: { entityId: reply.id, action: "canned.delete" } })).toBe(1);
  });

  it("removes an article and audits it", async () => {
    const article = await saveArticle(superadmin, { id: null, title: `Article ${tag}`, body: "Steps", helpTopicId: null, isPublished: true });
    await expect(deleteArticle(cadmin, article.id)).rejects.toThrow(TicketError);
    await deleteArticle(superadmin, article.id);
    expect(await prisma.kbArticle.findUnique({ where: { id: article.id } })).toBeNull();
    expect(await prisma.auditEvent.count({ where: { entityId: article.id, action: "kb.delete", actorId: superadmin.id } })).toBe(1);
  });
});
