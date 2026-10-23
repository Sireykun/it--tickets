import clsx from "clsx";
import {
  AlarmClock,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Flame,
  Inbox,
  ListTodo,
  Mail,
  MessageSquareText,
  School,
  Tags,
  Timer,
  TrendingUp,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/misc";
import { StatTile } from "@/components/ui/stats";
import { formatRelative } from "@/lib/format";
import { ROLE_LABEL, ROLES } from "@/lib/labels";
import { type AdminDashboard, getAdminDashboard } from "@/server/admin-dashboard";
import { requireSuperadmin } from "@/server/authz";
import { emailEnabled } from "@/server/email/notify";

export const metadata: Metadata = { title: "Admin dashboard" };

// Literal class names so Tailwind generates them. Past the sixth campus, colour falls back to neutral grey
// rather than repeating a hue (two campuses must never share a colour).
const CAMPUS_BG = ["bg-campus-1", "bg-campus-2", "bg-campus-3", "bg-campus-4", "bg-campus-5", "bg-campus-6"];
const CAMPUS_BORDER = ["border-l-campus-1", "border-l-campus-2", "border-l-campus-3", "border-l-campus-4", "border-l-campus-5", "border-l-campus-6"];
const campusBg = (slot: number | null) => (slot === null ? "bg-closed" : (CAMPUS_BG[slot] ?? "bg-closed"));
const campusBorder = (slot: number | null) => (slot === null ? "border-l-closed" : (CAMPUS_BORDER[slot] ?? "border-l-closed"));

const ROLE_CHIP = {
  USER: "bg-surface-2 text-muted",
  AGENT: "bg-open-soft text-open",
  ADMIN: "bg-progress-soft text-progress",
  SUPERADMIN: "bg-note-bg text-gold-text",
} as const;

type Campus = AdminDashboard["campuses"][number];

export default async function AdminDashboardPage() {
  const user = await requireSuperadmin();
  const d = await getAdminDashboard(user);
  const t = d.tickets;
  const { outbox, inbound } = d.email;

  const configLinks: { href: string; label: string; icon: ReactNode; chip: string; active: number; total: number; activeLabel?: string }[] = [
    { href: "/staff/admin/campuses", label: "Campuses", icon: <School />, chip: "bg-open-soft text-open", ...d.config.campuses },
    { href: "/staff/admin/departments", label: "Departments", icon: <Building2 />, chip: "bg-progress-soft text-progress", ...d.config.departments },
    { href: "/staff/admin/teams", label: "Teams", icon: <UsersRound />, chip: "bg-resolved-soft text-resolved", ...d.config.teams },
    { href: "/staff/admin/help-topics", label: "Help topics", icon: <Tags />, chip: "bg-primary-soft text-primary", ...d.config.helpTopics },
    { href: "/staff/admin/sla", label: "SLA policies", icon: <Timer />, chip: "bg-warn-soft text-warn", ...d.config.slaPolicies },
    { href: "/staff/admin/canned", label: "Canned replies", icon: <MessageSquareText />, chip: "bg-note-bg text-gold-text", ...d.config.cannedResponses },
    {
      href: "/staff/admin/knowledge-base",
      label: "KB articles",
      icon: <BookOpen />,
      chip: "bg-accent-green-soft text-accent-green",
      ...d.config.kbArticles,
      activeLabel: "published",
    },
  ];

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        subtitle={`Everything at a glance, across all campuses. Outgoing email is ${emailEnabled() ? "on" : "off"}.`}
        actions={
          <LinkButton href="/staff/reports" variant="secondary">
            <BarChart3 className="size-4" aria-hidden /> Reports
          </LinkButton>
        }
      />

      <section aria-label="Ticket health, all campuses" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile accent="open" icon={<Inbox />} label="Open tickets" value={t.open} href="/staff?view=open" />
        <StatTile accent="warn" icon={<UserRound />} label="Unassigned" value={t.unassigned} tone={t.unassigned > 0 ? "warn" : undefined} href="/staff?view=unassigned" />
        <StatTile accent="danger" icon={<AlarmClock />} label="Overdue" value={t.overdue} tone={t.overdue > 0 ? "danger" : undefined} href="/staff?view=overdue" />
        <StatTile accent="warn" icon={<Flame />} label="High / emergency" value={t.urgent} hint="Open tickets" tone={t.urgent > 0 ? "warn" : undefined} />
        <StatTile accent="primary" icon={<TrendingUp />} label="New" value={t.createdDay} hint="Last 24 hours" />
        <StatTile accent="resolved" icon={<CheckCircle2 />} label="Resolved" value={t.resolvedDay} hint="Last 24 hours" />
        <StatTile accent="progress" icon={<ListTodo />} label="Open tasks" value={t.openTasks} href="/staff/tasks" />
        <StatTile accent="gold" icon={<Users />} label="Signed in" value={d.people.recentLogins} hint="Users, last 7 days" />
      </section>

      <section aria-labelledby="campuses-heading" className="mb-6">
        <h2 id="campuses-heading" className="mb-2 text-lg font-bold">
          Campuses
        </h2>
        <CampusShare campuses={d.campuses} total={t.open} />
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {d.campuses.map((c) => (
            <li key={c.id ?? "none"}>
              <CampusCard campus={c} />
            </li>
          ))}
        </ul>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <CardTitle icon={<UserRound />} chip="bg-open-soft text-open">
            Busiest agents
          </CardTitle>
          {d.topAgents.length === 0 ? (
            <p className="text-sm text-muted">No open tickets are assigned.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {d.topAgents.map((a) => (
                <li key={a.id} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3">
                  <span className="truncate font-bold">{a.name}</span>
                  <span className="h-2.5 rounded-full bg-surface-2">
                    <span className="block h-full rounded-full bg-open" style={{ width: `${(a.open / d.topAgents[0].open) * 100}%` }} />
                  </span>
                  <span className="text-right font-bold tabular-nums">{a.open}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <SummaryCard title="User management" icon={<Users />} chip="bg-progress-soft text-progress" href="/staff/admin/users" linkLabel="Manage users">
          {ROLES.map((role) => (
            <Row key={role} label={<span className={clsx("rounded-full px-2 py-0.5 text-xs font-bold", ROLE_CHIP[role])}>{ROLE_LABEL[role]}</span>} value={d.people.activeByRole[role] ?? 0} />
          ))}
          <Row label="Inactive accounts" value={d.people.inactive} />
        </SummaryCard>

        <SummaryCard title="Email" icon={<Mail />} chip="bg-primary-soft text-primary" href="/staff/admin/email" linkLabel="Email settings">
          <Row label="Waiting to send" value={(outbox.PENDING ?? 0) + (outbox.SENDING ?? 0)} />
          <Row label="Sent" value={outbox.SENT ?? 0} tone="good" />
          <Row label="Failed to send" value={outbox.FAILED ?? 0} tone="bad" />
          <Row label="Received (7 days)" value={inbound.PROCESSED ?? 0} tone="good" />
          <Row label="Rejected (7 days)" value={inbound.REJECTED ?? 0} tone="warn" />
          <Row label="Failed to process (7 days)" value={inbound.FAILED ?? 0} tone="bad" />
        </SummaryCard>
      </div>

      <section aria-labelledby="config-heading" className="mb-6">
        <h2 id="config-heading" className="mb-2 text-lg font-bold">
          Configuration
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {configLinks.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-primary/40">
                <span className={clsx("grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5", c.chip)} aria-hidden>
                  {c.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{c.label}</span>
                  <span className="block text-sm text-muted">
                    {c.active} {c.activeLabel ?? "active"} · {c.total} total
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="activity-heading">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="activity-heading" className="text-lg font-bold">
            Recent activity
          </h2>
          <Link href="/staff/admin/audit-log" className="inline-flex min-h-11 items-center gap-1 font-bold text-primary hover:underline">
            View full log <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        <Card>
          <ul className="divide-y divide-border text-sm">
            {d.activity.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3">
                <span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-xs font-bold text-primary">{e.action}</span>
                <span className="min-w-0 flex-1 truncate text-muted">by {e.actor?.name ?? "System"}</span>
                <time dateTime={e.createdAt.toISOString()} className="text-muted">
                  {formatRelative(e.createdAt)}
                </time>
              </li>
            ))}
            {d.activity.length === 0 && <li className="px-4 py-8 text-center text-muted">No activity yet.</li>}
          </ul>
        </Card>
      </section>
    </>
  );
}

// One bar split by campus, so the share of the open workload reads at a glance. Every segment is named
// in the legend below, so colour is never the only way to tell campuses apart.
function CampusShare({ campuses, total }: { campuses: Campus[]; total: number }) {
  const withOpen = campuses.filter((c) => c.open > 0);
  return (
    <Card className="p-4 sm:p-5">
      <p className="mb-3 text-sm font-bold text-muted">Share of open tickets</p>
      {total === 0 ? (
        <p className="text-sm text-muted">No open tickets.</p>
      ) : (
        <div className="flex h-4 gap-0.5" role="img" aria-label={withOpen.map((c) => `${c.name}: ${c.open} open`).join(", ")}>
          {withOpen.map((c) => (
            <span
              key={c.id ?? "none"}
              title={`${c.name}: ${c.open} open (${Math.round((c.open / total) * 100)}%)`}
              className={clsx("h-full first:rounded-l-full last:rounded-r-full", campusBg(c.slot))}
              style={{ width: `${(c.open / total) * 100}%` }}
            />
          ))}
        </div>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {campuses.map((c) => (
          <li key={c.id ?? "none"} className="flex items-center gap-2">
            <span aria-hidden className={clsx("size-3 rounded-full", campusBg(c.slot))} />
            <span className="font-bold">{c.name}</span>
            <span className="text-muted tabular-nums">
              {c.open}
              {total > 0 && ` · ${Math.round((c.open / total) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CampusCard({ campus: c }: { campus: Campus }) {
  const href = c.id ? `/staff?view=open&campus=${c.id}` : "/staff?view=open";
  return (
    <Link
      href={href}
      className={clsx(
        "block h-full rounded-xl border border-l-[6px] border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-raised",
        campusBorder(c.slot),
      )}
    >
      <p className="flex items-center gap-2">
        <span aria-hidden className={clsx("size-3 shrink-0 rounded-full", campusBg(c.slot))} />
        <span className="min-w-0 flex-1 truncate font-bold">{c.name}</span>
        {!c.isActive && <span className="rounded-full bg-closed-soft px-2 py-0.5 text-xs font-bold text-closed">Inactive</span>}
      </p>
      <p className="mt-2 font-mono text-3xl font-bold tracking-tight tabular-nums">{c.open}</p>
      <p className="mb-3 text-xs text-muted">open tickets</p>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <Pill label="Unassigned" value={c.unassigned} tone="warn" />
        <Pill label="Overdue" value={c.overdue} tone="bad" />
        <Pill label="High / emerg." value={c.urgent} tone="warn" />
        <Pill label="New 24h" value={c.createdDay} tone="info" />
      </dl>
    </Link>
  );
}

const PILL_TONE = {
  warn: "bg-warn-soft text-warn",
  bad: "bg-danger-soft text-danger",
  info: "bg-primary-soft text-primary",
} as const;

// Grey when zero so only real problems light up; the label always names what the number is.
function Pill({ label, value, tone }: { label: string; value: number; tone: keyof typeof PILL_TONE }) {
  return (
    <div className={clsx("flex items-center justify-between gap-2 rounded-lg px-2 py-1.5", value > 0 ? PILL_TONE[tone] : "bg-surface-2 text-muted")}>
      <dt className="truncate">{label}</dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function CardTitle({ icon, chip, children }: { icon: ReactNode; chip: string; children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-bold">
      <span className={clsx("grid size-7 place-items-center rounded-full [&_svg]:size-4", chip)} aria-hidden>
        {icon}
      </span>
      {children}
    </h2>
  );
}

function SummaryCard({ title, icon, chip, href, linkLabel, children }: { title: string; icon: ReactNode; chip: string; href: string; linkLabel: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <CardTitle icon={icon} chip={chip}>
        {title}
      </CardTitle>
      <dl className="flex-1 divide-y divide-border text-sm">{children}</dl>
      <Link href={href} className="mt-3 inline-flex min-h-11 items-center gap-1 self-start font-bold text-primary hover:underline">
        {linkLabel} <ChevronRight className="size-4" aria-hidden />
      </Link>
    </Card>
  );
}

const ROW_TONE = { good: "text-resolved", warn: "text-warn", bad: "text-danger" } as const;

function Row({ label, value, tone }: { label: ReactNode; value: number; tone?: keyof typeof ROW_TONE }) {
  const needsAttention = tone === "bad" && value > 0;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className={clsx("font-bold tabular-nums", tone && value > 0 && ROW_TONE[tone])}>
        {value}
        {needsAttention && <span className="sr-only"> (needs attention)</span>}
      </dd>
    </div>
  );
}
