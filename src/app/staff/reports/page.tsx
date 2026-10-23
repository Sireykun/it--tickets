import { AlarmClock, CalendarRange, CheckCircle2, Download, Inbox, School, ShieldAlert, Timer, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { MenuLinkItem } from "@/components/ui/dropdown-menu";
import { ChoiceMenu, MoreMenuButton } from "@/components/ui/list-controls";
import { Card, PageHeader } from "@/components/ui/misc";
import { Breakdown, StatTile } from "@/components/ui/stats";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import { requireSuperadmin } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { getReport, REPORT_RANGES, type ReportRange } from "@/server/reports";
import { formatDuration } from "@/server/sla";
import { DailyChart } from "./daily-chart";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/staff/reports">) {
  const user = await requireSuperadmin();
  const sp = await searchParams;
  const days = (REPORT_RANGES as readonly number[]).includes(Number(sp.days)) ? (Number(sp.days) as ReportRange) : 30;
  const campuses = await prisma.campus.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const campusId = typeof sp.campus === "string" && campuses.some((c) => c.id === sp.campus) ? sp.campus : undefined;
  const report = await getReport(user, { days, campusId });

  const hrefWith = (changes: { days?: number; campus?: string | null }) => {
    const p = new URLSearchParams();
    const d = changes.days ?? days;
    const c = changes.campus === undefined ? campusId : changes.campus;
    if (d !== 30) p.set("days", String(d));
    if (c) p.set("campus", c);
    return `/staff/reports${p.size ? `?${p}` : ""}`;
  };
  const exportQuery = new URLSearchParams({ days: String(days), ...(campusId ? { campus: campusId } : {}) });
  const t = report.totals;
  const duration = (ms: number | null) => (ms === null ? "—" : formatDuration(ms));

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Last ${days} days${campusId ? ` · ${campuses.find((c) => c.id === campusId)?.name}` : " · all campuses"}`}
        actions={
          <MoreMenuButton label="More report actions">
            <MenuLinkItem href={`/staff/reports/export?${exportQuery}`} download icon={<Download />}>
              Download CSV
            </MenuLinkItem>
          </MoreMenuButton>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <ChoiceMenu
          label="Range"
          icon={<CalendarRange className="size-4" aria-hidden />}
          value={String(days)}
          choices={REPORT_RANGES.map((d) => ({ value: String(d), label: `Last ${d} days`, href: hrefWith({ days: d }) }))}
        />
        {campuses.length > 1 && (
          <ChoiceMenu
            label="Campus"
            icon={<School className="size-4" aria-hidden />}
            value={campusId ?? "all"}
            choices={[
              { value: "all", label: "All campuses", href: hrefWith({ campus: null }) },
              ...campuses.map((c) => ({ value: c.id, label: c.name, href: hrefWith({ campus: c.id }) })),
            ]}
          />
        )}
      </div>

      <section aria-label="Key numbers" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={<TrendingUp />} label="New tickets" value={t.created} />
        <StatTile icon={<CheckCircle2 />} label="Resolved" value={t.resolved} />
        <StatTile icon={<Inbox />} label="Open now" value={t.openNow} href="/staff?view=open" />
        <StatTile icon={<AlarmClock />} label="Overdue now" value={t.overdueNow} tone={t.overdueNow > 0 ? "danger" : undefined} href="/staff?view=overdue" />
        <StatTile icon={<Timer />} label="Median first response" value={duration(t.medianFirstResponseMs)} />
        <StatTile icon={<Timer />} label="Median time to resolve" value={duration(t.medianResolutionMs)} />
        <StatTile
          icon={<ShieldAlert />}
          label="Missed SLA"
          value={t.breached}
          hint={t.created > 0 ? `${Math.round((t.breached / t.created) * 100)}% of new tickets` : undefined}
          tone={t.breached > 0 ? "warn" : undefined}
        />
        <StatTile icon={<CheckCircle2 />} label="Resolved vs new" value={t.created > 0 ? `${Math.round((t.resolved / t.created) * 100)}%` : "—"} />
      </section>

      <Card className="mb-6 p-4 sm:p-5">
        <h2 className="mb-1 font-bold">New vs resolved per day</h2>
        <p className="mb-4 text-sm text-muted">Days are counted in school time.</p>
        <DailyChart days={report.daily} />
      </Card>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Breakdown title="By status" rows={report.byStatus.map((r) => ({ label: STATUS_LABEL[r.key], count: r.count }))} />
        <Breakdown title="By priority" rows={report.byPriority.map((r) => ({ label: PRIORITY_LABEL[r.key], count: r.count }))} />
        <Breakdown title="By help topic" rows={report.byTopic} />
        {!campusId && campuses.length > 1 && <Breakdown title="By campus" rows={report.byCampus} />}
      </div>

      <Card className="overflow-x-auto">
        <h2 className="px-4 pt-4 font-bold sm:px-5">Agents</h2>
        <p className="px-4 pb-3 text-sm text-muted sm:px-5">Assigned tickets: open now, resolved and median first response in this range.</p>
        {report.agents.length === 0 ? (
          <p className="px-5 pb-6 text-muted">No assigned tickets in this range.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-y border-border bg-surface-2/60 text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-bold sm:px-5">Agent</th>
                <th className="px-3 py-3 text-right font-bold">Open</th>
                <th className="px-3 py-3 text-right font-bold">Resolved</th>
                <th className="px-4 py-3 text-right font-bold sm:px-5">First response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.agents.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-bold sm:px-5">{a.name}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{a.open}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{a.resolved}</td>
                  <td className="px-4 py-3 text-right tabular-nums sm:px-5">{duration(a.firstResponseMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
