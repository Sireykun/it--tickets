import clsx from "clsx";
import { Inbox, Laptop, Mail, Plus, Search, Wifi } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TicketCard } from "@/components/tickets/ticket-card";
import { AccentRule, Card, EmptyState } from "@/components/ui/misc";
import { listAnnouncementsFor } from "@/server/announcements";
import { requireUser } from "@/server/authz";
import { listMyTickets } from "@/server/tickets";
import { ItStatus } from "./it-status";

export const metadata: Metadata = { title: "My tickets" };

const helpLinks = [
  { label: "Wi-Fi issues", detail: "Connection and network help", icon: Wifi, accent: "green", href: "/help?q=Wi-Fi" },
  { label: "Reset password", detail: "Accounts and sign-in help", icon: Mail, accent: "gold", href: "/help?q=password" },
  { label: "Device support", detail: "Computers and classroom devices", icon: Laptop, accent: "cyan", href: "/help" },
] as const;

const helpAccent = {
  green: "bg-accent-green-soft text-accent-green",
  gold: "bg-gold/10 text-gold-text",
  cyan: "bg-primary-soft text-primary",
} as const;

export default async function MyTicketsPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const params = await searchParams;
  const filter = params.show === "closed" ? "closed" : "open";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const tickets = await listMyTickets(user, filter, { q });
  const notices = await listAnnouncementsFor(user);
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] xl:gap-8">
      <section aria-label={filter === "closed" ? "Support history" : "Active tickets"} className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{filter === "closed" ? "Support history" : `Hi, ${user.name.split(" ")[0]}`}</h1>
            <AccentRule />
            <p className="mt-3 text-muted">{filter === "closed" ? "Your completed IT requests." : "Here are your IT requests."}</p>
          </div>
          <Link href="/tickets/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-4 font-bold text-action-fg shadow-card transition-colors hover:bg-action-hover">
            <Plus className="size-4" aria-hidden /> New ticket
          </Link>
        </div>

        <form action="/" method="get" role="search" className="mb-5 flex gap-2">
          {filter === "closed" && <input type="hidden" name="show" value="closed" />}
          <label htmlFor="ticket-search" className="sr-only">Search tickets</label>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-strong border-l-[3px] border-l-gold bg-surface px-3 focus-within:ring-2 focus-within:ring-focus">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input id="ticket-search" name="q" defaultValue={q} maxLength={100} placeholder="Search tickets..." className="min-h-11 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted" />
          </div>
          <button type="submit" className="min-h-11 rounded-lg border border-gold bg-gold px-4 text-base font-bold text-cia-black transition-colors hover:bg-gold/85">Search</button>
        </form>

        {tickets.length === 0 ? (
          <Card>
            <EmptyState icon={<Inbox className="size-7" />} title={q ? "No matching tickets" : filter === "open" ? "No open tickets" : "No closed tickets yet"}>
              {q ? <p>Try a different subject or ticket number.</p> : filter === "open" ? <p>Something not working? <Link href="/tickets/new" className="font-bold text-primary underline">Tell the IT team.</Link></p> : <p>Tickets that IT closes will show up here.</p>}
            </EmptyState>
          </Card>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t, index) => <li key={t.id}><TicketCard ticket={t} href={`/tickets/${t.ticketNumber}`} variant="requester" accent={(["gold", "green", "cyan"] as const)[index % 3]} /></li>)}
          </ul>
        )}
      </section>

      {/* On phones a live notice goes above the ticket list, where it can't be missed. */}
      <ItStatus notices={notices} className={clsx("lg:col-start-2 lg:row-start-1", notices.length > 0 && "order-first")} />
      <aside aria-label="Quick help" className="lg:col-start-2 lg:row-start-2">
        <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <h2 className="text-lg font-bold">Quick help</h2>
          <AccentRule className="mt-2 w-10" />
          <ul className="mt-3 space-y-2">
            {helpLinks.map(({ label, detail, icon: Icon, accent, href }) => <li key={label}>
              <Link href={href} className="flex items-start gap-3 rounded-lg border border-border border-l-[3px] border-l-gold bg-surface-2 p-3 transition-colors hover:border-primary/50 hover:bg-primary-soft">
                <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${helpAccent[accent]}`}><Icon className="size-5" aria-hidden /></span>
                <span><span className="block text-base font-bold">{label}</span><span className="block text-sm text-muted">{detail}</span></span>
              </Link>
            </li>)}
          </ul>
        </section>
      </aside>
    </div>
  );
}
