import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getArticle, listArticles, saveArticle } from "@/server/kb";
import { prisma } from "@/server/prisma";
import type { AppUser } from "@/server/roles";
import { TicketError } from "@/server/tickets";
import { kbArticleSchema } from "@/server/validation";
import { makeUser } from "./fixtures";

const tag = `k${Date.now()}`;
let superadmin: AppUser, admin: AppUser, student: AppUser;
let wifiId: string, printerId: string;

beforeAll(async () => {
  superadmin = await makeUser(tag, "KbSuper", "SUPERADMIN");
  admin = await makeUser(tag, "KbAdmin", "ADMIN");
  student = await makeUser(tag, "KbStudent", "USER");
  wifiId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } })).id;
  printerId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Printer Setup" } })).id;
});

afterAll(() => prisma.$disconnect());

const input = (over: Record<string, unknown> = {}) =>
  kbArticleSchema.parse({ title: `Article ${tag}`, body: "Step one.", helpTopicId: "", isPublished: "on", ...over });

describe("knowledge base", () => {
  it("only superadmins can save, and saves are audited", async () => {
    await expect(saveArticle(admin, input())).rejects.toThrow(TicketError);
    await expect(saveArticle(student, input())).rejects.toThrow(TicketError);

    const a = await saveArticle(superadmin, input({ title: `Audited ${tag}` }));
    expect(await prisma.auditEvent.count({ where: { entityId: a.id, action: "kb.save", actorId: superadmin.id } })).toBe(1);
    const edited = await saveArticle(superadmin, input({ id: a.id, title: `Audited v2 ${tag}` }));
    expect(edited.id).toBe(a.id);
    expect(edited.title).toBe(`Audited v2 ${tag}`);
    expect(await prisma.auditEvent.count({ where: { entityId: a.id, action: "kb.save" } })).toBe(2);
  });

  it("hides drafts from everyone but superadmins", async () => {
    const draft = await saveArticle(superadmin, input({ title: `Draft ${tag}`, isPublished: false }));
    expect(await getArticle(student, draft.id)).toBeNull();
    expect(await getArticle(admin, draft.id)).toBeNull();
    expect((await getArticle(superadmin, draft.id))?.id).toBe(draft.id);

    const ids = async (viewer: AppUser, includeDrafts?: boolean) => (await listArticles(viewer, { q: `Draft ${tag}`, includeDrafts })).map((a) => a.id);
    expect(await ids(student, true)).not.toContain(draft.id);
    expect(await ids(superadmin, true)).toContain(draft.id);
    expect(await ids(superadmin)).not.toContain(draft.id);
  });

  it("searches title and body and filters by topic", async () => {
    const wifi = await saveArticle(superadmin, input({ title: `Wifi fix ${tag}`, body: `Forget the network ${tag}-body`, helpTopicId: wifiId }));
    const printer = await saveArticle(superadmin, input({ title: `Printer fix ${tag}`, helpTopicId: printerId }));

    expect((await listArticles(student, { q: `${tag}-BODY` })).map((a) => a.id)).toEqual([wifi.id]);
    const byTopic = (await listArticles(student, { topicId: printerId, q: tag })).map((a) => a.id);
    expect(byTopic).toContain(printer.id);
    expect(byTopic).not.toContain(wifi.id);
  });

  it("rejects an unknown help topic", async () => {
    await expect(saveArticle(superadmin, input({ helpTopicId: "0190a3c4-0000-7000-8000-000000000000" }))).rejects.toThrow(/help topic/);
  });
});
