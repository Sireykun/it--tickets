import clsx from "clsx";
import { ArrowRight, BookOpen, CircleHelp, Inbox, Laptop, Mail, Plus, Search, Wifi } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TicketCard } from "@/components/tickets/ticket-card";
import { LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ChoiceMenu } from "@/components/ui/list-controls";
import { Card, EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/server/authz";
import { listMyTickets } from "@/server/tickets";

export const metadata: Metadata = { title: "My tickets" };

const SORTS = { updated: "Recently updated", newest: "Newest", oldest: "Oldest" } as const;
type Sort = keyof typeof SORTS;

const helpLinks = [
  { label: "Wi-Fi issues", detail: "Connection and network help", icon: Wifi, href: "/help?q=wi-fi" },
  { label: "Reset password", detail: "Accounts and sign-in help", icon: Mail, href: "/help?q=password" },
  { label: "Device support", detail: "Computers and classroom devices", icon: Laptop, href: "/tickets/new" },
];

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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] xl:gap-8">
      <section aria-label={filter === "closed" ? "Support history" : "Active tickets"} className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{filter === "closed" ? "Support history" : `Hi, ${user.name.split(" ")[0]}`}</h1>
            <p className="mt-1 text-muted">{filter === "closed" ? "Your completed IT requests." : "Here are your IT requests."}</p>
          </div>
          <LinkButton href="/tickets/new">
            <Plus className="size-5" aria-hidden /> New ticket
          </LinkButton>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
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
          <form method="get" role="search" className="relative min-w-0 flex-1 basis-56">
            {filter === "closed" && <input type="hidden" name="show" value="closed" />}
            {sort !== "updated" && <input type="hidden" name="sort" value={sort} />}
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="my-q" className="sr-only">
              Search my tickets
            </label>
            <Input id="my-q" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Search my tickets…" className="pl-10" />
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
              {q ? (
                <p>Try a different subject, topic or ticket number.</p>
              ) : filter === "open" ? (
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
                <p>Tickets you close or that IT resolves will show up here.</p>
              )}
            </EmptyState>
          </Card>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id}>
                <TicketCard ticket={t} href={`/tickets/${t.ticketNumber}`} variant="requester" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside aria-label="Help and updates" className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <h2 className="text-lg font-bold">Support &amp; announcements</h2>
          <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
            <p className="text-base font-bold">Need help from IT?</p>
            <p className="mt-1 text-base text-muted">Create a ticket and include your campus, room, and device.</p>
            <Link href="/tickets/new" className="mt-2 inline-flex items-center gap-1 text-base font-bold text-primary hover:underline">Open a request <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <h2 className="text-lg font-bold">Quick help</h2>
          <ul className="mt-3 space-y-2">
            {helpLinks.map(({ label, detail, icon: Icon, href }) => <li key={label}>
              <Link href={href} className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3 transition-colors hover:border-primary/50 hover:bg-primary-soft">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-5" aria-hidden /></span>
                <span><span className="block text-base font-bold">{label}</span><span className="block text-sm text-muted">{detail}</span></span>
              </Link>
            </li>)}
          </ul>
          <Link href="/help" className="mt-3 inline-flex items-center gap-1 text-base font-bold text-primary hover:underline">All help articles <ArrowRight className="size-4" aria-hidden /></Link>
        </section>
        <section className="rounded-xl border border-border bg-surface p-4 shadow-card sm:col-span-2 lg:col-span-1">
          <h2 className="text-lg font-bold">IT status</h2>
          <p className="mt-2 text-base text-muted">For a service issue or outage, submit a ticket so the IT team can investigate.</p>
          <Link href="/tickets/new" className="mt-3 inline-flex items-center gap-1 text-base font-bold text-primary hover:underline"><CircleHelp className="size-4" aria-hidden /> Report an issue</Link>
        </section>
      </aside>
    </div>
  );
}
