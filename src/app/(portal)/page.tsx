import { ArrowRight, CircleHelp, Inbox, Laptop, Mail, Plus, Search, Wifi } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TicketCard } from "@/components/tickets/ticket-card";
import { Card, EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/server/authz";
import { listMyTickets } from "@/server/tickets";

export const metadata: Metadata = { title: "My tickets" };

const helpLinks = [
  { label: "Wi-Fi issues", detail: "Connection and network help", icon: Wifi },
  { label: "Reset password", detail: "Accounts and sign-in help", icon: Mail },
  { label: "Device support", detail: "Computers and classroom devices", icon: Laptop },
];

export default async function MyTicketsPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const params = await searchParams;
  const filter = params.show === "closed" ? "closed" : "open";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const tickets = await listMyTickets(user, filter, q);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] xl:gap-8">
      <section aria-label={filter === "closed" ? "Support history" : "Active tickets"} className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{filter === "closed" ? "Support history" : `Hi, ${user.name.split(" ")[0]}`}</h1>
            <p className="mt-1 text-muted">{filter === "closed" ? "Your completed IT requests." : "Here are your IT requests."}</p>
          </div>
          <Link href="/tickets/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-fg shadow-card transition-colors hover:bg-primary-hover">
            <Plus className="size-4" aria-hidden /> New ticket
          </Link>
        </div>

        <form action="/" method="get" role="search" className="mb-5 flex gap-2">
          {filter === "closed" && <input type="hidden" name="show" value="closed" />}
          <label htmlFor="ticket-search" className="sr-only">Search tickets</label>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 focus-within:ring-2 focus-within:ring-focus">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input id="ticket-search" name="q" defaultValue={q} maxLength={100} placeholder="Search tickets..." className="min-h-11 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted" />
          </div>
          <button type="submit" className="min-h-11 rounded-lg border border-border-strong bg-surface px-4 text-base font-bold hover:bg-surface-2">Search</button>
        </form>

        {tickets.length === 0 ? (
          <Card>
            <EmptyState icon={<Inbox className="size-7" />} title={q ? "No matching tickets" : filter === "open" ? "No open tickets" : "No closed tickets yet"}>
              {q ? <p>Try a different subject or ticket number.</p> : filter === "open" ? <p>Something not working? <Link href="/tickets/new" className="font-bold text-primary underline">Tell the IT team.</Link></p> : <p>Tickets that IT closes will show up here.</p>}
            </EmptyState>
          </Card>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => <li key={t.id}><TicketCard ticket={t} href={`/tickets/${t.ticketNumber}`} variant="requester" /></li>)}
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
            {helpLinks.map(({ label, detail, icon: Icon }) => <li key={label}>
              <Link href="/tickets/new" className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3 transition-colors hover:border-primary/50 hover:bg-primary-soft">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-5" aria-hidden /></span>
                <span><span className="block text-base font-bold">{label}</span><span className="block text-sm text-muted">{detail}</span></span>
              </Link>
            </li>)}
          </ul>
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
