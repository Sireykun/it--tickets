import clsx from "clsx";
import { ChevronLeft, ChevronRight, Download, LogIn, ScrollText, Search, Settings, Ticket, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { FilterChips, FiltersPopover } from "@/components/ui/list-controls";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDateTime, formatRelative } from "@/lib/format";
import { AUDIT_CATEGORIES, AUDIT_CATEGORY_LABEL, type AuditCategory, describeAction } from "@/lib/labels";
import { parseLocalDateTime } from "@/lib/time";
import { listAuditEvents } from "@/server/audit-log";
import { requireSuperadmin } from "@/server/authz";
import { auditLogParamsSchema } from "@/server/validation";

export const metadata: Metadata = { title: "System log" };

const BASE = "/staff/admin/audit-log";

const CATEGORY_STYLE: Record<AuditCategory, { chip: string; icon: ReactNode }> = {
  auth: { chip: "bg-note-bg text-gold-text", icon: <LogIn /> },
  user: { chip: "bg-progress-soft text-progress", icon: <UserRound /> },
  ticket: { chip: "bg-open-soft text-open", icon: <Ticket /> },
  settings: { chip: "bg-primary-soft text-primary", icon: <Settings /> },
  export: { chip: "bg-warn-soft text-warn", icon: <Download /> },
};

export default async function AuditLogPage({ searchParams }: PageProps<"/staff/admin/audit-log">) {
  const user = await requireSuperadmin();
  const { q, category, from, to, page } = auditLogParamsSchema.parse(await searchParams);

  const { events, total, pageSize } = await listAuditEvents(user, {
    q: q || undefined,
    category,
    from: from ? (parseLocalDateTime(`${from}T00:00`) ?? undefined) : undefined,
    to: to ? (parseLocalDateTime(`${nextDay(to)}T00:00`) ?? undefined) : undefined,
    page,
  });

  const hrefWith = (changes: Partial<Record<"q" | "category" | "from" | "to" | "page", string | null>>) => {
    const p = new URLSearchParams();
    const merged = { q: q || null, category: category ?? null, from: from ?? null, to: to ?? null, page: null, ...changes };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `${BASE}${p.size ? `?${p}` : ""}`;
  };
  const chips = [
    ...(category ? [{ label: AUDIT_CATEGORY_LABEL[category], href: hrefWith({ category: null }) }] : []),
    ...(from ? [{ label: `From ${from}`, href: hrefWith({ from: null }) }] : []),
    ...(to ? [{ label: `To ${to}`, href: hrefWith({ to: null }) }] : []),
  ];
  const first = page * pageSize + 1;
  const last = page * pageSize + events.length;

  return (
    <>
      <PageHeader title="System log" subtitle="Sign-ins, sign-outs, setting changes, ticket activity and exports, newest first." />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <form method="get" action={BASE} className="relative min-w-0 flex-1 basis-56">
            {category && <input type="hidden" name="category" value={category} />}
            {from && <input type="hidden" name="from" value={from} />}
            {to && <input type="hidden" name="to" value={to} />}
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <Input name="q" type="search" defaultValue={q} placeholder="Search by person (name or email)" aria-label="Search by person" className="pl-10" />
          </form>
          <FiltersPopover action={BASE} hidden={{ q: q || undefined }} activeCount={chips.length} clearHref={hrefWith({ category: null, from: null, to: null })}>
            <Select name="category" defaultValue={category ?? ""} aria-label="Type of activity" className="sm:col-span-2">
              <option value="">All activity</option>
              {AUDIT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {AUDIT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
            <label className="grid gap-1 text-sm font-bold">
              From
              <Input name="from" type="date" defaultValue={from} />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              To
              <Input name="to" type="date" defaultValue={to} />
            </label>
          </FiltersPopover>
        </div>
        <FilterChips chips={chips} />
      </div>

      {events.length === 0 ? (
        <EmptyState icon={<ScrollText />} title="No matching activity">
          {chips.length > 0 || q ? "Try removing a filter." : "Activity appears here as people use the system."}
        </EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-border text-sm">
            {events.map((e) => {
              const cat = categoryOf(e.action);
              const detail = details(e.data);
              return (
                <li key={e.id} className="grid gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[2.25rem_1fr_auto] sm:items-center">
                  <span className={clsx("hidden size-9 place-items-center rounded-full sm:grid [&_svg]:size-4", CATEGORY_STYLE[cat].chip)} aria-hidden>
                    {CATEGORY_STYLE[cat].icon}
                  </span>
                  <div className="min-w-0">
                    <p>
                      <span className="font-bold">{e.actor?.name ?? "System"}</span>{" "}
                      <span className={clsx(e.action === "auth.login_failed" && "font-bold text-danger")}>{describeAction(e.action).toLowerCase()}</span>
                      {target(e)}
                    </p>
                    <p className="truncate text-muted">
                      {AUDIT_CATEGORY_LABEL[cat]}
                      {e.actor && ` · ${e.actor.email}`}
                      {detail && ` · ${detail}`}
                    </p>
                  </div>
                  <time dateTime={e.createdAt.toISOString()} className="text-muted tabular-nums sm:text-right">
                    {formatRelative(e.createdAt)}
                    <span className="sm:hidden"> · </span>
                    <span className="text-xs sm:block">{formatDateTime(e.createdAt)}</span>
                  </time>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted">{total === 0 ? "No events" : `Showing ${first}–${last} of ${total}`}</p>
        <div className="flex gap-2">
          {page > 0 && (
            <LinkButton href={hrefWith({ page: page > 1 ? String(page - 1) : null })} variant="secondary">
              <ChevronLeft className="size-4" aria-hidden /> Newer
            </LinkButton>
          )}
          {last < total && (
            <LinkButton href={hrefWith({ page: String(page + 1) })} variant="secondary">
              Older <ChevronRight className="size-4" aria-hidden />
            </LinkButton>
          )}
        </div>
      </nav>
      <p className="mt-4 text-xs text-muted">Sessions that simply expire (after 7 days) don&apos;t appear as sign-outs.</p>
    </>
  );
}

type LogEvent = Awaited<ReturnType<typeof listAuditEvents>>["events"][number];

// Mirrors the grouping in listAuditEvents so each row names the filter it falls under.
function categoryOf(action: string): AuditCategory {
  if (action.endsWith(".export")) return "export";
  if (action.startsWith("auth.")) return "auth";
  if (action.startsWith("user.")) return "user";
  if (action.startsWith("ticket.") || action.startsWith("task.")) return "ticket";
  return "settings";
}

function target(e: LogEvent): ReactNode {
  if (e.ticketNumber) {
    return (
      <>
        {" "}
        <Link href={`/staff/tickets/${e.ticketNumber}`} className="font-bold text-primary hover:underline">
          {e.ticketNumber}
        </Link>
      </>
    );
  }
  // Sign-ins and profile changes are about the actor themselves; only name someone else.
  if (e.targetUserName && e.entityId !== e.actor?.id) return <> for {e.targetUserName}</>;
  return null;
}

function details(data: LogEvent["data"]): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  const parts: string[] = [];
  if (data.via === "google") parts.push("via Google");
  if (data.reason === "inactive") parts.push("account inactive");
  else if (data.reason === "password") parts.push("wrong password");
  if (typeof data.name === "string") parts.push(data.name);
  if (typeof data.title === "string") parts.push(data.title);
  if (typeof data.email === "string") parts.push(data.email);
  if (typeof data.theme === "string") parts.push(`theme: ${data.theme}`);
  if (typeof data.status === "string") parts.push(`status: ${data.status}`);
  if (typeof data.into === "string") parts.push(`into ${data.into}`);
  if (typeof data.to === "string") parts.push(`with ${data.to}`);
  if (typeof data.rows === "number") parts.push(`${data.rows} rows`);
  if (Array.isArray(data.changes)) parts.push(data.changes.filter((c) => typeof c === "string").join("; "));
  return parts.filter(Boolean).join(" · ");
}

// Calendar arithmetic on the "YYYY-MM-DD" string itself, so the server's timezone never shifts the day.
function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
