import { ArrowLeft, CheckCircle2, Circle, Eye, EyeOff, Link2, Printer, UserPlus, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PriorityBadge, SlaBadge, StatusChip } from "@/components/tickets/badges";
import { Composer } from "@/components/tickets/composer";
import { Thread } from "@/components/tickets/thread";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { SOURCE_LABEL } from "@/lib/labels";
import { requireStaff } from "@/server/authz";
import { canWorkTicket } from "@/server/roles";
import { listCannedFor, renderCanned } from "@/server/canned";
import { otherHolder } from "@/server/locks";
import { ACCEPT_ATTRIBUTE } from "@/server/storage";
import { tasksForTicket } from "@/server/tasks";
import { assignmentOptions, getTicketForViewer } from "@/server/tickets";
import {
  assignToMeAction,
  createTaskAction,
  heartbeatLockAction,
  linkAction,
  mergeAction,
  postStaffMessageAction,
  releaseLockAction,
  toggleTaskAction,
  unlinkAction,
  updateTicketAction,
  staffAddCcAction,
  staffRemoveCcAction,
} from "../../actions";
import { CcPanel } from "@/components/tickets/cc-panel";
import { LinkTicketForm, MergeTicketForm, QuickTaskForm } from "./related-forms";
import { CollapsiblePanel, TicketFieldsForm } from "./ticket-panel";

export async function generateMetadata({ params }: PageProps<"/staff/tickets/[number]">): Promise<Metadata> {
  return { title: decodeURIComponent((await params).number) };
}

export default async function StaffTicketPage({ params, searchParams }: PageProps<"/staff/tickets/[number]">) {
  const user = await requireStaff();
  const { number } = await params;
  const asRequester = (await searchParams).view === "requester";
  const ticket = await getTicketForViewer(user, number, { asRequester });
  if (!ticket) notFound();
  // Staff who are only a participant here (ticket at another campus) get the requester view.
  if (!canWorkTicket(user, ticket)) redirect(`/tickets/${ticket.ticketNumber}`);

  const n = ticket.ticketNumber;
  const [options, tasks, cannedRows, holder] = await Promise.all([
    assignmentOptions(user, ticket.campusId),
    tasksForTicket(ticket.id),
    listCannedFor(user, ticket.departmentId),
    otherHolder(user.id, ticket.id),
  ]);
  const canned = cannedRows.map((c) => ({
    id: c.id,
    title: c.title,
    body: renderCanned(c.body, {
      requesterName: ticket.requester.name,
      ticketNumber: n,
      subject: ticket.subject,
      agentName: user.name,
    }),
  }));

  const links = [
    ...ticket.linksFrom.map((l) => ({ id: l.id, kind: l.kind, outgoing: true, other: l.toTicket })),
    ...ticket.linksTo.map((l) => ({ id: l.id, kind: l.kind, outgoing: false, other: l.fromTicket })),
  ];
  const mergedInto = links.find((l) => l.kind === "MERGED" && l.outgoing);

  const dates: [string, Date | null][] = [
    ["Opened", ticket.createdAt],
    ["First response due", ticket.firstRespondedAt ? null : ticket.firstResponseDueAt],
    ["First responded", ticket.firstRespondedAt],
    ["Resolution due", ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? null : ticket.resolutionDueAt],
    ["Resolved", ticket.resolvedAt],
    ["Closed", ticket.closedAt],
  ];

  return (
    <div>
      <Link href="/staff" className="mb-4 inline-flex min-h-10 items-center gap-1.5 font-bold text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Queue
      </Link>

      <div className="mb-5">
        <p className="text-sm font-bold text-muted tabular-nums">
          {n} · {ticket.campus?.name ?? "No campus"} · via {SOURCE_LABEL[ticket.source]}
        </p>
        <h1 className="text-xl font-bold tracking-tight break-words sm:text-2xl">{ticket.subject}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4">
          <Link
            href={asRequester ? `/staff/tickets/${n}` : `/staff/tickets/${n}?view=requester`}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-primary hover:underline"
          >
            {asRequester ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            {asRequester ? "Back to staff view" : "Preview as requester"}
          </Link>
          <Link href={`/print/tickets/${n}`} target="_blank" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-primary hover:underline">
            <Printer className="size-4" aria-hidden /> Print / PDF
          </Link>
        </div>
      </div>

      {mergedInto && (
        <div className="mb-4">
          <Alert tone="info">
            This ticket was merged into{" "}
            <Link href={`/staff/tickets/${mergedInto.other.ticketNumber}`} className="underline">
              {mergedInto.other.ticketNumber}
            </Link>
            .
          </Alert>
        </div>
      )}

      {/* Phones: summary → conversation → requester/tasks/links. Desktop: conversation left, all panels right. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
        <aside aria-label="Ticket details" className="lg:col-start-2 lg:row-start-1">
          <CollapsiblePanel
            summary={
              <span className="flex flex-wrap items-center gap-2">
                <StatusChip status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <span className="truncate text-sm text-muted">{ticket.assignedAgent?.name ?? "Unassigned"} · Edit details</span>
              </span>
            }
          >
            {!ticket.assignedAgentId && (
              <form action={assignToMeAction.bind(null, n)} className="mb-4">
                <Button type="submit" variant="secondary" className="w-full">
                  <UserPlus className="size-5" aria-hidden /> Assign to me
                </Button>
              </form>
            )}
            <TicketFieldsForm
              // Remount after each save so the selects show the saved values.
              key={`${ticket.status}-${ticket.priority}-${ticket.campusId}-${ticket.departmentId}-${ticket.assignedTeamId}-${ticket.assignedAgentId}`}
              action={updateTicketAction.bind(null, n)}
              ticket={{
                status: ticket.status,
                priority: ticket.priority,
                campusId: ticket.campusId,
                departmentId: ticket.departmentId,
                assignedTeamId: ticket.assignedTeamId,
                assignedAgentId: ticket.assignedAgentId,
              }}
              campuses={options.campuses}
              departments={options.departments}
              teams={options.teams}
              agents={options.agents}
            />

            <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">SLA</dt>
                <dd className="text-right">
                  {ticket.slaPolicy ? (
                    <span className="flex flex-col items-end gap-1">
                      <span className="font-bold">{ticket.slaPolicy.name}</span>
                      <SlaBadge ticket={ticket} />
                    </span>
                  ) : (
                    "None"
                  )}
                </dd>
              </div>
              {dates
                .filter((d): d is [string, Date] => d[1] !== null)
                .map(([label, date]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-muted">{label}</dt>
                    <dd className="text-right tabular-nums">{formatDateTime(date)}</dd>
                  </div>
                ))}
            </dl>
          </CollapsiblePanel>
        </aside>

        <aside aria-label="Requester, tasks and links" className="order-last space-y-4 lg:order-none lg:col-start-2 lg:row-start-2">
          <Card className="p-4 text-sm">
            <h2 className="mb-2 font-bold">Requester</h2>
            <p className="font-bold">{ticket.requester.name}</p>
            <a href={`mailto:${ticket.requester.email}`} className="break-all text-primary hover:underline">
              {ticket.requester.email}
            </a>
            <dl className="mt-3 space-y-1">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Home campus</dt>
                <dd>{ticket.requester.campus?.name ?? "None"}</dd>
              </div>
              {ticket.room && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Room</dt>
                  <dd className="text-right">{ticket.room}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Department</dt>
                <dd>{ticket.department.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Organization</dt>
                <dd>{ticket.requester.organization?.name ?? "None"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Help topic</dt>
                <dd>{ticket.helpTopic?.name ?? "None"}</dd>
              </div>
            </dl>
          </Card>

          <CcPanel
            collaborators={ticket.collaborators}
            viewerId={user.id}
            canManage
            addAction={staffAddCcAction.bind(null, n)}
            removeAction={staffRemoveCcAction.bind(null, n)}
            askName
          />

          <Card className="space-y-3 p-4 text-sm" aria-labelledby="tasks-heading">
            <h2 id="tasks-heading" className="font-bold">
              Tasks {tasks.length > 0 && <span className="text-muted">({tasks.filter((t) => t.status === "OPEN").length} open)</span>}
            </h2>
            {tasks.length > 0 && (
              <ul className="space-y-1">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <form action={toggleTaskAction.bind(null, t.id)}>
                      <button
                        type="submit"
                        className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2"
                        aria-label={t.status === "OPEN" ? `Mark "${t.title}" done` : `Reopen "${t.title}"`}
                      >
                        {t.status === "OPEN" ? <Circle className="size-5" aria-hidden /> : <CheckCircle2 className="size-5 text-resolved" aria-hidden />}
                      </button>
                    </form>
                    <Link href={`/staff/tasks/${t.id}`} className="min-w-0 flex-1 py-1.5 hover:underline">
                      <span className={t.status === "CLOSED" ? "text-muted line-through" : "font-bold"}>{t.title}</span>
                      <span className="block text-xs text-muted">
                        {t.assignedAgent?.name ?? t.assignedTeam?.name ?? "Unassigned"}
                        {t.dueAt && ` · due ${formatDateTime(t.dueAt)}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <QuickTaskForm action={createTaskAction.bind(null, n)} agents={options.agents} teams={options.teams} />
          </Card>

          <Card className="space-y-3 p-4 text-sm" aria-labelledby="links-heading">
            <h2 id="links-heading" className="flex items-center gap-1.5 font-bold">
              <Link2 className="size-4" aria-hidden /> Linked tickets
            </h2>
            {links.length > 0 && (
              <ul className="space-y-1">
                {links.map((l) => (
                  <li key={l.id} className="flex items-center gap-2">
                    <Link href={`/staff/tickets/${l.other.ticketNumber}`} className="min-w-0 flex-1 py-1 hover:underline">
                      <span className="font-mono font-bold tracking-tight">{l.other.ticketNumber}</span>
                      {l.kind === "MERGED" && <span className="text-muted"> · {l.outgoing ? "merged into" : "merged here"}</span>}
                      <span className="block truncate text-muted">{l.other.subject}</span>
                    </Link>
                    {l.kind === "LINKED" && (
                      <form action={unlinkAction.bind(null, n, l.other.ticketNumber)}>
                        <button type="submit" className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label={`Unlink ${l.other.ticketNumber}`}>
                          <X className="size-4" aria-hidden />
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <LinkTicketForm action={linkAction.bind(null, n)} />
            {!mergedInto && ticket.status !== "CLOSED" && <MergeTicketForm action={mergeAction.bind(null, n)} ticketNumber={n} />}
          </Card>
        </aside>

        <section className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {asRequester && (
            <div className="mb-4">
              <Alert tone="info">You're seeing what {ticket.requester.name} sees. Internal notes are hidden.</Alert>
            </div>
          )}

          <Thread entries={ticket.thread} perspective="staff" />

          {!asRequester && (
            <div className="mt-6">
              <Composer
                action={postStaffMessageAction.bind(null, n)}
                accept={ACCEPT_ATTRIBUTE}
                staff
                canned={canned}
                lock={{ ticketId: ticket.id, holder, heartbeat: heartbeatLockAction, release: releaseLockAction }}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
