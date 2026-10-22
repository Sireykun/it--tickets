import clsx from "clsx";
import { Inbox, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TicketCard, TicketList } from "@/components/tickets/ticket-card";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/server/authz";
import { listMyTickets } from "@/server/tickets";

export const metadata: Metadata = { title: "My tickets" };

export default async function MyTicketsPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const filter = (await searchParams).show === "closed" ? "closed" : "open";
  const tickets = await listMyTickets(user, filter);

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

      <div role="tablist" aria-label="Filter tickets" className="mb-4 inline-flex rounded-lg border border-border bg-surface-2 p-1">
        {(["open", "closed"] as const).map((f) => (
          <Link
            key={f}
            role="tab"
            aria-selected={filter === f}
            href={f === "open" ? "/" : "/?show=closed"}
            className={clsx(
              "inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-bold transition-colors",
              filter === f ? "bg-surface text-text shadow-card" : "text-muted hover:text-text",
            )}
          >
            {f === "open" ? "Open" : "Closed"}
          </Link>
        ))}
      </div>

      {tickets.length === 0 ? (
        <Card>
          <EmptyState icon={<Inbox className="size-7" />} title={filter === "open" ? "No open tickets" : "No closed tickets yet"}>
            {filter === "open" ? (
              <>
                <p>Something not working? Let the IT team know.</p>
                <LinkButton href="/tickets/new" className="mt-5">
                  <Plus className="size-5" aria-hidden /> New ticket
                </LinkButton>
              </>
            ) : (
              <p>Tickets you close or that IT resolves will show up here.</p>
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
