import { Prisma } from "@/generated/prisma/client";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";
import { APP_TIME_ZONE } from "@/lib/time";
import { prisma } from "@/server/prisma";
import { type AppUser, inScope, isSuperadmin } from "@/server/roles";
import { campusWhere, TicketError } from "@/server/tickets";

// Read-only helpdesk statistics for the Reports page (superadmin-only, so no audit row).

export const REPORT_RANGES = [7, 30, 90] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

type Count<K> = { key: K; label: string; count: number };

export type Report = Awaited<ReturnType<typeof getReport>>;

export async function getReport(
  actor: Pick<AppUser, "role" | "campusScope">,
  opts: { days: ReportRange; campusId?: string },
  now: Date = new Date(),
) {
  if (!isSuperadmin(actor)) throw new TicketError("Not allowed.");
  if (opts.campusId && !inScope(actor.campusScope, opts.campusId)) throw new TicketError("Not allowed.");
  const since = new Date(now.getTime() - opts.days * 86_400_000);
  const scope: Prisma.TicketWhereInput = { AND: [campusWhere(actor), opts.campusId ? { campusId: opts.campusId } : {}] };
  const campusSql = opts.campusId ? Prisma.sql`AND t.campus_id = ${opts.campusId}::uuid` : Prisma.empty;
  const inRange = { AND: [scope, { createdAt: { gte: since } }] };

  // Sequential on purpose: a handful of cheap queries, and it keeps the pool free for page requests.
  const created = await prisma.ticket.count({ where: inRange });
  const resolved = await prisma.ticket.count({ where: { AND: [scope, { resolvedAt: { gte: since } }] } });
  const openNow = await prisma.ticket.count({ where: { AND: [scope, { status: { in: ["OPEN", "IN_PROGRESS"] } }] } });
  const overdueNow = await prisma.ticket.count({
    where: {
      AND: [
        scope,
        { status: { in: ["OPEN", "IN_PROGRESS"] } },
        { OR: [{ firstRespondedAt: null, firstResponseDueAt: { lt: now } }, { resolutionDueAt: { lt: now } }] },
      ],
    },
  });

  const [timing] = await prisma.$queryRaw<{ firstResponseS: number | null; resolutionS: number | null; breached: number }[]>`
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM t.first_responded_at - t.created_at)::float8)
        FILTER (WHERE t.first_responded_at IS NOT NULL) AS "firstResponseS",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM t.resolved_at - t.created_at)::float8)
        FILTER (WHERE t.resolved_at IS NOT NULL) AS "resolutionS",
      count(*) FILTER (WHERE
        t.first_responded_at > t.first_response_due_at
        OR t.resolved_at > t.resolution_due_at
        OR (t.status IN ('OPEN', 'IN_PROGRESS') AND (
          (t.first_responded_at IS NULL AND t.first_response_due_at < ${now})
          OR t.resolution_due_at < ${now}
        ))
      )::int AS breached
    FROM tickets t
    WHERE t.created_at >= ${since} ${campusSql}`;

  // Days are bucketed in the school's timezone, so "today" matches the wall clock at school.
  const daily = await prisma.$queryRaw<{ day: string; created: number; resolved: number }[]>`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', ${now}::timestamptz AT TIME ZONE ${APP_TIME_ZONE}) - make_interval(days => ${opts.days - 1}::int),
        date_trunc('day', ${now}::timestamptz AT TIME ZONE ${APP_TIME_ZONE}),
        interval '1 day'
      ) AS day
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
      (SELECT count(*) FROM tickets t WHERE date_trunc('day', t.created_at AT TIME ZONE ${APP_TIME_ZONE}) = d.day ${campusSql})::int AS created,
      (SELECT count(*) FROM tickets t WHERE date_trunc('day', t.resolved_at AT TIME ZONE ${APP_TIME_ZONE}) = d.day ${campusSql})::int AS resolved
    FROM days d
    ORDER BY d.day`;

  const agents = await prisma.$queryRaw<{ id: string; name: string; open: number; resolved: number; firstResponseS: number | null }[]>`
    SELECT u.id, u.name,
      count(*) FILTER (WHERE t.status IN ('OPEN', 'IN_PROGRESS'))::int AS open,
      count(*) FILTER (WHERE t.resolved_at >= ${since})::int AS resolved,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM t.first_responded_at - t.created_at)::float8)
        FILTER (WHERE t.first_responded_at IS NOT NULL AND t.created_at >= ${since}) AS "firstResponseS"
    FROM tickets t
    JOIN users u ON u.id = t.assigned_agent_id
    WHERE (t.status IN ('OPEN', 'IN_PROGRESS') OR t.resolved_at >= ${since} OR t.created_at >= ${since}) ${campusSql}
    GROUP BY u.id, u.name
    ORDER BY resolved DESC, open DESC, u.name
    LIMIT 50`;

  const byStatus = await prisma.ticket.groupBy({ by: ["status"], where: inRange, _count: { _all: true } });
  const byPriority = await prisma.ticket.groupBy({ by: ["priority"], where: inRange, _count: { _all: true } });
  const byTopic = await prisma.ticket.groupBy({ by: ["helpTopicId"], where: inRange, _count: { _all: true } });
  const byCampus = await prisma.ticket.groupBy({ by: ["campusId"], where: inRange, _count: { _all: true } });
  const topics = await prisma.helpTopic.findMany({ select: { id: true, name: true } });
  const campuses = await prisma.campus.findMany({ select: { id: true, name: true } });
  const nameOf = (rows: { id: string; name: string }[], id: string | null, fallback: string) => rows.find((r) => r.id === id)?.name ?? fallback;
  const sorted = <K>(rows: Count<K>[]) => rows.sort((a, b) => b.count - a.count);

  return {
    days: opts.days,
    since,
    totals: {
      created,
      resolved,
      openNow,
      overdueNow,
      breached: timing?.breached ?? 0,
      medianFirstResponseMs: timing?.firstResponseS == null ? null : timing.firstResponseS * 1000,
      medianResolutionMs: timing?.resolutionS == null ? null : timing.resolutionS * 1000,
    },
    daily,
    byStatus: byStatus.map((r): Count<TicketStatus> => ({ key: r.status, label: r.status, count: r._count._all })),
    byPriority: byPriority.map((r): Count<TicketPriority> => ({ key: r.priority, label: r.priority, count: r._count._all })),
    byTopic: sorted(byTopic.map((r) => ({ key: r.helpTopicId, label: nameOf(topics, r.helpTopicId, "No topic"), count: r._count._all }))),
    byCampus: sorted(byCampus.map((r) => ({ key: r.campusId, label: nameOf(campuses, r.campusId, "No campus"), count: r._count._all }))),
    agents: agents.map((a) => ({ ...a, firstResponseMs: a.firstResponseS == null ? null : a.firstResponseS * 1000 })),
  };
}
