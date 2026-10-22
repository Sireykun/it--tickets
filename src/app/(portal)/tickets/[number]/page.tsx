import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusChip } from "@/components/tickets/badges";
import { Composer } from "@/components/tickets/composer";
import { Thread } from "@/components/tickets/thread";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { isStaff, requireUser } from "@/server/authz";
import { ACCEPT_ATTRIBUTE } from "@/server/storage";
import { getTicketForViewer } from "@/server/tickets";
import { CcPanel } from "@/components/tickets/cc-panel";
import { isParticipant } from "@/server/roles";
import { addCcAction, closeTicketAction, postClientMessageAction, removeCcAction } from "../../actions";

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
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="mb-4 inline-flex min-h-10 items-center gap-1.5 font-bold text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> My tickets
      </Link>

      {created && (
        <div className="mb-4">
          <Alert tone="success">
            Ticket {ticket.ticketNumber} has been sent. We'll reply here{ticket.slaPolicy ? `, usually within ${ticket.slaPolicy.responseTimeHours}h` : ""}.
          </Alert>
        </div>
      )}

      <Card className="mb-6 p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="font-mono tracking-tight">{ticket.ticketNumber}</span>
          {ticket.helpTopic && <span>· {ticket.helpTopic.name}</span>}
        </div>
        <h1 className="text-xl leading-tight font-bold tracking-tight text-balance break-words sm:text-2xl">{ticket.subject}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <StatusChip status={ticket.status} />
          {ticket.campus && <span>Campus: {ticket.campus.name}</span>}
          {ticket.room && <span>Room: {ticket.room}</span>}
          <span>Opened {formatDateTime(ticket.createdAt)}</span>
          {ticket.assignedAgent && <span>Handled by {ticket.assignedAgent.name}</span>}
        </div>
      </Card>

      <Thread entries={ticket.thread} perspective="requester" />

      <div className="mt-6">
        {closed ? (
          <Card className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-muted">
              <Lock className="size-4" aria-hidden /> This ticket is closed.
            </p>
            <LinkButton href="/tickets/new" variant="secondary">
              Open a new ticket
            </LinkButton>
          </Card>
        ) : (
          <>
            {ticket.status === "RESOLVED" && (
              <div className="mb-3">
                <Alert tone="info">IT marked this as resolved. Reply below if it's still not working, or close the ticket.</Alert>
              </div>
            )}
            <Composer action={postClientMessageAction.bind(null, ticket.ticketNumber)} accept={ACCEPT_ATTRIBUTE} placeholder="Add more details or reply to IT…" />
            {isRequester && (
              <form action={closeTicketAction.bind(null, ticket.ticketNumber)} className="mt-3 flex justify-end">
                <Button type="submit" variant="ghost">
                  <CheckCircle2 className="size-5" aria-hidden /> My problem is solved, close ticket
                </Button>
              </form>
            )}
          </>
        )}
      </div>

      <div className="mt-6">
        <CcPanel
          collaborators={ticket.collaborators}
          viewerId={user.id}
          canManage={isRequester && !closed}
          addAction={addCcAction.bind(null, ticket.ticketNumber)}
          removeAction={removeCcAction.bind(null, ticket.ticketNumber)}
          askName={false}
          hint={`CC'd people see this ticket, can reply, and get email updates. Only @${domain} addresses.`}
        />
      </div>
    </div>
  );
}
