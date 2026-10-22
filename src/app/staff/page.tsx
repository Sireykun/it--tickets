import { Download, Inbox, Plus, Search, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PriorityBadge, SlaBadge, StatusChip } from "@/components/tickets/badges";
import { TicketCard, TicketList } from "@/components/tickets/ticket-card";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { formatRelative } from "@/lib/format";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/labels";
import { isSuperadmin, requireStaff } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { parseQueueParams } from "@/server/queue-params";
import { listQueue, QUEUE_PAGE_SIZE, type QueueView } from "@/server/tickets";

export const metadata: Metadata = { title: "Queue" };

const VIEW_TITLE: Record<QueueView, string> = {
  personal: "My open tickets",
  unassigned: "Unassigned",
  mine: "My tickets",
  teams: "My teams",
  open: "All open",
  overdue: "Overdue",
  all: "All tickets",
};

export default async function QueuePage({ searchParams }: PageProps<"/staff">) {
  const user = await requireStaff();
  const sp = await searchParams;
  const params = parseQueueParams(sp);

  const [{ tickets, total, page, view }, teams, topics, orgs, campuses] = await Promise.all([
    listQueue(user, params),
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.helpTopic.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.campus.findMany({
      where: user.campusScope === "all" ? {} : { id: { in: user.campusScope } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const filtered = Boolean(params.status || params.priority || params.teamId || params.topicId || params.orgId || params.campusId || params.q);
  // Campus filter and labels only matter to people who see more than one campus.
  const multiCampus = campuses.length > 1;
  const pages = Math.ceil(total / QUEUE_PAGE_SIZE);

  const pageHref = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
    q.set("page", String(p));
    return `/staff?${q}`;
  };

  return (
    <>
      <PageHeader
        title={VIEW_TITLE[view]}
        subtitle={`${total} ticket${total === 1 ? "" : "s"}`}
        actions={
          <>
            {isSuperadmin(user) && (
            <a
              href={`/staff/export?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string" && e[0] !== "page"))}`}
              className={buttonClass({ variant: "secondary" })}
              download
            >
              <Download className="size-5" aria-hidden /> <span className="hidden sm:inline">Export CSV</span>
              <span className="sr-only sm:hidden">Export CSV</span>
            </a>
            )}
            <LinkButton href="/staff/tickets/new">
              <Plus className="size-5" aria-hidden /> New ticket
            </LinkButton>
          </>
        }
      />

      <form method="get" className="mb-5 space-y-3">
        <input type="hidden" name="view" value={view} />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="q" className="sr-only">
              Search
            </label>
            <Input id="q" name="q" type="search" defaultValue={params.q} placeholder="Search number, subject, requester…" className="pl-10" />
          </div>
          <button type="submit" className={buttonClass({ variant: "secondary" })}>
            Search
          </button>
        </div>
        <details className="group md:open:block" open={filtered || undefined}>
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-1 font-bold text-muted hover:text-text">
            <SlidersHorizontal className="size-4" aria-hidden /> Filters{filtered && " (active)"}
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            <Select name="status" defaultValue={params.status ?? ""} aria-label="Status">
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
            <Select name="priority" defaultValue={params.priority ?? ""} aria-label="Priority">
              <option value="">Any priority</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
            <Select name="team" defaultValue={params.teamId ?? ""} aria-label="Team">
              <option value="">Any team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select name="topic" defaultValue={params.topicId ?? ""} aria-label="Help topic">
              <option value="">Any topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            {multiCampus && (
              <Select name="campus" defaultValue={params.campusId ?? ""} aria-label="Campus">
                <option value="">Any campus</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            <Select name="org" defaultValue={params.orgId ?? ""} aria-label="Organization">
              <option value="">Any organization</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <div className="col-span-2 flex gap-2 md:col-span-1">
              <button type="submit" className={buttonClass({ className: "flex-1" })}>
                Apply
              </button>
              {filtered && (
                <LinkButton href={`/staff?view=${view}`} variant="ghost">
                  Clear
                </LinkButton>
              )}
            </div>
          </div>
        </details>
      </form>

      {tickets.length === 0 ? (
        <Card>
          {view === "personal" && !filtered ? (
            <EmptyState icon={<Inbox className="size-7" />} title="No open tickets">
              <p>Tickets assigned to you or that you open will show up here.</p>
              <LinkButton href="/staff/tickets/new" className="mt-5">
                <Plus className="size-5" aria-hidden /> New ticket
              </LinkButton>
            </EmptyState>
          ) : (
            <EmptyState icon={<Inbox className="size-7" />} title={filtered ? "No tickets match these filters" : "Nothing here"}>
              {view === "unassigned" && !filtered && "Every ticket has an owner. Nice work."}
            </EmptyState>
          )}
        </Card>
      ) : (
        <>
          {/* Phones: rows */}
          <TicketList className="md:hidden">
            {tickets.map((t) => (
              <li key={t.id}>
                <TicketCard ticket={t} href={`/staff/tickets/${t.ticketNumber}`} variant="staff" />
              </li>
            ))}
          </TicketList>

          {/* Tablets and up: table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-2/60 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">Ticket</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-3 py-3 font-bold">Priority</th>
                  <th className="px-3 py-3 font-bold">SLA</th>
                  <th className="px-3 py-3 font-bold">Assignee</th>
                  <th className="px-4 py-3 text-right font-bold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((t) => {
                  const awaiting = t.status !== "CLOSED" && t.thread[0]?.type === "CLIENT_MESSAGE";
                  return (
                    <tr key={t.id} className="relative transition-colors hover:bg-surface-2/70">
                      <td className="max-w-md px-4 py-3">
                        <Link href={`/staff/tickets/${t.ticketNumber}`} className="block after:absolute after:inset-0">
                          <span className="flex items-center gap-2 text-xs text-muted">
                            <span className="font-mono tracking-tight">{t.ticketNumber}</span>
                            {awaiting && <span className="size-2 rounded-full bg-primary" title="Awaiting reply" />}
                          </span>
                          <span className="block truncate text-[15px] font-bold">{t.subject}</span>
                          <span className="block truncate text-muted">
                            {multiCampus && t.campus ? `${t.campus.name} · ` : ""}
                            {t.requester.name}
                            {t.helpTopic && ` · ${t.helpTopic.name}`}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <StatusChip status={t.status} />
                      </td>
                      <td className="px-3 py-3">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-3 py-3">
                        <SlaBadge ticket={t} compact />
                      </td>
                      <td className="px-3 py-3">
                        <span className="block font-bold">{t.assignedAgent?.name ?? <span className="text-muted">Unassigned</span>}</span>
                        <span className="block text-muted">{t.assignedTeam?.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-muted tabular-nums">{formatRelative(t.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {pages > 1 && (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between">
              {page > 0 ? <LinkButton href={pageHref(page - 1)} variant="secondary">Previous</LinkButton> : <span />}
              <span className="text-sm text-muted tabular-nums">
                Page {page + 1} of {pages}
              </span>
              {page + 1 < pages ? <LinkButton href={pageHref(page + 1)} variant="secondary">Next</LinkButton> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}
