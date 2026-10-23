import { ArrowLeft, Building2, CalendarDays, CheckCircle2, DoorOpen, Heart, Lock, MessageSquareText, RotateCcw, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PriorityBadge, StatusChip } from "@/components/tickets/badges";
import { Composer } from "@/components/tickets/composer";
import { Thread } from "@/components/tickets/thread";
import { Button, LinkButton } from "@/components/ui/button";
import { AccentRule, Alert, Card } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { isStaff, requireUser } from "@/server/authz";
import { ACCEPT_ATTRIBUTE } from "@/server/storage";
import { getTicketForViewer } from "@/server/tickets";
import { CcPanel } from "@/components/tickets/cc-panel";
import { isParticipant } from "@/server/roles";
import { addCcAction, closeTicketAction, giveKudoAction, postClientMessageAction, removeCcAction, reopenTicketAction } from "../../actions";

export async function generateMetadata({ params }: PageProps<"/tickets/[number]">): Promise<Metadata> {
  return { title: decodeURIComponent((await params).number) };
}

export default async function TicketPage({ params, searchParams }: PageProps<"/tickets/[number]">) {
  const user = await requireUser();
  const { number } = await params;
  // Always the requester's view here, even for staff looking at their own ticket.
  const ticket = await getTicketForViewer(user, number, { asRequester: true });
  if (!ticket) notFound();
  if (!isParticipant(user.id, { requesterId: ticket.requesterId, collaborators: ticket.collaborators }) && isStaff(user.role)) {
    redirect(`/staff/tickets/${ticket.ticketNumber}`);
  }

  const created = (await searchParams).created === "1";
  const closed = ticket.status === "CLOSED";
  const isRequester = ticket.requesterId === user.id;
  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? "ciaschool.edu.kh";

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-base font-bold text-muted transition-colors hover:bg-surface-2 hover:text-text">
        <ArrowLeft className="size-5" aria-hidden /> Back to my tickets
      </Link>

      {created && (
        <div className="mb-4">
          <Alert tone="success">
            Ticket {ticket.ticketNumber} has been sent. We'll reply here{ticket.slaPolicy ? `, usually within ${ticket.slaPolicy.responseTimeHours}h` : ""}.
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-xl border border-border bg-surface px-4 py-3 shadow-card sm:px-5 sm:py-4" aria-labelledby="ticket-title">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <span className="rounded-md border border-border-strong bg-surface-2 px-2.5 py-1 font-mono text-sm font-bold text-primary">{ticket.ticketNumber}</span>
              {ticket.helpTopic && <span className="rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 text-sm font-semibold text-gold-text">{ticket.helpTopic.name}</span>}
              <PriorityBadge priority={ticket.priority} className="rounded-md border border-border-strong bg-surface-2 px-2.5 py-1 text-sm" />
              <StatusChip status={ticket.status} className="ml-auto text-sm" />
            </div>
            <h1 id="ticket-title" className="text-xl leading-tight font-bold tracking-tight text-balance break-words sm:text-2xl">{ticket.subject}</h1>
            <AccentRule />
          </section>

          <section className="conversation-panel rounded-xl border border-gold/70 bg-surface p-4 shadow-card sm:p-5" aria-labelledby="conversation-title">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 id="conversation-title" className="flex items-center gap-2 text-lg font-bold"><MessageSquareText className="size-5 text-primary" aria-hidden />Conversation</h2>
                <AccentRule className="mt-2 w-10" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-semibold text-gold-text">{ticket.thread.length} updates</span>
                {isRequester && (ticket.kudo ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-danger/50 bg-danger-soft px-3 py-2 text-sm font-bold text-danger"><Heart className="size-4 fill-current" aria-hidden /> Kudo sent</span>
                ) : closed ? (
                  <form action={giveKudoAction.bind(null, ticket.ticketNumber)}>
                    <Button type="submit" variant="secondary" className="border-gold/60 text-gold-text"><Heart className="size-4" aria-hidden /> Give a kudo to support</Button>
                  </form>
                ) : null)}
              </div>
            </div>
            <Thread entries={ticket.thread} perspective="requester" />
            {!closed && (
              <div className="mt-6 border-t border-border pt-5" aria-labelledby="reply-title">
                {ticket.status === "RESOLVED" && (
                  <div className="mb-3">
                    <Alert tone="info">IT marked this as resolved. Reply below if it's still not working, or close the ticket.</Alert>
                  </div>
                )}
                <h2 id="reply-title" className="mb-3 text-lg font-bold">Reply to IT</h2>
                <Composer action={postClientMessageAction.bind(null, ticket.ticketNumber)} accept={ACCEPT_ATTRIBUTE} placeholder="Message…" />
                {isRequester && (
                  <form action={closeTicketAction.bind(null, ticket.ticketNumber)} className="mt-3 flex justify-end">
                    <Button type="submit" variant="secondary">
                      <CheckCircle2 className="size-5" aria-hidden /> My problem is solved, close ticket
                    </Button>
                  </form>
                )}
              </div>
            )}
          </section>

          {closed && (
            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-muted"><Lock className="size-5" aria-hidden /> This ticket is closed.</p>
                <div className="flex flex-wrap gap-2">
                  {isRequester && <form action={reopenTicketAction.bind(null, ticket.ticketNumber)}><Button type="submit"><RotateCcw className="size-4" aria-hidden /> Reopen ticket</Button></form>}
                  <LinkButton href="/tickets/new" variant="secondary">Open a new ticket</LinkButton>
                </div>
              </div>
            </Card>
          )}
        </div>

        <aside aria-label="Ticket details and people" className="min-w-0 space-y-5 lg:sticky lg:top-6">
          <section className="rounded-xl border border-border bg-surface p-5 shadow-card" aria-labelledby="details-title">
            <h2 id="details-title" className="text-lg font-bold">Ticket details</h2>
            <AccentRule className="mb-4 mt-2 w-10" />
            <dl className="divide-y divide-border">
              <div className="flex gap-3 py-3 first:pt-0"><Building2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /><div><dt className="text-sm font-semibold text-muted">Campus</dt><dd className="mt-0.5 break-words font-semibold">{ticket.campus?.name ?? "Not specified"}</dd></div></div>
              <div className="flex gap-3 py-3"><DoorOpen className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /><div><dt className="text-sm font-semibold text-muted">Room</dt><dd className="mt-0.5 break-words font-semibold">{ticket.room || "Not specified"}</dd></div></div>
              <div className="flex gap-3 py-3"><CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /><div><dt className="text-sm font-semibold text-muted">Opened</dt><dd className="mt-0.5 font-semibold">{formatDateTime(ticket.createdAt)}</dd></div></div>
              {ticket.assignedAgent && <div className="flex gap-3 pt-3"><UserRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /><div><dt className="text-sm font-semibold text-muted">Handled by</dt><dd className="mt-0.5 break-words font-semibold">{ticket.assignedAgent.name}</dd></div></div>}
            </dl>
          </section>
          <CcPanel
            collaborators={ticket.collaborators}
            viewerId={user.id}
            canManage={isRequester && !closed}
            addAction={addCcAction.bind(null, ticket.ticketNumber)}
            removeAction={removeCcAction.bind(null, ticket.ticketNumber)}
            askName={false}
            hint={`CC'd people see this ticket, can reply, and get email updates. Only @${domain} addresses.`}
          />
        </aside>
      </div>
    </div>
  );
}
