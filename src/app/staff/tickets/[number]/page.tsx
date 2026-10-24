import { Activity, ArrowLeft, CalendarClock, CheckCircle2, ChevronDown, Circle, ClipboardList, Heart, Link2, MessageSquareText, Users, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PriorityBadge, SlaBadge, StatusChip } from "@/components/tickets/badges";
import { Composer } from "@/components/tickets/composer";
import { StaffClosureProvider } from "@/components/tickets/staff-closure";
import { Thread } from "@/components/tickets/thread";
import { Alert, Card } from "@/components/ui/misc";
import { formatDateTime, formatRelative } from "@/lib/format";
import { SOURCE_LABEL } from "@/lib/labels";
import { requireStaff } from "@/server/authz";
import { listCannedFor, renderCanned } from "@/server/canned";
import { otherHolder } from "@/server/locks";
import { canWorkTicket } from "@/server/roles";
import { ACCEPT_ATTRIBUTE } from "@/server/storage";
import { tasksForTicket } from "@/server/tasks";
import { assignmentOptions, getTicketForViewer } from "@/server/tickets";
import { CcPanel } from "@/components/tickets/cc-panel";
import {
  createTaskAction,
  heartbeatLockAction,
  linkAction,
  mergeAction,
  postStaffMessageAction,
  releaseLockAction,
  staffAddCcAction,
  staffRemoveCcAction,
  toggleTaskAction,
  unlinkAction,
  updateTicketAction,
} from "../../actions";
import { QuickTaskForm } from "./related-forms";
import { TicketActionsMenu } from "./ticket-actions-menu";
import { TicketFieldsForm } from "./ticket-panel";

export async function generateMetadata({ params }: PageProps<"/staff/tickets/[number]">): Promise<Metadata> {
  return { title: decodeURIComponent((await params).number) };
}

export default async function StaffTicketPage({ params, searchParams }: PageProps<"/staff/tickets/[number]">) {
  const user = await requireStaff();
  const { number } = await params;
  const asRequester = (await searchParams).view === "requester";
  const ticket = await getTicketForViewer(user, number, { asRequester });
  if (!ticket) notFound();
  if (!canWorkTicket(user, ticket)) redirect(`/tickets/${ticket.ticketNumber}`);

  const n = ticket.ticketNumber;
  const [options, tasks, cannedRows, holder] = await Promise.all([
    assignmentOptions(user, ticket.campusId),
    tasksForTicket(ticket.id),
    listCannedFor(user, ticket.departmentId),
    otherHolder(user.id, ticket.id),
  ]);
  const canned = cannedRows.map((row) => ({
    id: row.id,
    title: row.title,
    body: renderCanned(row.body, {
      requesterName: ticket.requester.name,
      ticketNumber: n,
      subject: ticket.subject,
      agentName: user.name,
    }),
  }));
  const links = [
    ...ticket.linksFrom.map((link) => ({ id: link.id, kind: link.kind, outgoing: true, other: link.toTicket })),
    ...ticket.linksTo.map((link) => ({ id: link.id, kind: link.kind, outgoing: false, other: link.fromTicket })),
  ];
  const mergedInto = links.find((link) => link.kind === "MERGED" && link.outgoing);
  const activity = ticket.thread.filter((entry) => entry.type === "SYSTEM_EVENT").reverse();
  const dueAt = ticket.firstRespondedAt ? ticket.resolutionDueAt : ticket.firstResponseDueAt;

  return (
    <StaffClosureProvider ticketNumber={n} requesterName={ticket.requester.name}>
      <div className="space-y-4">
        <header className="flex flex-wrap items-center gap-4 rounded-xl border border-border-strong bg-surface px-4 py-4 shadow-card sm:px-6">
          <Link href="/staff" className="inline-flex min-h-10 shrink-0 items-center gap-2 text-sm font-semibold text-muted hover:text-text">
            <ArrowLeft className="size-4" aria-hidden /> Back to queue
          </Link>
          <div className="hidden h-10 w-px bg-border-strong sm:block" aria-hidden />
          <div className="min-w-0 flex-1 basis-72">
            <p className="text-xs font-semibold tracking-wide text-muted">{n} · {ticket.campus?.name ?? "No campus"} · {SOURCE_LABEL[ticket.source]}</p>
            <h1 className="text-xl font-bold leading-tight break-words sm:text-2xl">{ticket.subject}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={ticket.status} className="rounded-lg px-3 py-1.5 text-sm" />
            <PriorityBadge priority={ticket.priority} className="rounded-lg border border-current/30 px-3 py-1.5 text-sm" />
          </div>
          <TicketActionsMenu
            ticketNumber={n}
            isRequesterView={asRequester}
            linkAction={linkAction.bind(null, n)}
            mergeAction={!mergedInto && ticket.status !== "CLOSED" ? mergeAction.bind(null, n) : undefined}
          />
        </header>

        {mergedInto && <Alert tone="info">This ticket was merged into <Link href={`/staff/tickets/${mergedInto.other.ticketNumber}`} className="underline">{mergedInto.other.ticketNumber}</Link>.</Alert>}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-6">
          <div className="min-w-0 space-y-4">
            <Card className="overflow-hidden border-border-strong">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3.5 sm:px-5">
                <MessageSquareText className="size-5 text-primary" aria-hidden />
                <h2 className="font-bold">Conversation</h2>
                <span className="ml-auto text-xs text-muted">{ticket.thread.filter((entry) => entry.type !== "SYSTEM_EVENT").length} messages</span>
              </div>
              {asRequester && <div className="px-4 pt-4"><Alert tone="info">You're seeing what {ticket.requester.name} sees. Internal notes are hidden.</Alert></div>}
              <div className="min-h-52 px-4 py-5 sm:px-6">
                <Thread entries={ticket.thread} perspective="staff" />
              </div>
              {!asRequester && (
                <div className="border-t border-border p-3 sm:p-4">
                  <Composer
                    action={postStaffMessageAction.bind(null, n)}
                    accept={ACCEPT_ATTRIBUTE}
                    staff
                    canned={canned}
                    lock={{ ticketId: ticket.id, holder, heartbeat: heartbeatLockAction, release: releaseLockAction }}
                  />
                </div>
              )}
            </Card>

            {activity.length > 0 && (
              <Card className="p-4 sm:p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Activity className="size-4 text-primary" aria-hidden />
                  <h2 className="font-bold">Activity</h2>
                  <span className="ml-auto text-xs text-muted">{activity.length} updates</span>
                </div>
                <ul className="divide-y divide-border text-sm">
                  {activity.slice(0, 3).map((entry) => (
                    <li key={entry.id} className="flex gap-3 py-2">
                      <span className="min-w-0 flex-1 text-muted"><strong className="text-text">{entry.author?.name ?? "System"}</strong> · {entry.body}</span>
                      <time dateTime={entry.createdAt.toISOString()} title={formatDateTime(entry.createdAt)} className="shrink-0 text-xs text-muted">{formatRelative(entry.createdAt)}</time>
                    </li>
                  ))}
                </ul>
                {activity.length > 3 && (
                  <details className="group mt-2 text-sm">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-primary [&::-webkit-details-marker]:hidden">View all activity <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden /></summary>
                    <ul className="mt-2 divide-y divide-border border-t border-border">
                      {activity.slice(3).map((entry) => <li key={entry.id} className="flex gap-3 py-2"><span className="min-w-0 flex-1 text-muted">{entry.author?.name ?? "System"} · {entry.body}</span><time className="shrink-0 text-xs text-muted" dateTime={entry.createdAt.toISOString()}>{formatRelative(entry.createdAt)}</time></li>)}
                    </ul>
                  </details>
                )}
              </Card>
            )}
          </div>

          <aside aria-label="Ticket information" className="min-w-0 space-y-3 xl:sticky xl:top-5">
            {!asRequester && (
              <Card className="p-4 sm:p-5">
                <TicketFieldsForm
                  key={`${ticket.status}-${ticket.priority}-${ticket.campusId}-${ticket.departmentId}-${ticket.assignedTeamId}-${ticket.assignedAgentId}`}
                  action={updateTicketAction.bind(null, n)}
                  ticket={{ status: ticket.status, priority: ticket.priority, campusId: ticket.campusId, departmentId: ticket.departmentId, assignedTeamId: ticket.assignedTeamId, assignedAgentId: ticket.assignedAgentId, assignedAgentName: ticket.assignedAgent?.name ?? null }}
                  campuses={options.campuses}
                  departments={options.departments}
                  teams={options.teams}
                  agents={options.agents}
                />
              </Card>
            )}

            <Card className="p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2 border-b border-border pb-3"><ClipboardList className="size-4 text-primary" aria-hidden /><h2 className="font-bold">Ticket details</h2></div>
              <dl className="divide-y divide-border text-sm">
                <div className="flex justify-between gap-3 py-2"><dt className="text-muted">Campus</dt><dd className="text-right font-semibold">{ticket.campus?.name ?? "None"}</dd></div>
                <div className="flex justify-between gap-3 py-2"><dt className="text-muted">Department</dt><dd className="text-right font-semibold">{ticket.department.name}</dd></div>
                <div className="flex justify-between gap-3 py-2"><dt className="text-muted">Requester</dt><dd className="min-w-0 text-right"><span className="block font-semibold">{ticket.requester.name}</span><a href={`mailto:${ticket.requester.email}`} className="block truncate text-xs text-primary hover:underline">{ticket.requester.email}</a></dd></div>
                {ticket.room && <div className="flex justify-between gap-3 py-2"><dt className="text-muted">Room</dt><dd className="text-right font-semibold">{ticket.room}</dd></div>}
                <div className="flex justify-between gap-3 py-2"><dt className="text-muted">SLA</dt><dd className="text-right font-semibold">{ticket.slaPolicy?.name ?? "None"}</dd></div>
                {dueAt && <div className="flex justify-between gap-3 py-2"><dt className="text-muted">Due</dt><dd className="text-right font-semibold text-gold-text"><CalendarClock className="mr-1 inline size-4" aria-hidden />{formatDateTime(dueAt)}</dd></div>}
                <div className="flex justify-between gap-3 py-2"><dt className="text-muted">Opened</dt><dd className="text-right">{formatDateTime(ticket.createdAt)}</dd></div>
              </dl>
              <div className="mt-3"><SlaBadge ticket={ticket} /></div>
            </Card>

            {ticket.kudo && <Card className="border-gold/60 bg-reply-bg p-4"><h2 className="flex items-center gap-2 font-bold text-gold-text"><Heart className="size-4 fill-current" aria-hidden />Kudos from requester</h2><p className="mt-1 text-sm text-muted">A thank-you gift from {ticket.requester.name}.</p></Card>}

            <details className="group rounded-xl border border-border bg-surface shadow-card">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden"><Users className="size-4 text-primary" aria-hidden />People on this ticket <span className="text-sm text-muted">({ticket.collaborators.length + 1})</span><ChevronDown className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" aria-hidden /></summary>
              <div className="border-t border-border p-3"><CcPanel collaborators={ticket.collaborators} viewerId={user.id} canManage addAction={staffAddCcAction.bind(null, n)} removeAction={staffRemoveCcAction.bind(null, n)} askName /></div>
            </details>

            <details className="group rounded-xl border border-border bg-surface shadow-card">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden"><ClipboardList className="size-4 text-primary" aria-hidden />Tasks <span className="text-sm text-muted">({tasks.filter((task) => task.status === "OPEN").length})</span><ChevronDown className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" aria-hidden /></summary>
              <div className="space-y-3 border-t border-border p-3">
                {tasks.length > 0 && <ul className="space-y-1">{tasks.map((task) => <li key={task.id} className="flex items-center gap-2 text-sm"><form action={toggleTaskAction.bind(null, task.id)}><button type="submit" className="grid size-9 place-items-center text-muted" aria-label={task.status === "OPEN" ? `Mark ${task.title} done` : `Reopen ${task.title}`}>{task.status === "OPEN" ? <Circle className="size-4" /> : <CheckCircle2 className="size-4 text-resolved" />}</button></form><Link href={`/staff/tasks/${task.id}`} className="min-w-0 flex-1 truncate hover:underline">{task.title}</Link></li>)}</ul>}
                <QuickTaskForm action={createTaskAction.bind(null, n)} agents={options.agents} teams={options.teams} />
              </div>
            </details>

            <details className="group rounded-xl border border-border bg-surface shadow-card">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden"><Link2 className="size-4 text-primary" aria-hidden />Linked tickets <span className="text-sm text-muted">({links.length})</span><ChevronDown className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" aria-hidden /></summary>
              <div className="border-t border-border p-3 text-sm">
                {links.length === 0 ? <p className="text-muted">None yet. Use Actions to link a ticket.</p> : <ul className="space-y-2">{links.map((link) => <li key={link.id} className="flex items-center gap-2"><Link href={`/staff/tickets/${link.other.ticketNumber}`} className="min-w-0 flex-1 hover:underline"><span className="font-mono font-bold">{link.other.ticketNumber}</span><span className="block truncate text-muted">{link.other.subject}</span></Link>{link.kind === "LINKED" && <form action={unlinkAction.bind(null, n, link.other.ticketNumber)}><button type="submit" className="grid size-9 place-items-center text-muted" aria-label={`Unlink ${link.other.ticketNumber}`}><X className="size-4" /></button></form>}</li>)}</ul>}
              </div>
            </details>
          </aside>
        </div>
      </div>
    </StaffClosureProvider>
  );
}
