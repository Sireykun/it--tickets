import { toCsv } from "@/lib/csv";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import { audit } from "@/server/audit";
import { getCurrentUser, isSuperadmin } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { getReport, REPORT_RANGES, type ReportRange } from "@/server/reports";

// The Reports page as CSV: one section per table, separated by a blank line.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isSuperadmin(user)) return new Response("Not found", { status: 404 });

  const sp = new URL(request.url).searchParams;
  const days = (REPORT_RANGES as readonly number[]).includes(Number(sp.get("days"))) ? (Number(sp.get("days")) as ReportRange) : 30;
  const campusParam = sp.get("campus");
  const campusId = campusParam && (await prisma.campus.count({ where: { id: campusParam } })) ? campusParam : undefined;
  const r = await getReport(user, { days, campusId });
  const hours = (ms: number | null) => (ms === null ? "" : (ms / 3_600_000).toFixed(1));

  const csv = [
    toCsv(
      ["Metric", "Value"],
      [
        ["Range (days)", days],
        ["New tickets", r.totals.created],
        ["Resolved", r.totals.resolved],
        ["Open now", r.totals.openNow],
        ["Overdue now", r.totals.overdueNow],
        ["Missed SLA", r.totals.breached],
        ["Median first response (hours)", hours(r.totals.medianFirstResponseMs)],
        ["Median time to resolve (hours)", hours(r.totals.medianResolutionMs)],
      ],
    ),
    toCsv(["Day", "New", "Resolved"], r.daily.map((d) => [d.day, d.created, d.resolved])),
    toCsv(["Status", "Tickets"], r.byStatus.map((s) => [STATUS_LABEL[s.key], s.count])),
    toCsv(["Priority", "Tickets"], r.byPriority.map((p) => [PRIORITY_LABEL[p.key], p.count])),
    toCsv(["Help topic", "Tickets"], r.byTopic.map((t) => [t.label, t.count])),
    toCsv(["Campus", "Tickets"], r.byCampus.map((c) => [c.label, c.count])),
    toCsv(["Agent", "Open", "Resolved", "Median first response (hours)"], r.agents.map((a) => [a.name, a.open, a.resolved, hours(a.firstResponseMs)])),
  ].join("\r\n");
  await audit(prisma, user, "report.export", { type: "report", id: String(days) }, { campusId: campusId ?? null });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="helpdesk-report-${days}d-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
