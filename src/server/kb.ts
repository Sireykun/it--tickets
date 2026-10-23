import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { prisma } from "@/server/prisma";
import { type AppUser, isSuperadmin } from "@/server/roles";
import { TicketError } from "@/server/tickets";
import type { kbArticleSchema } from "@/server/validation";

// Knowledge base: superadmins write articles; everyone signed in reads the published ones.

type Viewer = Pick<AppUser, "role">;

export async function saveArticle(actor: Pick<AppUser, "id" | "role">, input: z.infer<typeof kbArticleSchema>) {
  if (!isSuperadmin(actor)) throw new TicketError("Not allowed.");
  const { id, ...data } = input;
  if (data.helpTopicId && !(await prisma.helpTopic.count({ where: { id: data.helpTopicId } }))) {
    throw new TicketError("That help topic doesn't exist.");
  }
  return prisma.$transaction(async (tx) => {
    const article = id
      ? await tx.kbArticle.update({ where: { id }, data })
      : await tx.kbArticle.create({ data: { ...data, createdById: actor.id } });
    await audit(tx, actor, "kb.save", { type: "kbArticle", id: article.id }, { title: article.title, isPublished: article.isPublished });
    return article;
  });
}

// Articles have no active flag (unpublished means draft) and nothing references them, so this really deletes.
export async function deleteArticle(actor: Pick<AppUser, "id" | "role">, id: string) {
  if (!isSuperadmin(actor)) throw new TicketError("Not allowed.");
  await prisma.$transaction(async (tx) => {
    const article = await tx.kbArticle.findUnique({ where: { id }, select: { title: true } });
    if (!article) throw new TicketError("Not found.");
    await tx.kbArticle.delete({ where: { id } });
    await audit(tx, actor, "kb.delete", { type: "kbArticle", id }, { title: article.title });
  });
}

export async function listArticles(viewer: Viewer, opts: { q?: string; topicId?: string; includeDrafts?: boolean } = {}) {
  const filters: Prisma.KbArticleWhereInput[] = [];
  if (!(opts.includeDrafts && isSuperadmin(viewer))) filters.push({ isPublished: true });
  if (opts.topicId) filters.push({ helpTopicId: opts.topicId });
  const q = opts.q?.trim();
  if (q) filters.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] });
  return prisma.kbArticle.findMany({
    where: { AND: filters },
    orderBy: [{ updatedAt: "desc" }],
    include: { helpTopic: { select: { id: true, name: true } } },
  });
}

// Drafts look like they don't exist to anyone but a superadmin.
export async function getArticle(viewer: Viewer, id: string) {
  const article = await prisma.kbArticle.findUnique({
    where: { id },
    include: { helpTopic: { select: { id: true, name: true } } },
  });
  if (!article || (!article.isPublished && !isSuperadmin(viewer))) return null;
  return article;
}
