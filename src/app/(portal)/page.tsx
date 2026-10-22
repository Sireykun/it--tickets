import clsx from "clsx";
import { BookOpen, Inbox, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TicketCard, TicketList } from "@/components/tickets/ticket-card";
import { LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ChoiceMenu } from "@/components/ui/list-controls";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/server/authz";
import { listMyTickets } from "@/server/tickets";

export const metadata: Metadata = { title: "My tickets" };

const SORTS = { updated: "Recently updated", newest: "Newest", oldest: "Oldest" } as const;
type Sort = keyof typeof SORTS;

export default async function MyTicketsPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const sp = await searchParams;
  const filter = sp.show === "closed" ? "closed" : "open";
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const sort: Sort = typeof sp.sort === "string" && sp.sort in SORTS ? (sp.sort as Sort) : "updated";
  const tickets = await listMyTickets(user, filter, { q, sort });

  const hrefWith = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (filter === "closed") p.set("show", "closed");
    if (q) p.set("q", q);
    if (sort !== "updated") p.set("sort", sort);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `/${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        subtitle="Here are your IT requests."
        actions={
          <LinkButton href="/tickets/new" className="hidden md:inline-flex">
            <Plus className="size-5" aria-hidden /> New ticket
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Filter tickets" className="inline-flex rounded-lg border border-border bg-surface-2 p-1">
          {(["open", "closed"] as const).map((f) => (
            <Link
              key={f}
              role="tab"
              aria-selected={filter === f}
              href={hrefWith({ show: f === "open" ? null : "closed" })}
              className={clsx(
                "inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-bold transition-colors",
                filter === f ? "bg-surface text-text shadow-card" : "text-muted hover:text-text",
              )}
            >
              {f === "open" ? "Open" : "Closed"}
            </Link>
          ))}
        </div>
        <form method="get" className="relative min-w-0 flex-1 basis-56">
          {filter === "closed" && <input type="hidden" name="show" value="closed" />}
          {sort !== "updated" && <input type="hidden" name="sort" value={sort} />}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="my-q" className="sr-only">
            Search my tickets
          </label>
          <Input id="my-q" name="q" type="search" defaultValue={q} placeholder="Search my tickets…" className="pl-10" />
        </form>
        <ChoiceMenu
          label="Sort"
          value={sort}
          choices={(Object.keys(SORTS) as Sort[]).map((s) => ({ value: s, label: SORTS[s], href: hrefWith({ sort: s === "updated" ? null : s }) }))}
        />
      </div>

      {tickets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="size-7" />}
            title={q ? "No tickets match your search" : filter === "open" ? "No open tickets" : "No closed tickets yet"}
          >
            {filter === "open" && !q ? (
              <>
                <p>Something not working? Check the help articles or let the IT team know.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <LinkButton href="/tickets/new">
                    <Plus className="size-5" aria-hidden /> New ticket
                  </LinkButton>
                  <LinkButton href="/help" variant="secondary">
                    <BookOpen className="size-5" aria-hidden /> Browse help
                  </LinkButton>
                </div>
              </>
            ) : (
              !q && <p>Tickets you close or that IT resolves will show up here.</p>
            )}
          </EmptyState>
        </Card>
      ) : (
        <TicketList>
          {tickets.map((t) => (
            <li key={t.id}>
              <TicketCard ticket={t} href={`/tickets/${t.ticketNumber}`} variant="requester" />
            </li>
          ))}
        </TicketList>
      )}
    </>
  );
}
