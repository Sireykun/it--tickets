import { Search } from "lucide-react";
import type { Metadata } from "next";
import { Input } from "@/components/ui/field";
import { formatRelative } from "@/lib/format";
import { requireSuperadmin } from "@/server/authz";
import { listArticles } from "@/server/kb";
import { prisma } from "@/server/prisma";
import { ArticleForm } from "../admin-forms";
import { AdminPage, editTarget } from "../entity-list";

export const metadata: Metadata = { title: "Knowledge base" };

export default async function KnowledgeBaseAdminPage({ searchParams }: PageProps<"/staff/admin/knowledge-base">) {
  const user = await requireSuperadmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const [articles, topics] = await Promise.all([
    listArticles(user, { q, includeDrafts: true }),
    prisma.helpTopic.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const target = editTarget(sp.edit, articles);

  return (
    <AdminPage
      title="Knowledge base"
      subtitle="Self-service articles requesters see on the Help page and while opening a ticket."
      newLabel="New article"
      basePath="/staff/admin/knowledge-base"
      saved={sp.saved === "1"}
      editTitle={target.item ? `Edit ${target.item.title}` : "New article"}
      form={
        target.show ? (
          <ArticleForm
            key={target.item?.id ?? "new"}
            article={
              target.item && {
                id: target.item.id,
                title: target.item.title,
                body: target.item.body,
                helpTopicId: target.item.helpTopicId,
                isPublished: target.item.isPublished,
              }
            }
            topics={topics}
          />
        ) : undefined
      }
      toolbar={
        <form method="get" className="relative mb-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="kb-q" className="sr-only">
            Search articles
          </label>
          <Input id="kb-q" name="q" type="search" defaultValue={q} placeholder="Search articles…" className="pl-10" />
        </form>
      }
      rows={articles.map((a) => ({
        id: a.id,
        title: a.isPublished ? a.title : `${a.title} · Draft`,
        subtitle: a.body.length > 90 ? `${a.body.slice(0, 90)}…` : a.body,
        meta: (
          <>
            <span className="block">{a.helpTopic?.name ?? "General"}</span>
            <span className="block">Updated {formatRelative(a.updatedAt)}</span>
          </>
        ),
      }))}
    />
  );
}
