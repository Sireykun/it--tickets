import { Download, Inbox, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PriorityBadge, SlaBadge, StatusChip } from "@/components/tickets/badges";
import { TicketCard, TicketList } from "@/components/tickets/ticket-card";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { MenuLinkItem } from "@/components/ui/dropdown-menu";
import { Input, Select } from "@/components/ui/field";
import { ChoiceMenu, FilterChips, FiltersPopover, MoreMenuButton } from "@/components/ui/list-controls";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { formatRelative } from "@/lib/format";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/labels";
import { isSuperadmin, requireStaff } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { parseQueueParams } from "@/server/queue-params";
import { assignmentOptions, listQueue, QUEUE_PAGE_SIZE, type QueueSort, type QueueView } from "@/server/tickets";
import { BULK_FORM_ID, BulkBar, SelectAllCheckbox } from "./bulk-bar";

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

const SORT_LABEL: Record<QueueSort, string> = {
  priority: "Priority",
  newest: "Newest",
  oldest: "Oldest",
  updated: "Recently updated",
};

// Query param name → which filter it is, for chips and the active count.
const FILTER_KEYS = ["status", "priority", "team", "topic", "campus"] as const;

export default async function QueuePage({ searchParams }: PageProps<"/staff">) {
  const user = await requireStaff();
  const sp = await searchParams;
  const params = parseQueueParams(sp);

  const [{ tickets, total, page, view }, teams, topics, campuses, options] = await Promise.all([
    listQueue(user, params),
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.helpTopic.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.campus.findMany({
      where: user.campusScope === "all" ? {} : { id: { in: user.campusScope } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    assignmentOptions(user),
  ]);
  // Campus filter and labels only matter to people who see more than one campus.
  const multiCampus = campuses.length > 1;
  const pages = Math.ceil(total / QUEUE_PAGE_SIZE);
  const sort = params.sort ?? "priority";

  const current = Object.fromEntries(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
  const hrefWith = (changes: Record<string, string | null>) => {
    const q = new URLSearchParams(current);
    for (const key of ["page", "bulk", "skipped", "bulkError"]) q.delete(key);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    return `/staff?${q}`;
  };

  const filterLabel: Record<(typeof FILTER_KEYS)[number], (v: string) => string | undefined> = {
    status: (v) => STATUS_LABEL[v as keyof typeof STATUS_LABEL],
    priority: (v) => PRIORITY_LABEL[v as keyof typeof PRIORITY_LABEL],
    team: (v) => teams.find((t) => t.id === v)?.name,
    topic: (v) => topics.find((t) => t.id === v)?.name,
    campus: (v) => campuses.find((c) => c.id === v)?.name,
  };
  const chips = FILTER_KEYS.flatMap((key) => {
    const label = current[key] ? filterLabel[key](current[key]) : undefined;
    return label ? [{ label, href: hrefWith({ [key]: null }) }] : [];
  });
  const filtered = chips.length > 0 || Boolean(params.q);
  const skipped = typeof sp.skipped === "string" ? sp.skipped.split("\n") : [];

  return (
    <>
      <PageHeader
        title={VIEW_TITLE[view]}
        subtitle={`${total} ticket${total === 1 ? "" : "s"}`}
        actions={
          <>
            <LinkButton href="/staff/tickets/new">
              <Plus className="size-5" aria-hidden /> New ticket
            </LinkButton>
            {isSuperadmin(user) && (
              <MoreMenuButton label="More queue actions">
                <MenuLinkItem href={hrefWith({}).replace("/staff?", "/staff/export?")} download icon={<Download />}>
                  Export CSV
                </MenuLinkItem>
              </MoreMenuButton>
            )}
          </>
        }
      />

      {typeof sp.bulk === "string" && (
        <div className="mb-4">
          <Alert tone={skipped.length ? "info" : "success"}>
            Updated {sp.bulk} ticket{sp.bulk === "1" ? "" : "s"}.
            {skipped.length > 0 && (
              <>
                {" "}
                Skipped {skipped.length}:
                <ul className="mt-1 list-disc pl-5 font-normal">
                  {skipped.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </>
            )}
          </Alert>
        </div>
      )}
      {typeof sp.bulkError === "string" && (
        <div className="mb-4">
          <Alert>{sp.bulkError}</Alert>
        </div>
      )}

      <div className="mb-5 space-y-3">
        <form method="get" className="flex gap-2">
          {Object.entries(current)
            .filter(([k]) => !["q", "view", "page", "bulk", "skipped", "bulkError"].includes(k))
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <input type="hidden" name="view" value={view} />
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
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <FiltersPopover
            action="/staff"
            hidden={{ view, q: params.q, sort: params.sort }}
            activeCount={chips.length}
            clearHref={`/staff?view=${view}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
          >
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
          </FiltersPopover>
          <ChoiceMenu
            label="Sort"
            value={sort}
            choices={(Object.keys(SORT_LABEL) as QueueSort[]).map((s) => ({
              value: s,
              label: SORT_LABEL[s],
              href: hrefWith({ sort: s === "priority" ? null : s }),
            }))}
          />
          <FilterChips chips={chips} />
        </div>
      </div>

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
          <BulkBar agents={options.agents} teams={options.teams} />

          {/* Phones, tablets and laptops beside the sidebar: rows. The seven-column table needs ~900px of content width. */}
          <label className="mb-2 flex min-h-11 w-fit cursor-pointer items-center gap-3 pl-3.5 text-sm font-bold text-muted xl:hidden">
            <SelectAllCheckbox />
            Select all on this page
          </label>
          <TicketList className="xl:hidden">
            {tickets.map((t) => (
              <li key={t.id} className="flex items-stretch">
                <label className="grid w-12 shrink-0 cursor-pointer place-items-center border-r border-border">
                  <input type="checkbox" name="tickets" value={t.ticketNumber} form={BULK_FORM_ID} aria-label={`Select ${t.ticketNumber}`} className="size-5 rounded accent-primary" />
                </label>
                <div className="min-w-0 flex-1">
                  <TicketCard ticket={t} href={`/staff/tickets/${t.ticketNumber}`} variant="staff" />
                </div>
              </li>
            ))}
          </TicketList>

          {/* Wide screens: table */}
          <Card className="hidden overflow-x-auto xl:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-2/60 text-xs text-muted">
                <tr>
                  <th className="w-12 py-3 pl-4">
                    <SelectAllCheckbox />
                  </th>
                  <th className="px-3 py-3 font-bold">Ticket</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="hidden px-3 py-3 font-bold 2xl:table-cell">Priority</th>
                  <th className="px-3 py-3 font-bold">SLA</th>
                  <th className="px-3 py-3 font-bold">Assignee</th>
                  <th className="px-4 py-3 text-right font-bold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((t) => {
                  const awaiting = t.status !== "CLOSED" && t.thread[0]?.type === "CLIENT_MESSAGE";
                  return (
                    <tr key={t.id} className="relative transition-colors hover:bg-surface-2/70 has-checked:bg-primary-soft/60">
                      <td className="py-3 pl-4">
                        <input
                          type="checkbox"
                          name="tickets"
                          value={t.ticketNumber}
                          form={BULK_FORM_ID}
                          aria-label={`Select ${t.ticketNumber}`}
                          className="relative z-10 size-5 cursor-pointer rounded accent-primary"
                        />
                      </td>
                      {/* w-full + max-w-0 lets this column absorb the leftover width and truncate, instead of pushing the table wider. */}
                      <td className="w-full max-w-0 px-3 py-3">
                        <Link href={`/staff/tickets/${t.ticketNumber}`} className="block after:absolute after:inset-0 after:left-12">
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
                        {/* Below 2xl, priority stacks under status so the subject column keeps its width. */}
                        <span className="flex flex-col items-start gap-1.5">
                          <StatusChip status={t.status} />
                          <span className="2xl:hidden">
                            <PriorityBadge priority={t.priority} />
                          </span>
                        </span>
                      </td>
                      <td className="hidden px-3 py-3 2xl:table-cell">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-3 py-3">
                        <SlaBadge ticket={t} compact />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
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
              {page > 0 ? <LinkButton href={hrefWith({ page: String(page - 1) })} variant="secondary">Previous</LinkButton> : <span />}
              <span className="text-sm text-muted tabular-nums">
                Page {page + 1} of {pages}
              </span>
              {page + 1 < pages ? <LinkButton href={hrefWith({ page: String(page + 1) })} variant="secondary">Next</LinkButton> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}
