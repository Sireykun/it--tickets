import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser, requireUser } from "@/server/authz";
import { getArticle } from "@/server/kb";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/help/[id]">): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const article = user && UUID.test(id) ? await getArticle(user, id) : null;
  return { title: article?.title ?? "Help" };
}

export default async function HelpArticlePage({ params }: PageProps<"/help/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const article = UUID.test(id) ? await getArticle(user, id) : null;
  if (!article) notFound();

  return (
    <article>
      <Link href="/help" className="mb-4 inline-flex min-h-10 items-center gap-1.5 font-bold text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Help
      </Link>
      <p className="text-sm font-bold text-muted">{article.helpTopic?.name ?? "General"}</p>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-balance">{article.title}</h1>
      <p className="mb-5 text-sm text-muted">Updated {formatDateTime(article.updatedAt)}</p>
      <Card className="p-5 sm:p-6">
        <div className="space-y-4 leading-relaxed">
          {article.body.split(/\n\s*\n/).map((para, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {para}
            </p>
          ))}
        </div>
      </Card>
      <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="font-bold">Still need help?</p>
        <LinkButton href={article.helpTopicId ? `/tickets/new?topic=${article.helpTopicId}` : "/tickets/new"}>
          <Plus className="size-5" aria-hidden /> Open a ticket
        </LinkButton>
      </Card>
    </article>
  );
}
