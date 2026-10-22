import { BookOpen, ChevronRight, Plus, Search, Tags } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ChoiceMenu } from "@/components/ui/list-controls";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/server/authz";
import { listArticles } from "@/server/kb";
import { prisma } from "@/server/prisma";

export const metadata: Metadata = { title: "Help" };

export default async function HelpPage({ searchParams }: PageProps<"/help">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const topicId = typeof sp.topic === "string" ? sp.topic : undefined;
  const [articles, topics] = await Promise.all([
    listArticles(user, { q, topicId }),
    prisma.helpTopic.findMany({ where: { isActive: true, kbArticles: { some: { isPublished: true } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const hrefFor = (topic: string | null) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (topic) p.set("topic", topic);
    return `/help${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Help & how-tos" subtitle="Quick fixes for common IT problems. Can't find it? Open a ticket." />

      <div className="mb-5 flex flex-wrap gap-2">
        <form method="get" className="flex min-w-0 flex-1 basis-72 gap-2">
          {topicId && <input type="hidden" name="topic" value={topicId} />}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="help-q" className="sr-only">
              Search help articles
            </label>
            <Input id="help-q" name="q" type="search" defaultValue={q} placeholder="Search, e.g. Wi‑Fi, printer, password…" className="pl-10" />
          </div>
          <button type="submit" className={buttonClass({ variant: "secondary" })}>
            Search
          </button>
        </form>
        {topics.length > 0 && (
          <ChoiceMenu
            label="Topic"
            icon={<Tags className="size-4" aria-hidden />}
            value={topicId ?? "all"}
            choices={[{ value: "all", label: "All topics", href: hrefFor(null) }, ...topics.map((t) => ({ value: t.id, label: t.name, href: hrefFor(t.id) }))]}
          />
        )}
      </div>

      {articles.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen className="size-7" />} title={q || topicId ? "No articles match" : "No articles yet"}>
            <p>The IT team can help directly.</p>
            <LinkButton href="/tickets/new" className="mt-5">
              <Plus className="size-5" aria-hidden /> New ticket
            </LinkButton>
          </EmptyState>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {articles.map((a) => (
            <li key={a.id}>
              <Link
                href={`/help/${a.id}`}
                className="group flex h-full items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-primary/40 hover:bg-surface-2/60"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <BookOpen className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-muted">{a.helpTopic?.name ?? "General"}</span>
                  <span className="block font-bold">{a.title}</span>
                  <span className="mt-1 line-clamp-2 block text-sm text-muted">{a.body}</span>
                </span>
                <ChevronRight className="mt-3 size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
